"""Harvest orchestrator: companies.yaml -> adapters -> enrich -> filter -> SQLite."""
from __future__ import annotations

import os
import sys
from typing import List, Optional

import yaml

from adapters import AGGREGATORS, fetch_company
from flagger import classify_sponsorship
from models import Job
from normalize import classify_city, classify_role_family, normalize_posted_at
from ranker import score_job
from seniority import classify_seniority, extract_required_years
import db
import prefs as prefs_mod

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPANIES_PATH = os.path.join(ROOT, "companies.yaml")


def load_companies(path: Optional[str] = None) -> List[dict]:
    """Every source to harvest: the curated per-company ATS list plus the keyless
    aggregator boards (each aggregator entry fans out to many employers)."""
    with open(path or COMPANIES_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return (data.get("companies", []) or []) + (data.get("sources", []) or [])


def _is_aggregator(company: dict) -> bool:
    return bool(company.get("aggregator")) or (company.get("ats_type") or "").lower() in AGGREGATORS


def enrich(job: Job, extra_keywords: Optional[List[str]] = None) -> Job:
    job.posted_at = normalize_posted_at(job.posted_at)
    job.city = classify_city(job.location_raw)
    job.role_family = classify_role_family(job.title, job.description)
    job.sponsorship = classify_sponsorship(job.description)
    job.seniority = classify_seniority(job.title, job.description)
    job.req_years = extract_required_years(job.description)
    job.match_score, job.match_reasons = score_job(
        job.title, job.description, job.posted_at, extra_skills=extra_keywords)
    return job


def keep(job: Job, prefs: Optional[dict] = None) -> bool:
    """A job is kept when its location and role family are both in the user's
    search preferences. `prefs=None` means the broadest search (keep every
    supported location and role family)."""
    prefs = prefs if prefs is not None else prefs_mod.DEFAULTS
    return (job.city in prefs_mod.target_locations(prefs)
            and job.role_family in prefs_mod.target_role_families(prefs))


def harvest(conn, companies: Optional[List[dict]] = None, verbose: bool = True) -> dict:
    companies = companies if companies is not None else load_companies()
    prefs = prefs_mod.load_structured()
    extra_kw = prefs_mod.extra_keywords(prefs)
    db.init_db(conn)
    summary = {"companies": 0, "fetched": 0, "kept": 0, "errors": []}

    for company in companies:
        name = company.get("name", "?")
        summary["companies"] += 1
        try:
            raw = fetch_company(company)
        except Exception as e:  # noqa: BLE001 - one bad source must not abort the run
            summary["errors"].append(f"{name} ({company.get('ats_type')}): {e}")
            if verbose:
                print(f"  ! {name}: {e}", file=sys.stderr)
            continue

        summary["fetched"] += len(raw)
        kept: List[Job] = []
        for job in raw:
            enrich(job, extra_kw)
            if keep(job, prefs):
                kept.append(job)

        db.upsert_jobs(conn, kept)
        # Only single-company ATS boards own their full job set, so only they can
        # safely close roles that disappeared. Aggregators return an employer per
        # posting, not one company, so we never auto-close from them.
        if not _is_aggregator(company):
            db.mark_closed(conn, name, [j.id for j in kept])
        summary["kept"] += len(kept)
        if verbose:
            print(f"  + {name}: {len(kept)} kept / {len(raw)} fetched")

    return summary


def main() -> None:
    conn = db.connect()
    print("Harvesting jobs...")
    summary = harvest(conn)
    print(f"\nDone. {summary['kept']} relevant jobs from {summary['companies']} companies "
          f"({summary['fetched']} fetched, {len(summary['errors'])} errors).")
    conn.close()


if __name__ == "__main__":
    main()
