import os
import tempfile
import unittest

import db
import harvester
from models import Job
from normalize import normalize_posted_at


class TestNormalizePostedAt(unittest.TestCase):
    def test_every_adapter_shape_becomes_canonical_utc(self):
        cases = {
            "1790769328": "2026-09-30T11:55:28+00:00",          # epoch seconds (Arbeitnow, Himalayas)
            "1790692062003": "2026-09-29T14:27:42+00:00",       # epoch millis (Lever)
            "2026-09-30T08:49:54-04:00": "2026-09-30T12:49:54+00:00",  # offset (Greenhouse)
            "2026-09-30T11:13:31.592Z": "2026-09-30T11:13:31+00:00",   # Z + millis (SmartRecruiters)
            "2026-08-19T12:12:11": "2026-08-19T12:12:11+00:00",  # naive (Remotive) -> assumed UTC
            "2026-05-29": "2026-05-29T00:00:00+00:00",           # bare date (Workable)
        }
        for raw, expected in cases.items():
            self.assertEqual(normalize_posted_at(raw), expected, raw)

    def test_unparseable_and_empty_become_none(self):
        for raw in (None, "", "   ", "yesterday", "99999999999999999999999"):
            self.assertIsNone(normalize_posted_at(raw), raw)

    def test_normalized_values_sort_chronologically_as_text(self):
        raws = ["1790692062003", "2026-01-05", "1767225600", "2026-09-30T08:49:54-04:00"]
        as_text = sorted(normalize_posted_at(r) for r in raws)
        self.assertEqual(as_text, [normalize_posted_at(r) for r in
                                   ["1767225600", "2026-01-05", "1790692062003", "2026-09-30T08:49:54-04:00"]])

    def test_enrich_normalizes(self):
        job = Job(company="Acme", ats_type="lever", ats_job_id="1", title="Data Engineer",
                  location_raw="Paris", description="", apply_url="https://x",
                  posted_at="1790692062003", is_startup=False)
        harvester.enrich(job)
        self.assertEqual(job.posted_at, "2026-09-29T14:27:42+00:00")


class TestDateMigration(unittest.TestCase):
    def test_init_db_rewrites_old_dates_and_is_idempotent(self):
        conn = db.connect(os.path.join(tempfile.mkdtemp(), "t.db"))
        db.init_db(conn)
        conn.executemany("INSERT INTO jobs (id, company, title, posted_at) VALUES (?,?,?,?)",
                         [("a", "X", "t", "1790769328"), ("b", "X", "t", "2026-05-29"),
                          ("c", "X", "t", "2026-09-01T00:00:00+00:00"), ("d", "X", "t", None)])
        conn.commit()
        db.init_db(conn)
        got = dict(conn.execute("SELECT id, posted_at FROM jobs").fetchall())
        self.assertEqual(got, {"a": "2026-09-30T11:55:28+00:00", "b": "2026-05-29T00:00:00+00:00",
                               "c": "2026-09-01T00:00:00+00:00", "d": None})
        self.assertEqual(db.normalize_posted_dates(conn), 0)
        conn.close()


if __name__ == "__main__":
    unittest.main()
