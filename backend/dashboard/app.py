import os
from flask import Blueprint, Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv()

app = Flask(__name__)
CORS(app)
dashboard_bp = Blueprint("dashboard", __name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = mongo_client[os.getenv("MONGO_DB_NAME", "Learnify")]
results_col = db["results"]

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def safe_pct(correct, total):
    return round((correct / total) * 100, 1) if total > 0 else 0

# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@dashboard_bp.route("/users", methods=["GET"])
def get_users():
    try:
        usernames = results_col.distinct("username")
        usernames = [u for u in usernames if u]
        return jsonify({"users": sorted(usernames)}), 200
    except Exception:
        return jsonify({"error": "Dashboard database unavailable. Start MongoDB and set MONGO_URI if needed."}), 503


@dashboard_bp.route("/overview", methods=["GET"])
def get_overview():
    try:
        docs = list(results_col.find({}, {"_id": 0}))
    except Exception:
        return jsonify({"error": "Dashboard database unavailable. Start MongoDB and set MONGO_URI if needed."}), 503

    if not docs:
        return jsonify({
            "total_quizzes": 0,
            "total_users": 0,
            "avg_score": 0,
            "subject_performance": [],
            "difficulty_distribution": [],
            "score_distribution": [],
            "top_performers": [],
            "activity_timeline": []
        }), 200

    # ── Basic stats ──
    total_quizzes = len(docs)
    total_users = len(set(d.get("username") for d in docs if d.get("username")))
    avg_score = safe_pct(
        sum(d.get("score", 0) for d in docs),
        sum(d.get("total", 1) for d in docs)
    )

    # ── Subject-wise performance ──
    subj_map = defaultdict(lambda: {"correct": 0, "total": 0, "count": 0})
    for d in docs:
        s = d.get("subject", "Unknown")
        subj_map[s]["correct"] += d.get("score", 0)
        subj_map[s]["total"] += d.get("total", 0)
        subj_map[s]["count"] += 1

    subject_performance = sorted([
        {
            "subject": s,
            "avg_percentage": safe_pct(v["correct"], v["total"]),
            "total_quizzes": v["count"]
        }
        for s, v in subj_map.items()
    ], key=lambda x: x["avg_percentage"], reverse=True)

    # ── Difficulty distribution ──
    diff_map = defaultdict(int)
    diff_score = defaultdict(lambda: {"correct": 0, "total": 0})
    for d in docs:
        diff = d.get("difficulty", "Unknown")
        diff_map[diff] += 1
        diff_score[diff]["correct"] += d.get("score", 0)
        diff_score[diff]["total"] += d.get("total", 0)

    difficulty_distribution = [
        {
            "difficulty": k,
            "count": diff_map[k],
            "avg_percentage": safe_pct(diff_score[k]["correct"], diff_score[k]["total"])
        }
        for k in diff_map
    ]

    # ── Score distribution buckets ──
    buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    for d in docs:
        p = d.get("percentage", 0)
        if p <= 25:   buckets["0-25"] += 1
        elif p <= 50: buckets["26-50"] += 1
        elif p <= 75: buckets["51-75"] += 1
        else:         buckets["76-100"] += 1

    score_distribution = [{"range": k, "count": v} for k, v in buckets.items()]

    # ── Top performers ──
    user_perf = defaultdict(lambda: {"correct": 0, "total": 0, "quizzes": 0})
    for d in docs:
        u = d.get("username", "")
        if not u:
            continue
        user_perf[u]["correct"] += d.get("score", 0)
        user_perf[u]["total"] += d.get("total", 0)
        user_perf[u]["quizzes"] += 1

    top_performers = sorted([
        {
            "username": u,
            "avg_percentage": safe_pct(v["correct"], v["total"]),
            "total_quizzes": v["quizzes"],
            "total_correct": v["correct"],
            "total_questions": v["total"]
        }
        for u, v in user_perf.items()
    ], key=lambda x: x["avg_percentage"], reverse=True)[:3]

    # ── Activity timeline (last 30 days by day bucket) ──
    import time
    now = time.time()
    day_map = defaultdict(int)
    for d in docs:
        ts = d.get("submitted_at", 0)
        if ts and (now - ts) < 86400 * 30:
            day_key = int((now - ts) // 86400)
            label = f"{day_key}d ago" if day_key > 0 else "today"
            day_map[label] += 1

    activity_timeline = [
        {"day": k, "quizzes": v}
        for k, v in sorted(day_map.items(), key=lambda x: x[0])
    ]

    return jsonify({
        "total_quizzes": total_quizzes,
        "total_users": total_users,
        "avg_score": avg_score,
        "subject_performance": subject_performance,
        "difficulty_distribution": difficulty_distribution,
        "score_distribution": score_distribution,
        "top_performers": top_performers,
        "activity_timeline": activity_timeline
    }), 200


@dashboard_bp.route("/user/<username>", methods=["GET"])
def get_user_dashboard(username):
    try:
        docs = list(results_col.find({"username": username}, {"_id": 0}))
    except Exception:
        return jsonify({"error": "Dashboard database unavailable. Start MongoDB and set MONGO_URI if needed."}), 503

    if not docs:
        return jsonify({"error": f"No data found for user: {username}"}), 404

    total_quizzes = len(docs)
    total_correct = sum(d.get("score", 0) for d in docs)
    total_questions = sum(d.get("total", 0) for d in docs)
    avg_percentage = safe_pct(total_correct, total_questions)
    best_score = max(d.get("percentage", 0) for d in docs)
    latest_score = sorted(docs, key=lambda x: x.get("submitted_at", 0), reverse=True)[0].get("percentage", 0)

    # ── Score trend ──
    sorted_docs = sorted(docs, key=lambda x: x.get("submitted_at", 0))
    score_trend = [
        {
            "quiz_num": i + 1,
            "percentage": d.get("percentage", 0),
            "subject": d.get("subject", ""),
            "topic": d.get("topic", ""),
            "difficulty": d.get("difficulty", "")
        }
        for i, d in enumerate(sorted_docs)
    ]

    # ── Subject breakdown ──
    subj_map = defaultdict(lambda: {"correct": 0, "total": 0, "count": 0})
    for d in docs:
        s = d.get("subject", "Unknown")
        subj_map[s]["correct"] += d.get("score", 0)
        subj_map[s]["total"] += d.get("total", 0)
        subj_map[s]["count"] += 1

    subject_breakdown = [
        {
            "subject": s,
            "avg_percentage": safe_pct(v["correct"], v["total"]),
            "quizzes": v["count"]
        }
        for s, v in subj_map.items()
    ]

    # ── Difficulty performance ──
    diff_map = defaultdict(lambda: {"correct": 0, "total": 0, "count": 0})
    for d in docs:
        diff = d.get("difficulty", "Unknown")
        diff_map[diff]["correct"] += d.get("score", 0)
        diff_map[diff]["total"] += d.get("total", 0)
        diff_map[diff]["count"] += 1

    difficulty_performance = [
        {
            "difficulty": k,
            "avg_percentage": safe_pct(v["correct"], v["total"]),
            "quizzes": v["count"]
        }
        for k, v in diff_map.items()
    ]

    # ── Recent activity (last 5) ──
    recent_activity = [
        {
            "quiz_id": d.get("quiz_id", ""),
            "subject": d.get("subject", ""),
            "topic": d.get("topic", ""),
            "difficulty": d.get("difficulty", ""),
            "score": d.get("score", 0),
            "total": d.get("total", 0),
            "percentage": d.get("percentage", 0),
            "submitted_at": d.get("submitted_at", 0)
        }
        for d in sorted(docs, key=lambda x: x.get("submitted_at", 0), reverse=True)[:5]
    ]

    # ── Weak topics (avg < 50%) ──
    topic_map = defaultdict(lambda: {"correct": 0, "total": 0})
    for d in docs:
        t = d.get("topic", "Unknown")
        topic_map[t]["correct"] += d.get("score", 0)
        topic_map[t]["total"] += d.get("total", 0)

    weak_topics = sorted([
        {
            "topic": t,
            "avg_percentage": safe_pct(v["correct"], v["total"]),
            "quizzes": len([d for d in docs if d.get("topic") == t])
        }
        for t, v in topic_map.items()
        if safe_pct(v["correct"], v["total"]) < 50
    ], key=lambda x: x["avg_percentage"])

    return jsonify({
        "summary": {
            "username": username,
            "total_quizzes": total_quizzes,
            "avg_percentage": avg_percentage,
            "best_score": best_score,
            "latest_score": latest_score,
            "total_correct": total_correct,
            "total_questions": total_questions
        },
        "score_trend": score_trend,
        "subject_breakdown": subject_breakdown,
        "difficulty_performance": difficulty_performance,
        "recent_activity": recent_activity,
        "weak_topics": weak_topics
    }), 200


if __name__ == "__main__":
    app.register_blueprint(dashboard_bp, url_prefix="/dashboard")
    app.run(debug=True, host="0.0.0.0", port=5001)
