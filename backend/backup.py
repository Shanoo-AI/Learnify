import sqlite3
import os
from datetime import datetime

from dotenv import load_dotenv
from pymongo import MongoClient

def migrate_now():
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, 'database', 'userdb.db')
    mongo_uri = os.getenv('MONGO_URI')
    mongo_db_name = os.getenv('MONGO_DB_NAME', 'learnify')

    sqlite_conn = None

    try:
        if not os.path.exists(db_path):
            print(f"Error: Database file nahi mili is path par: {db_path}")
            return
        if not mongo_uri:
            print("Error: MONGO_URI env var set karo. Atlas connection string chahiye.")
            return

        sqlite_conn = sqlite3.connect(db_path)
        sqlite_conn.row_factory = sqlite3.Row
        sq_cur = sqlite_conn.cursor()

        mongo_client = MongoClient(mongo_uri)
        mongo_db = mongo_client[mongo_db_name]
        users_col = mongo_db['users']
        past_papers_col = mongo_db['past_papers']

        users_col.create_index('name', unique=True)
        users_col.create_index('email', unique=True, sparse=True)
        past_papers_col.create_index('id')

        sq_cur.execute('SELECT name, password FROM Data')
        users = [dict(row) for row in sq_cur.fetchall()]
        for user in users:
            user_doc = {
                'name': user['name'],
                'password': user['password'],
                'is_verified': True,
                'provider': 'password',
                'created_at': datetime.utcnow(),
            }
            if user.get('email'):
                user_doc['email'] = user['email']

            users_col.update_one(
                {'name': user['name']},
                {'$setOnInsert': user_doc},
                upsert=True,
            )
        print(f"Migrated {len(users)} users.")

        sq_cur.execute("SELECT subject, course_code, year, semester, paper_type, file_name, file_path FROM past_papers")
        papers = [dict(row) for row in sq_cur.fetchall()]
        for index, paper in enumerate(papers, start=1):
            paper.setdefault('uploaded_at', datetime.utcnow())
            past_papers_col.update_one(
                {
                    'subject': paper.get('subject'),
                    'course_code': paper.get('course_code'),
                    'year': paper.get('year'),
                    'paper_type': paper.get('paper_type'),
                    'file_name': paper.get('file_name'),
                },
                {'$setOnInsert': {**paper, 'id': index}},
                upsert=True,
            )
        print(f"Migrated {len(papers)} past papers.")
        print("MongoDB Atlas migration successful, jani!")

    except Exception as e:
        print(f"Error occurred: {e}")
    finally:
        if sqlite_conn:
            sqlite_conn.close()

if __name__ == "__main__":
    migrate_now()
