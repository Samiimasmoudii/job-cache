import os
import tempfile
import unittest
from unittest.mock import patch

import app as app_module
import db
import queue_io


class TestImport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        db_path = os.path.join(self.tmp, "t.db")
        conn = db.connect(db_path)
        db.init_db(conn)
        conn.close()
        self.db_path = db_path
        self.patches = [
            patch.object(app_module, "_conn", lambda: db.connect(db_path)),
            patch.object(app_module, "CONFIG_PATH", os.path.join(self.tmp, "config.json")),
            patch.object(queue_io, "PENDING_DIR", os.path.join(self.tmp, "queue", "pending")),
            patch.object(queue_io, "APPLICATIONS_DIR", os.path.join(self.tmp, "applications")),
            patch.object(queue_io, "CV_PATH", os.path.join(self.tmp, "cv.md")),
            patch.object(queue_io, "PREFS_PATH", os.path.join(self.tmp, "preferences.md")),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def _export(self):
        return app_module.ImportBody(
            jobs=[{"id": "abc123", "company": "Acme", "title": "ML Engineer", "status": "queued",
                   "posted_at": "1790769328"}],
            events=[{"ts": "2026-09-01T00:00:00+00:00", "job_id": "abc123", "action": "queue",
                     "features": {"company": "Acme"}}],
            questions=[{"id": "q1", "question": "Why?", "answer": "Because", "status": "answered"}],
        )

    def _count(self, table):
        conn = db.connect(self.db_path)
        try:
            return conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        finally:
            conn.close()

    def test_reimporting_the_same_export_does_not_duplicate_events(self):
        first = app_module.import_all(self._export())
        second = app_module.import_all(self._export())
        self.assertEqual((first["events"], second["events"]), (1, 0))
        self.assertEqual(self._count("events"), 1)
        self.assertEqual(self._count("jobs"), 1)
        self.assertEqual(self._count("questions"), 1)

    def test_imported_dates_are_normalized(self):
        app_module.import_all(self._export())
        conn = db.connect(self.db_path)
        self.assertEqual(db.get_job(conn, "abc123")["posted_at"], "2026-09-30T11:55:28+00:00")
        conn.close()

    def test_unsafe_or_missing_ids_are_skipped(self):
        body = app_module.ImportBody(
            jobs=[{"id": "../../evil", "company": "X", "title": "t", "status": "queued"},
                  {"company": "X", "title": "no id"}],
            questions=[{"id": "../q", "question": "?"}, {"question": "no id"}],
        )
        res = app_module.import_all(body)
        self.assertEqual((res["added"], res["skipped"], res["questions"]), (0, 2, 0))
        self.assertEqual(self._count("jobs"), 0)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "evil.json")))

    def test_queued_job_gets_its_pending_file(self):
        res = app_module.import_all(self._export())
        self.assertEqual(res["requeued"], 1)
        self.assertTrue(os.path.isfile(os.path.join(queue_io.PENDING_DIR, "abc123.json")))


class TestSafeId(unittest.TestCase):
    def test_write_pending_rejects_path_ids(self):
        with self.assertRaises(ValueError):
            queue_io.write_pending({"id": "../x", "company": "Acme"})

    def test_is_safe_id(self):
        self.assertTrue(queue_io.is_safe_id("0004f5b09e910089"))
        for bad in ("", "../x", "a/b", "a\\b", None, 5, "x" * 65):
            self.assertFalse(queue_io.is_safe_id(bad), bad)


if __name__ == "__main__":
    unittest.main()
