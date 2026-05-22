#!/usr/bin/env python3
"""YouTube learning video discovery.

The old implementation trusted the first search result. This version asks for
multiple candidates, enriches them with video metadata, and scores them for
learning usefulness before returning a pick.
"""

import html
import math
import os
import re
from datetime import datetime, timezone
from typing import Iterable

import requests


API_KEY = os.getenv("YT_API_KEY")
SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
MAX_VIDEO_DURATION_SECONDS = 35 * 60

EDUCATIONAL_TERMS = {
    "tutorial",
    "lecture",
    "course",
    "explained",
    "introduction",
    "complete",
    "crash",
    "deep",
    "guide",
    "learn",
    "basics",
    "beginner",
    "full",
}

LOW_VALUE_TERMS = {
    "shorts",
    "#shorts",
    "status",
    "reaction",
    "meme",
    "song",
    "lyrics",
    "trailer",
    "promo",
}

TRUSTED_CHANNEL_HINTS = {
    "gate smashers",
    "5 minutes engineering",
    "freecodecamp",
    "mit",
    "stanford",
    "harvard",
    "khan academy",
    "nptel",
    "crashcourse",
    "computerphile",
    "3blue1brown",
    "the organic chemistry tutor",
    "neso academy",
    "abdul bari",
    "jenny's lectures",
    "simplilearn",
    "edureka",
}

TOKEN_RE = re.compile(r"[a-z0-9]+")
DURATION_RE = re.compile(
    r"P(?:(?P<days>\d+)D)?T?"
    r"(?:(?P<hours>\d+)H)?"
    r"(?:(?P<minutes>\d+)M)?"
    r"(?:(?P<seconds>\d+)S)?"
)


def _clean_text(value: str | None) -> str:
    return html.unescape(value or "").strip()


def _tokens(value: str | None) -> set[str]:
    return set(TOKEN_RE.findall((value or "").lower()))


def _parse_iso8601_duration(value: str | None) -> int:
    if not value:
        return 0

    match = DURATION_RE.fullmatch(value)
    if not match:
        return 0

    parts = {key: int(val or 0) for key, val in match.groupdict().items()}
    return (
        parts["days"] * 86400
        + parts["hours"] * 3600
        + parts["minutes"] * 60
        + parts["seconds"]
    )


def _duration_text(total_seconds: int) -> str:
    if total_seconds <= 0:
        return ""

    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def _safe_int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _published_age_days(value: str | None) -> int:
    if not value:
        return 365

    try:
        published_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return max((datetime.now(timezone.utc) - published_at).days, 0)
    except ValueError:
        return 365


def _search_candidates(topic: str, max_results: int = 3) -> list[dict]:
    query = f"{topic} tutorial lecture explained"
    params = {
        "key": API_KEY,
        "part": "snippet",
        "type": "video",
        "q": query,
        "maxResults": max_results,
        "order": "relevance",
        "safeSearch": "moderate",
        "videoEmbeddable": "true",
        "relevanceLanguage": "en",
    }

    response = requests.get(SEARCH_URL, params=params, timeout=12)
    response.raise_for_status()
    return response.json().get("items", [])


def _load_video_details(video_ids: Iterable[str]) -> dict[str, dict]:
    ids = [video_id for video_id in video_ids if video_id]
    if not ids:
        return {}

    params = {
        "key": API_KEY,
        "part": "snippet,contentDetails,statistics,status",
        "id": ",".join(ids),
        "maxResults": len(ids),
    }
    response = requests.get(VIDEOS_URL, params=params, timeout=12)
    response.raise_for_status()
    return {item["id"]: item for item in response.json().get("items", [])}


def _score_video(topic: str, video: dict, blocked_video_ids: set[str]) -> float:
    video_id = video["videoId"]
    title = video["title"]
    description = video.get("description", "")
    channel_title = video.get("channelTitle", "")
    duration_seconds = video.get("durationSeconds", 0)
    view_count = video.get("viewCount", 0)
    like_count = video.get("likeCount", 0)
    published_at = video.get("publishedAt")

    score = 0.0
    topic_tokens = _tokens(topic)
    haystack_tokens = _tokens(f"{title} {description}")
    title_tokens = _tokens(title)
    channel = channel_title.lower()
    lower_title = title.lower()

    if topic_tokens:
        score += 35 * (len(topic_tokens & title_tokens) / len(topic_tokens))
        score += 15 * (len(topic_tokens & haystack_tokens) / len(topic_tokens))

    score += 4 * len(EDUCATIONAL_TERMS & title_tokens)
    if any(hint in channel for hint in TRUSTED_CHANNEL_HINTS):
        score += 12

    if 6 * 60 <= duration_seconds <= 45 * 60:
        score += 14
    elif 45 * 60 < duration_seconds <= 90 * 60:
        score += 8
    elif 3 * 60 <= duration_seconds < 6 * 60:
        score += 4
    elif duration_seconds < 90:
        score -= 22
    elif duration_seconds > 2 * 3600:
        score -= 8

    score += min(math.log10(view_count + 1) * 4, 28)
    if view_count > 0 and like_count > 0:
        score += min((like_count / max(view_count, 1)) * 100, 8)

    age_days = _published_age_days(published_at)
    if age_days <= 365 * 3:
        score += 4
    elif age_days > 365 * 8:
        score -= 3

    if any(term in lower_title for term in LOW_VALUE_TERMS):
        score -= 25
    if video_id in blocked_video_ids:
        score -= 100

    return round(score, 2)


def _build_video(topic: str, item: dict, details: dict, blocked_video_ids: set[str]) -> dict | None:
    video_id = item.get("id", {}).get("videoId")
    detail = details.get(video_id or "")
    if not video_id or not detail:
        return None

    status = detail.get("status", {})
    if status.get("embeddable") is False or status.get("privacyStatus") != "public":
        return None

    snippet = detail.get("snippet", item.get("snippet", {}))
    content = detail.get("contentDetails", {})
    stats = detail.get("statistics", {})
    thumbnails = snippet.get("thumbnails", {})
    best_thumbnail = (
        thumbnails.get("maxres")
        or thumbnails.get("high")
        or thumbnails.get("medium")
        or thumbnails.get("default")
        or {}
    )
    duration_seconds = _parse_iso8601_duration(content.get("duration"))
    if duration_seconds > MAX_VIDEO_DURATION_SECONDS:
        return None

    video = {
        "topic": topic,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": _clean_text(snippet.get("title")),
        "description": _clean_text(snippet.get("description")),
        "videoId": video_id,
        "channelTitle": _clean_text(snippet.get("channelTitle")),
        "publishedAt": snippet.get("publishedAt"),
        "durationSeconds": duration_seconds,
        "durationText": _duration_text(duration_seconds),
        "viewCount": _safe_int(stats.get("viewCount")),
        "likeCount": _safe_int(stats.get("likeCount")),
        "thumbnail": best_thumbnail.get("url"),
    }
    video["score"] = _score_video(topic, video, blocked_video_ids)
    return video


def find_best_video(topic: str, blocked_video_ids: set[str] | None = None) -> dict | None:
    """Return the highest scoring embeddable learning video for a topic."""
    if not API_KEY:
        return None

    topic = (topic or "").strip()
    if not topic:
        return None

    blocked_video_ids = blocked_video_ids or set()

    try:
        search_items = _search_candidates(topic)
        video_ids = [item.get("id", {}).get("videoId") for item in search_items]
        details = _load_video_details(video_ids)
        ranked = [
            video
            for item in search_items
            if (video := _build_video(topic, item, details, blocked_video_ids))
        ]
        ranked.sort(key=lambda item: item["score"], reverse=True)

        if not ranked:
            return None

        best = ranked[0]
        best["alternatives"] = []
        return best
    except requests.RequestException as exc:
        print(f"Error searching YouTube for '{topic}': {exc}")
        return None
    except Exception as exc:
        print(f"Unexpected YouTube ranking error for '{topic}': {exc}")
        return None


def empty_video(topic: str) -> dict:
    return {
        "topic": topic,
        "url": None,
        "title": None,
        "videoId": None,
        "channelTitle": None,
        "durationText": None,
        "viewCount": 0,
        "score": 0,
        "thumbnail": None,
        "alternatives": [],
    }


def best_video_link(topic: str):
    """Backward compatible helper used by older scripts."""
    video = find_best_video(topic)
    if not video:
        return None, None
    return video["url"], video["title"]


if __name__ == "__main__":
    for demo_topic in ("machine learning basics", "database normalization", "operating system scheduling"):
        result = find_best_video(demo_topic)
        if result:
            print(f"{demo_topic}: {result['title']} - {result['url']}")
        else:
            print(f"{demo_topic}: no video found")
