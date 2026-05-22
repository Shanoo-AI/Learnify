import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import os

def migrate_now():
    # Folder ka path sahi set karne k liye
    BASE_DIR = os.path.dirname(os.path.abspath(__file__)) #[cite: 1]
    # SQLite file ka complete path
    DB_PATH = os.path.join(BASE_DIR, 'database', 'userdb.db') #[cite: 1]

    sqlite_conn = None
    pg_conn = None

    try:
        if not os.path.exists(DB_PATH):
            print(f"Error: Database file nahi mili is path par: {DB_PATH}")
            return

        # 1. SQLite Connection
        sqlite_conn = sqlite3.connect(DB_PATH)
        sq_cur = sqlite_conn.cursor()

        # 2. Postgres Connection
        pg_conn = psycopg2.connect(
            dbname="Learnify", # Ensure karein k pgAdmin mein yahi name hai
            user="postgres",
            password="123", # <--- Quotes mein likhna zaroori hai
            host="localhost",
            port="5432"
        )
        pg_cur = pg_conn.cursor()

        # --- Migrate 'data' table ---
        sq_cur.execute("SELECT name, password FROM data")
        users = sq_cur.fetchall()
        if users:
            # PostgreSQL placeholders %s use karta hai[cite: 1]
            execute_values(pg_cur, "INSERT INTO data (name, password) VALUES %s ON CONFLICT (name) DO NOTHING", users)
            print(f"Migrated {len(users)} users.")

        # --- Migrate 'past_papers' table ---
        sq_cur.execute("SELECT subject, course_code, year, semester, paper_type, file_name, file_path FROM past_papers")
        papers = sq_cur.fetchall()
        if papers:
            execute_values(pg_cur, """
                INSERT INTO past_papers (subject, course_code, year, semester, paper_type, file_name, file_path) 
                VALUES %s ON CONFLICT DO NOTHING
            """, papers)
            print(f"Migrated {len(papers)} past papers.")

        pg_conn.commit()
        print("Migration Successful, Jani!")

    except Exception as e:
        print(f"Error occurred: {e}")
    finally:
        if sqlite_conn:
            sqlite_conn.close()
        if pg_conn:
            pg_conn.close()

if __name__ == "__main__":
    migrate_now()