"""Free deterministic ranker: scores a job against the owner's CV. No LLM, no network.

Score = 0.55 * skills_overlap + 0.30 * role_match + 0.15 * recency, clamped to [0, 1].
Claude Code does the *deep* tailoring later; this only gives the dashboard a good default sort.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from normalize import classify_role_family, parse_date, title_matches_family

# Skills drawn from the CV (see cv/cv.md). Multi-word phrases matched as substrings.
CV_SKILLS = [
    "python", "javascript", "react", "java", "php", "sql", "bash",
    "llm", "prompt engineering", "tensorflow", "agentic", "spark", "kafka",
    "redshift", "etl", "docker", "kubernetes", "aws", "mcp", "rag",
    "postgresql", "cassandra", "databricks", "retool", "system design",
    "nlp", "opencv", "data engineering", "machine learning", "pipeline",
    "microservices", "distributed", "streaming", "api",
]

# Number of matched skills that counts as a "full" overlap score.
_SKILLS_SATURATION = 8
# Postings older than this (days) get zero recency credit.
_RECENCY_WINDOW_DAYS = 60.0


_PATTERN_CACHE: dict = {}


def _skill_pattern(skill: str) -> "re.Pattern":
    """Whole-word match for a skill, so "java" doesn't hit "javascript", "rag"
    doesn't hit "storage", and "api" doesn't hit "rapid". Boundaries are
    "not a letter/digit" rather than \\b, so skills with symbols ("c++",
    "node.js", "ci/cd") still match. A plural "s" is allowed ("pipelines", "apis"); a trailing
    "+" or "#" counts as part of the word, so "c" doesn't hit "c++" or "c#"."""
    pat = _PATTERN_CACHE.get(skill)
    if pat is None:
        pat = re.compile(r"(?<![a-z0-9])" + re.escape(skill) + r"s?(?![a-z0-9+#])")
        _PATTERN_CACHE[skill] = pat
    return pat


def _recency(posted_at: Optional[str], now: Optional[datetime] = None) -> float:
    dt = parse_date(posted_at)
    if dt is None:
        return 0.5  # unknown date → neutral
    now = now or datetime.now(timezone.utc)
    days = max(0.0, (now - dt).total_seconds() / 86400.0)
    return max(0.0, 1.0 - days / _RECENCY_WINDOW_DAYS)


def _skills_overlap(text: str, extra_skills: Optional[List[str]] = None) -> Tuple[float, List[str]]:
    hay = f" {text.lower()} "
    # The base CV skills plus any keywords/titles the user set in their search
    # preferences, so ranking follows what they actually want, not just the CV.
    vocab = list(CV_SKILLS)
    for s in (extra_skills or []):
        s = (s or "").strip().lower()
        if s and s not in vocab:
            vocab.append(s)
    matched = [s for s in vocab if _skill_pattern(s).search(hay)]
    score = min(1.0, len(matched) / _SKILLS_SATURATION)
    return score, matched


def score_job(title: str, description: str, posted_at: Optional[str] = None,
              now: Optional[datetime] = None,
              extra_skills: Optional[List[str]] = None) -> Tuple[float, List[str]]:
    """Return (match_score in [0,1], human-readable reasons)."""
    combined = f"{title}\n{description}"
    skills_score, matched = _skills_overlap(combined, extra_skills)

    if title_matches_family(title):
        role_score = 1.0
    elif classify_role_family(title, description) is not None:
        role_score = 0.5
    else:
        role_score = 0.0

    rec = _recency(posted_at, now)
    total = 0.55 * skills_score + 0.30 * role_score + 0.15 * rec
    total = round(max(0.0, min(1.0, total)), 3)

    reasons: List[str] = []
    if matched:
        top = ", ".join(matched[:6])
        reasons.append(f"Matches your skills: {top}")
    if role_score >= 1.0:
        reasons.append("Title is a direct role-family match")
    elif role_score > 0:
        reasons.append("Role-family match in description")
    if rec >= 0.7:
        reasons.append("Recently posted")
    if not reasons:
        reasons.append("Low relevance to your CV")
    return total, reasons
