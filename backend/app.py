import os
import random
import smtplib
import sys
import uuid
from datetime import datetime, timedelta
from email.message import EmailMessage
from hashlib import sha256
from pathlib import Path

from flask import Flask, jsonify, redirect, request, send_from_directory, session, url_for
from flask_cors import CORS
from flask_dance.contrib.google import google, make_google_blueprint
from pymongo import DESCENDING, MongoClient
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.utils import secure_filename

from audio2 import register_audio_routes

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / '.env')
except Exception as exc:
    print(f'.env loading skipped: {exc}')

# Ensure backend directory is on path so we can import local helpers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from topic_ai import process_smartly
from youtube import find_best_video

if os.getenv('FLASK_ENV') != 'production':
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-me')
_cors_origins = [
    origin.strip()
    for origin in os.getenv('CORS_ORIGINS', os.getenv('FRONTEND_URL', '')).split(',')
    if origin.strip()
]
CORS(
    app,
    supports_credentials=True,
    origins=_cors_origins or [r"http://localhost(:\d+)?", r"http://127\.0\.0\.1(:\d+)?"],
)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true',
    SESSION_COOKIE_SAMESITE=os.getenv('SESSION_COOKIE_SAMESITE', 'Lax'),
)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif',
    'csv', 'json', 'py', 'js', 'html', 'css', 'md', 'doc', 'docx',
}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
OTP_EXPIRY_MINUTES = 10

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

mongo_client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017'), serverSelectionTimeoutMS=5000)
mongo_db = mongo_client[os.getenv('MONGO_DB_NAME', 'learnify')]
users_col = mongo_db['users']
pending_otps_col = mongo_db['pending_user_otps']
past_papers_col = mongo_db['past_papers']


def _init_mongo_indexes() -> None:
    try:
        users_col.create_index('name', unique=True)
        users_col.create_index('email', unique=True, sparse=True)
        pending_otps_col.create_index('email', unique=True)
        pending_otps_col.create_index('expires_at', expireAfterSeconds=0)
        past_papers_col.create_index([('uploaded_at', DESCENDING)])
    except Exception as exc:
        print(f'Mongo index setup skipped: {exc}')


_init_mongo_indexes()


def _json_record(record: dict) -> dict:
    clean = dict(record)
    if '_id' in clean:
        clean['_id'] = str(clean['_id'])
    return clean

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


def _register_quiz_routes(main_app: Flask) -> None:
    quiz_app_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'quiz',
        'backend',
        'app.py',
    )
    if not os.path.exists(quiz_app_path):
        return

    import importlib.util

    try:
        spec = importlib.util.spec_from_file_location('quiz_backend_app', quiz_app_path)
        if spec is None or spec.loader is None:
            return

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except Exception as exc:
        print(f'Quiz backend unavailable: {exc}')

        @main_app.route('/api/quiz/<path:_path>', methods=['GET', 'POST'])
        def quiz_unavailable(_path):
            if not session.get('logged_in'):
                return jsonify({'success': False, 'reply': 'Please login first'}), 401
            return jsonify({'error': 'Quiz backend is unavailable'}), 503

        return

    def require_quiz_login():
        if not session.get('logged_in'):
            return jsonify({'success': False, 'reply': 'Please login first'}), 401
        return None

    def call_quiz_route(route_func, *args):
        denied = require_quiz_login()
        if denied:
            return denied
        try:
            return route_func(*args)
        except Exception as exc:
            print(f'Quiz route error: {exc}')
            return jsonify({'error': 'Quiz service error'}), 500

    @main_app.route('/api/quiz/subjects', methods=['GET'])
    def quiz_subjects():
        return call_quiz_route(module.get_subjects)

    @main_app.route('/api/quiz/topics/<subject>', methods=['GET'])
    def quiz_topics(subject):
        return call_quiz_route(module.get_topics, subject)

    @main_app.route('/api/quiz/generate-quiz', methods=['POST'])
    def quiz_generate():
        return call_quiz_route(module.generate_quiz)

    @main_app.route('/api/quiz/submit-quiz', methods=['POST'])
    def quiz_submit():
        return call_quiz_route(module.submit_quiz)


def _register_dashboard_routes(main_app: Flask) -> None:
    dashboard_app_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'dashboard',
        'app.py',
    )
    if not os.path.exists(dashboard_app_path):
        return

    import importlib.util

    try:
        spec = importlib.util.spec_from_file_location('dashboard_backend_app', dashboard_app_path)
        if spec is None or spec.loader is None:
            return

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        dashboard_bp = getattr(module, 'dashboard_bp', None)
        if dashboard_bp is not None:
            main_app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    except Exception as exc:
        print(f'Dashboard backend unavailable: {exc}')

        @main_app.route('/api/dashboard/<path:_path>', methods=['GET'])
        def dashboard_unavailable(_path):
            if not session.get('logged_in'):
                return jsonify({'success': False, 'reply': 'Please login first'}), 401
            return jsonify({'error': 'Dashboard backend is unavailable'}), 503


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def _hash_otp(email: str, otp: str) -> str:
    pepper = os.getenv('OTP_SECRET', app.secret_key)
    value = f"{email.strip().lower()}:{otp}:{pepper}"
    return sha256(value.encode('utf-8')).hexdigest()


def _send_registration_otp(email: str, otp: str, name: str) -> None:
    smtp_host = os.getenv('SMTP_HOST')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    smtp_from = os.getenv('SMTP_FROM', smtp_user or '')

    missing = [
        key
        for key, value in {
            'SMTP_HOST': smtp_host,
            'SMTP_USER': smtp_user,
            'SMTP_PASSWORD': smtp_password,
            'SMTP_FROM': smtp_from,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Email OTP is not configured. Missing: {', '.join(missing)}")

    message = EmailMessage()
    message['Subject'] = 'Your Learnify verification code'
    message['From'] = smtp_from
    message['To'] = email
    message.set_content(
        f"Hi {name},\n\n"
        f"Your Learnify verification code is: {otp}\n\n"
        f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n"
        "If you did not request this, you can ignore this email.\n"
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)

# Adds /api/generate-audio endpoint for PPT/PDF upload and TTS generation.
register_audio_routes(app)
_mount_mentorbot(app)
_register_quiz_routes(app)
_register_dashboard_routes(app)

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

    user = users_col.find_one({'$or': [{'name': name}, {'email': email}]})
    if user is None:
        users_col.insert_one({
            'name': name,
            'email': email,
            'password': email,
            'is_verified': True,
            'provider': 'google',
            'created_at': datetime.utcnow(),
        })

    session['user'] = name
    session['logged_in'] = True
    return redirect(os.getenv('FRONTEND_URL', 'http://localhost:3000'))


@app.route('/logout', methods=['GET'])
def logout():
    session.clear()
    session.pop('google_oauth_token', None)
    session.pop('google_oauth_state', None)
    return jsonify({'success': True, 'reply': 'Logged out successfully'})


@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({'success': False, 'reply': 'Name, email, and password required'})

    if '@' not in email or '.' not in email.rsplit('@', 1)[-1]:
        return jsonify({'success': False, 'reply': 'Enter a valid email address'})

    existing_user = users_col.find_one({'$or': [{'name': name}, {'email': email}]})
    if existing_user:
        return jsonify({'success': False, 'reply': 'Username or email already exists'})

    otp = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    pending_otps_col.update_one(
        {'email': email},
        {
            '$set': {
                'name': name,
                'email': email,
                'password': password,
                'otp_hash': _hash_otp(email, otp),
                'expires_at': expires_at,
                'attempts': 0,
                'created_at': datetime.utcnow(),
            }
        },
        upsert=True,
    )

    try:
        _send_registration_otp(email, otp, name)
    except Exception as exc:
        print(f"OTP email error: {exc}")
        return jsonify({'success': False, 'reply': str(exc)}), 500

    return jsonify({
        'success': True,
        'requires_otp': True,
        'reply': f'OTP sent to {email}. Enter it to finish registration.',
    })


@app.route('/verify-registration', methods=['POST'])
def verify_registration():
    data = request.json
    email = (data.get('email') or '').strip().lower()
    otp = (data.get('otp') or '').strip()

    if not email or not otp:
        return jsonify({'success': False, 'reply': 'Email and OTP required'}), 400

    pending = pending_otps_col.find_one({'email': email})
    if not pending:
        return jsonify({'success': False, 'reply': 'No pending registration found'}), 404

    if pending['expires_at'] < datetime.utcnow():
        pending_otps_col.delete_one({'email': email})
        return jsonify({'success': False, 'reply': 'OTP expired. Please register again.'}), 400

    if pending.get('attempts', 0) >= 5:
        pending_otps_col.delete_one({'email': email})
        return jsonify({'success': False, 'reply': 'Too many wrong attempts. Please register again.'}), 400

    if pending['otp_hash'] != _hash_otp(email, otp):
        pending_otps_col.update_one({'email': email}, {'$inc': {'attempts': 1}})
        return jsonify({'success': False, 'reply': 'Invalid OTP'}), 400

    existing_user = users_col.find_one({
        '$or': [{'name': pending['name']}, {'email': pending['email']}]
    })
    if existing_user:
        pending_otps_col.delete_one({'email': email})
        return jsonify({'success': False, 'reply': 'Username or email already exists'}), 409

    users_col.insert_one({
        'name': pending['name'],
        'email': pending['email'],
        'password': pending['password'],
        'is_verified': True,
        'provider': 'password',
        'created_at': datetime.utcnow(),
    })
    pending_otps_col.delete_one({'email': email})

    return jsonify({'success': True, 'reply': 'Email verified. Account created successfully.'})


@app.route('/login', methods=['POST'])
def login():
    data = request.json
    name = data.get('name')
    password = data.get('password')

    if not name or not password:
        return jsonify({'success': False, 'reply': 'Name and password required'})

    user = users_col.find_one({'name': name, 'password': password})

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
        rows = list(past_papers_col.find({}).sort([('uploaded_at', DESCENDING), ('id', DESCENDING)]))

        papers = []
        for row in rows:
            record = _json_record(row)
            record['file_url'] = _resolve_paper_file_url(record)
            papers.append(record)

        return jsonify({'success': True, 'papers': papers, 'count': len(papers)})
    except Exception as e:
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

        # Process course outlines for the YouTube learning module.
        topics = []
        if filename.lower().endswith(('.doc', '.docx', '.pdf', '.txt', '.md')):
            try:
                topics = process_smartly(filepath)
            except Exception as e:
                print(f"Error processing outline: {e}")
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
        used_video_ids = set()
        import time

        for topic in topics:
            try:
                video = find_best_video(topic, used_video_ids)
                if video and video.get('url'):
                    video_id = video.get('videoId')
                    if video_id:
                        used_video_ids.add(video_id)
                    videos.append({
                        'topic': topic,
                        'url': video.get('url'),
                        'title': video.get('title'),
                        'videoId': video_id,
                        'channelTitle': video.get('channelTitle'),
                        'durationText': video.get('durationText'),
                        'viewCount': video.get('viewCount'),
                        'likeCount': video.get('likeCount'),
                        'subscriberCount': video.get('subscriberCount'),
                        'thumbnail': video.get('thumbnail'),
                        'score': video.get('score'),
                        'alternatives': video.get('alternatives', []),
                    })
                else:
                    videos.append({
                        'topic': topic,
                        'url': None,
                        'title': None,
                        'videoId': None,
                        'channelTitle': None,
                        'durationText': None,
                        'viewCount': 0,
                        'likeCount': 0,
                        'subscriberCount': 0,
                        'thumbnail': None,
                        'score': 0,
                        'alternatives': [],
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
                    'channelTitle': None,
                    'durationText': None,
                    'viewCount': 0,
                    'likeCount': 0,
                    'subscriberCount': 0,
                    'thumbnail': None,
                    'score': 0,
                    'alternatives': [],
                })

        return jsonify({
            'success': True,
            'videos': videos,
        })
    except Exception as e:
        print(f"Error in get_youtube_videos: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(
        debug=os.getenv('FLASK_ENV') != 'production',
        host='0.0.0.0',
        port=int(os.getenv('PORT', '5000')),
    )
