import os
import sqlite3
import sys
import uuid
from datetime import datetime

from flask import Flask, jsonify, redirect, request, send_from_directory, session, url_for
from flask_cors import CORS
from flask_dance.contrib.google import google, make_google_blueprint
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.utils import secure_filename

from audio2 import register_audio_routes

# Ensure backend directory is on path so we can import local helpers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from topic_ai import process_smartly
from youtube import best_video_link

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = 'supersecretkey'
CORS(
    app,
    supports_credentials=True,
    origins=[r"http://localhost(:\d+)?", r"http://127\.0\.0\.1(:\d+)?"],
)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_SAMESITE='Lax',
)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif',
    'csv', 'json', 'py', 'js', 'html', 'css', 'md', 'docx',
}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'userdb.db')

def _mount_mentorbot(main_app: Flask) -> None:
    mentorbot_app_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'mentorbot',
        'backend',
        'app.py',
    )
    if not os.path.exists(mentorbot_app_path):
        return

    import importlib.util

    spec = importlib.util.spec_from_file_location('mentorbot_backend_app', mentorbot_app_path)
    if spec is None or spec.loader is None:
        return

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    mentor_app = getattr(module, 'app', None)
    if mentor_app is None:
        return

    main_app.wsgi_app = DispatcherMiddleware(main_app.wsgi_app, {'/mentorbot': mentor_app})


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Adds /api/generate-audio endpoint for PPT/PDF upload and TTS generation.
register_audio_routes(app)
_mount_mentorbot(app)

google_bp = make_google_blueprint(
    client_id=os.getenv('GOOGLE_OAUTH_CLIENT_ID', ''),
    client_secret=os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', ''),
    scope=[
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
    ],
    redirect_to='google_login',
)

app.register_blueprint(google_bp, url_prefix='/login')


@app.route('/google-start')
def google_start():
    session.pop('google_oauth_state', None)
    session.pop('google_oauth_token', None)
    return redirect(url_for('google.login', prompt='select_account'))


@app.route('/google-login')
def google_login():
    if not google.authorized:
        session.pop('google_oauth_state', None)
        session.pop('google_oauth_token', None)
        return redirect(url_for('google.login', prompt='select_account'))

    resp = google.get('/oauth2/v2/userinfo')
    user_info = resp.json()

    email = user_info['email']
    name = user_info['name']

    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()
    cursor.execute('SELECT * FROM data WHERE name=?', (name,))
    user = cursor.fetchone()

    if user is None:
        cursor.execute('INSERT INTO data (name, password) VALUES (?, ?)', (name, email))
        con.commit()
    con.close()

    session['user'] = name
    session['logged_in'] = True
    return redirect('http://localhost:3000')


@app.route('/logout', methods=['GET'])
def logout():
    session.clear()
    session.pop('google_oauth_token', None)
    session.pop('google_oauth_state', None)
    return jsonify({'success': True, 'reply': 'Logged out successfully'})


@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    password = data.get('password')

    if not name or not password:
        return jsonify({'success': False, 'reply': 'Name and password required'})

    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()
    cursor.execute('SELECT * FROM data WHERE name=?', (name,))
    existing_user = cursor.fetchone()

    if existing_user:
        con.close()
        return jsonify({'success': False, 'reply': 'User already exists'})

    cursor.execute('INSERT INTO data (name, password) VALUES (?, ?)', (name, password))
    con.commit()
    con.close()
    return jsonify({'success': True, 'reply': 'User registered successfully'})


@app.route('/login', methods=['POST'])
def login():
    data = request.json
    name = data.get('name')
    password = data.get('password')

    if not name or not password:
        return jsonify({'success': False, 'reply': 'Name and password required'})

    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()
    cursor.execute('SELECT * FROM data WHERE name=? AND password=?', (name, password))
    user = cursor.fetchone()
    con.close()

    if user:
        session['user'] = name
        session['logged_in'] = True
        return jsonify({'success': True, 'reply': 'Login successful', 'user': name})

    return jsonify({'success': False, 'reply': 'Invalid username or password'})


@app.route('/check-session', methods=['GET'])
def check_session():
    if session.get('logged_in'):
        return jsonify({'success': True, 'logged_in': True, 'user': session.get('user')})
    return jsonify({'success': False, 'logged_in': False})


@app.route('/home', methods=['POST'])
def home():
    if not session.get('logged_in'):
        return jsonify({'success': False, 'reply': 'Please login first'}), 401

    user = session.get('user')
    return jsonify({'success': True, 'reply': f'Welcome {user}! This is your home page.', 'user': user})




def _resolve_paper_file_url(record: dict) -> str | None:
    """Build a browser URL for a stored paper path/filename."""
    direct_url = record.get('file_url') or record.get('url')
    if direct_url:
        return direct_url

    path_value = (
        record.get('file_path')
        or record.get('path')
        or record.get('address')
        or record.get('file')
        or record.get('filename')
        or record.get('file_name')
    )

    if not path_value:
        return None

    normalized = str(path_value).replace('\\', '/').strip()

    if normalized.startswith('http://') or normalized.startswith('https://'):
        return normalized

    filename = normalized.split('/')[-1]
    if not filename:
        return None

    return f"/api/uploads/{filename}"


@app.route('/api/uploads/<path:filename>', methods=['GET'])
def serve_uploaded_file(filename):
    safe_name = os.path.basename(filename.replace('\\', '/'))
    return send_from_directory(app.config['UPLOAD_FOLDER'], safe_name)


@app.route('/api/past-papers', methods=['GET'])
def get_past_papers():
    if not session.get('logged_in'):
        return jsonify({'success': False, 'reply': 'Please login first'}), 401

    try:
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        cursor = con.cursor()
        cursor.execute('SELECT * FROM past_papers ORDER BY id DESC')
        rows = cursor.fetchall()
        con.close()

        papers = []
        for row in rows:
            record = dict(row)
            record['file_url'] = _resolve_paper_file_url(record)
            papers.append(record)

        return jsonify({'success': True, 'papers': papers, 'count': len(papers)})
    except sqlite3.Error as e:
        return jsonify({'success': False, 'reply': f'Database error: {e}', 'papers': []}), 500


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file uploads and process with AI if it's a docx file."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Add timestamp to avoid conflicts
        unique_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)

        # Get file info
        file_size = os.path.getsize(filepath)

        # Process with AI if it's a docx file
        topics = []
        if filename.lower().endswith('.docx'):
            try:
                topics = process_smartly(filepath)
            except Exception as e:
                print(f"Error processing docx: {e}")
                topics = []

        # Delete file after processing (don't store old files)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"Error deleting file: {e}")

        return jsonify({
            'success': True,
            'filename': unique_filename,
            'original_filename': filename,
            'size': file_size,
            'uploaded_at': datetime.now().isoformat(),
            'message': 'File processed successfully',
            'topics': topics if topics else None,
        })

    return jsonify({'error': 'File type not allowed'}), 400


@app.route('/api/get-youtube-videos', methods=['POST'])
def get_youtube_videos():
    """Get YouTube videos for a list of topics."""
    try:
        data = request.get_json()
        topics = data.get('topics', [])
        print("=== TOPICS RECEIVED FROM FRONTEND ===")
        print(topics)
        if not topics:
            return jsonify({'error': 'No topics provided'}), 400

        videos = []
        import time

        for topic in topics:
            try:
                url, title = best_video_link(topic)
                if url:
                    # Extract video ID from URL (handles different URL formats)
                    video_id = None
                    if 'v=' in url:
                        video_id = url.split('v=')[1].split('&')[0].split('#')[0]
                    elif 'youtu.be/' in url:
                        video_id = url.split('youtu.be/')[1].split('?')[0].split('#')[0]

                    videos.append({
                        'topic': topic,
                        'url': url,
                        'title': title,
                        'videoId': video_id,
                    })
                else:
                    videos.append({
                        'topic': topic,
                        'url': None,
                        'title': None,
                        'videoId': None,
                    })
                # Small delay to avoid rate limiting
                time.sleep(0.5)
            except Exception as e:
                print(f"Error getting video for topic '{topic}': {e}")
                videos.append({
                    'topic': topic,
                    'url': None,
                    'title': None,
                    'videoId': None,
                })

        return jsonify({
            'success': True,
            'videos': videos,
        })
    except Exception as e:
        print(f"Error in get_youtube_videos: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
