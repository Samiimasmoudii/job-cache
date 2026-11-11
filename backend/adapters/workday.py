"""Workday CxS endpoint (best-effort). Per-tenant; skipped cleanly when unavailable.

Config: ats_slug encodes "host|tenant|board", e.g.
  "company.wd3.myworkdayjobs.com|company|External"
"""
from __future__ import annotations

from typing import List

from http_util import post_json
from models import Job

ENDPOINT = "https://{host}/wday/cxs/{tenant}/{board}/jobs"
# Workday's CxS API caps a page at 20 postings. Walk every page: this is a
# single-company board, so the harvester closes any posting missing from what
# we return — stopping at page 1 would close everything past the first 20.
PAGE_SIZE = 20
MAX_PAGES = 100  # safety cap (2,000 postings)


def _parse_slug(ats_slug: str):
    parts = [p.strip() for p in ats_slug.split("|")]
    if len(parts) != 3:
        raise ValueError(
            "workday ats_slug must be 'host|tenant|board', got: " + ats_slug)
    return parts[0], parts[1], parts[2]


def parse(company: dict, host: str, payload: dict) -> List[Job]:
    jobs: List[Job] = []
    for j in payload.get("jobPostings", []) or []:
        path = j.get("externalPath", "") or ""
        apply_url = f"https://{host}{path}" if path else ""
        jobs.append(Job(
            company=company["name"],
            ats_type="workday",
            ats_job_id=str(j.get("bulletFields", [path])[0] if j.get("bulletFields") else path),
            title=j.get("title", "") or "",
            location_raw=j.get("locationsText", "") or "",
            description="",  # Workday hides descriptions behind per-job detail calls; title-only.
            apply_url=apply_url,
            posted_at=None,
            is_startup=bool(company.get("is_startup")),
        ))
    return jobs


def fetch(company: dict) -> List[Job]:
    host, tenant, board = _parse_slug(company["ats_slug"])
    url = ENDPOINT.format(host=host, tenant=tenant, board=board)
    postings: list = []
    total = None
    for _ in range(MAX_PAGES):
        payload = post_json(url, {"limit": PAGE_SIZE, "offset": len(postings),
                                  "searchText": "", "appliedFacets": {}})
        batch = payload.get("jobPostings") or []
        # Workday only reports the real total on the first page (later pages say 0).
        if total is None:
            total = int(payload.get("total") or 0)
        postings.extend(batch)
        if not batch or len(postings) >= total:
            break
    return parse(company, host, {"jobPostings": postings})
