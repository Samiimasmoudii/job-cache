"""File-based handshake between the dashboard and Claude Code.

Dashboard writes queue/pending/<id>.json  ->  Claude Code (/apply) writes, grouped BY COMPANY:
    applications/<company-slug>/cover-letter.md   (one letter reused across that company's roles)
    applications/<company-slug>/cv.md             (only if the base CV needs changes)
    applications/<company-slug>/<job_id>.md       (per-job note: fit, "why apply", analysis)
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional, Set

from normalize import slugify

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PENDING_DIR = os.path.join(ROOT, "queue", "pending")
Q_PENDING_DIR = os.path.join(ROOT, "queue", "questions", "pending")
Q_ANSWERED_DIR = os.path.join(ROOT, "queue", "questions", "answered")
APPLICATIONS_DIR = os.path.join(ROOT, "applications")
CV_PATH = os.path.join(ROOT, "cv", "cv.md")
PREFS_PATH = os.path.join(ROOT, "preferences.md")
PREFS_EXAMPLE_PATH = os.path.join(ROOT, "preferences.example.md")
ONBOARDING_PATH = os.path.join(ROOT, "data", "onboarding.json")

RESERVED = {"cover-letter", "cv"}  # non-job files inside a company folder

# Job and question ids become file names (queue/pending/<id>.json, ...). Ours
# are hex hashes; anything else (e.g. "../x" in an imported export) must never
# reach a path.
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def is_safe_id(value) -> bool:
    return isinstance(value, str) and bool(_SAFE_ID_RE.match(value))

INSTRUCTIONS = (
    "Group all pending jobs BY COMPANY. For each company write ONE applications/<slug>/"
    "cover-letter.md reused across its roles (Sami's voice per preferences_markdown; personal, "
    "direct, no bullshit, 1-2 points max, ~120-200 words, match the job language). Only write "
    "applications/<slug>/cv.md if the base CV genuinely needs changes for that company; otherwise "
    "do not create it (the base CV is used as-is). For each job write applications/<slug>/"
    "<job_id>.md (fit summary, short 'why apply' answer, match analysis, apply url). Never invent "
    "experience. Then delete the processed queue/pending/<job_id>.json files. See "
    ".claude/commands/apply.md for the exact template."
)


def read_preferences() -> str:
    """The user's preferences.md, falling back to the shipped example on a fresh clone."""
    return _read(PREFS_PATH) or _read(PREFS_EXAMPLE_PATH)


# --- full personal export/import (CV, prefs, generated materials, onboarding) ---
def export_materials() -> dict:
    """Every generated application file as {"<company>/<file>.md": content}."""
    out: dict = {}
    if not os.path.isdir(APPLICATIONS_DIR):
        return out
    for company in os.listdir(APPLICATIONS_DIR):
        cdir = os.path.join(APPLICATIONS_DIR, company)
        if not os.path.isdir(cdir):
            continue
        for fn in os.listdir(cdir):
            if fn.endswith(".md"):
                out[f"{company}/{fn}"] = _read(os.path.join(cdir, fn))
    return out


def write_materials(materials: dict) -> int:
    """Recreate generated application files from an export. Returns files written."""
    n = 0
    for rel, content in (materials or {}).items():
        rel = rel.replace("\\", "/")
        if ".." in rel or rel.startswith("/") or "/" not in rel:
            continue  # stay inside applications/<company>/<file>
        dest = os.path.join(APPLICATIONS_DIR, *rel.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(content or "")
        n += 1
    return n


def write_onboarding(data: dict) -> str:
    """Persist the new-user form (cities/experience/roles/…) for the /onboard command."""
    os.makedirs(os.path.dirname(ONBOARDING_PATH), exist_ok=True)
    with open(ONBOARDING_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return ONBOARDING_PATH


def read_onboarding() -> Optional[dict]:
    try:
        with open(ONBOARDING_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _read(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return ""


def write_pending(job: dict) -> str:
    os.makedirs(PENDING_DIR, exist_ok=True)
    payload = {
        "job": job,
        "company_slug": slugify(job.get("company", "")),
        "cv_markdown": _read(CV_PATH),
        "preferences_markdown": read_preferences(),
        "instructions": INSTRUCTIONS,
    }
    if not is_safe_id(job.get("id")):
        raise ValueError(f"unsafe job id: {job.get('id')!r}")
    path = os.path.join(PENDING_DIR, f"{job['id']}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path


def done_ids() -> Set[str]:
    """Job ids that have a generated per-job note under applications/<slug>/<id>.md."""
    ids: Set[str] = set()
    if not os.path.isdir(APPLICATIONS_DIR):
        return ids
    for company in os.listdir(APPLICATIONS_DIR):
        cdir = os.path.join(APPLICATIONS_DIR, company)
        if not os.path.isdir(cdir):
            continue
        for fn in os.listdir(cdir):
            if fn.endswith(".md") and fn[:-3] not in RESERVED:
                ids.add(fn[:-3])
    return ids


def _find_company_dir(job_id: str) -> Optional[str]:
    if not os.path.isdir(APPLICATIONS_DIR):
        return None
    for company in os.listdir(APPLICATIONS_DIR):
        cdir = os.path.join(APPLICATIONS_DIR, company)
        if os.path.isfile(os.path.join(cdir, f"{job_id}.md")):
            return cdir
    return None


def read_materials(job_id: str) -> Optional[str]:
    """Assemble the full package: per-job note + the company cover letter (+ CV variant)."""
    cdir = _find_company_dir(job_id)
    if cdir is None:
        return None
    parts = [_read(os.path.join(cdir, f"{job_id}.md"))]
    letter = _read(os.path.join(cdir, "cover-letter.md"))
    if letter:
        parts.append("\n\n---\n\n## Cover letter (shared for this company)\n\n" + letter)
    cv_variant = _read(os.path.join(cdir, "cv.md"))
    if cv_variant:
        parts.append("\n\n---\n\n## CV variant for this company\n\n" + cv_variant)
    return "".join(parts).strip() or None


def _split_sections(note: str) -> dict:
    """Split a per-job note markdown into {heading_key: body} by its '## ' headings."""
    sections: dict = {}
    key = None
    buf: list = []

    def _flush() -> None:
        if key is not None:
            sections[key] = "\n".join(buf).strip()

    for line in note.splitlines():
        if line.startswith("## "):
            _flush()
            key = line[3:].strip().lower()
            buf = []
        elif line.startswith("# "):
            continue  # title line
        elif key is not None:
            buf.append(line)
    _flush()
    return sections


QUESTION_INSTRUCTIONS = (
    "Sami is filling out a job application form and needs an answer to the application "
    "question in `question`. Write ONE answer in Sami's voice, following preferences_markdown "
    "strictly (first person, direct, confident, human, no bullshit, no em dashes, no defensive "
    "hedging, do not name tools he hasn't used). Ground it in cv_markdown (real projects and "
    "experience only, never invent). `references` lists the queued jobs Sami tagged with @ in his "
    "question (each with the job info AND any materials already generated for it: cover letter, "
    "short 'why apply' answer, fit summary). Use those references as context: tailor lightly to the "
    "tagged company/role, and if the question refers to existing material (e.g. 'rewrite this', "
    "'combine my answers'), work from the referenced materials. Stay general, do not over-research. "
    "Keep it tight and specific: aim for the length the question implies (a short-form answer "
    "~60-120 words unless it clearly wants more). Write the answer to "
    "queue/questions/answered/<id>.md (plain text, the answer only), then delete "
    "queue/questions/pending/<id>.json. See .claude/commands/answer.md for the exact template."
)


def write_question_pending(qid: str, question: str, jobs) -> str:
    """`jobs` is a list of job dicts the user @-referenced (may be empty)."""
    os.makedirs(Q_PENDING_DIR, exist_ok=True)
    references = []
    for job in (jobs or []):
        references.append({
            "job_id": job.get("id"), "title": job.get("title"), "company": job.get("company"),
            "role_family": job.get("role_family"), "city": job.get("city"),
            "sponsorship": job.get("sponsorship"),
            "description": (job.get("description") or "")[:1800],
            "materials": read_materials_structured(job.get("id")),
        })
    payload = {
        "id": qid,
        "question": question,
        "references": references,
        "companies": [r["company"] for r in references],
        "cv_markdown": _read(CV_PATH),
        "preferences_markdown": read_preferences(),
        "instructions": QUESTION_INSTRUCTIONS,
    }
    path = os.path.join(Q_PENDING_DIR, f"{qid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path


def read_answered_question(qid: str) -> Optional[str]:
    text = _read(os.path.join(Q_ANSWERED_DIR, f"{qid}.md")).strip()
    return text or None


def answered_question_ids() -> Set[str]:
    if not os.path.isdir(Q_ANSWERED_DIR):
        return set()
    return {fn[:-3] for fn in os.listdir(Q_ANSWERED_DIR) if fn.endswith(".md")}


def clear_question_files(qid: str) -> None:
    if not is_safe_id(qid):
        return
    for path in (os.path.join(Q_PENDING_DIR, f"{qid}.json"),
                 os.path.join(Q_ANSWERED_DIR, f"{qid}.md")):
        try:
            os.remove(path)
        except FileNotFoundError:
            pass


def read_materials_structured(job_id: str) -> Optional[dict]:
    """Structured package so the dashboard can render + copy individual pieces.

    Returns None if nothing has been generated yet.
    """
    cdir = _find_company_dir(job_id)
    if cdir is None:
        return None

    note = _read(os.path.join(cdir, f"{job_id}.md"))
    sections = _split_sections(note)

    short_form = None
    for k, v in sections.items():
        if k.startswith('"what brings you to apply') or k.startswith("what brings you to apply"):
            short_form = v
            break

    apply_txt = sections.get("apply", "").strip() or None

    letter = _read(os.path.join(cdir, "cover-letter.md")).strip() or None
    paragraphs = [p.strip() for p in letter.split("\n\n")] if letter else []
    paragraphs = [p for p in paragraphs if p]

    cv_variant = _read(os.path.join(cdir, "cv.md")).strip() or None

    return {
        "company_dir": os.path.basename(cdir),
        "fit_summary": sections.get("fit summary"),
        "short_form": short_form,
        "match_analysis": sections.get("match analysis"),
        "apply": apply_txt,
        "cover_letter": letter,
        "cover_letter_paragraphs": paragraphs,
        "cv_variant": cv_variant,
    }
