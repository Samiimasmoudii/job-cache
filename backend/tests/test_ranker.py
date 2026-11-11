import unittest
from datetime import datetime, timezone

from ranker import _skills_overlap, score_job

NOW = datetime(2026, 9, 12, tzinfo=timezone.utc)


class TestRanker(unittest.TestCase):
    def test_relevant_beats_irrelevant(self):
        strong, _ = score_job(
            "Machine Learning Engineer",
            "Python, Spark, Kafka, LLM, RAG, Docker, Kubernetes, AWS ETL pipelines.",
            "2026-09-05T00:00:00Z",
        )
        weak, _ = score_job("Office Manager", "Manage the office and supplies.", "2026-09-05T00:00:00Z")
        self.assertGreater(strong, weak)
        self.assertGreater(strong, 0.5)

    def test_title_match_gives_reasons(self):
        score, reasons = score_job("Data Engineer", "Kafka and Spark pipelines.", "2026-09-01T00:00:00Z")
        self.assertGreater(score, 0.0)
        self.assertTrue(any("skills" in r.lower() or "role" in r.lower() for r in reasons))

    def test_score_bounded(self):
        score, _ = score_job("AI Engineer", "python " * 200, "2026-09-10T00:00:00Z")
        self.assertLessEqual(score, 1.0)
        self.assertGreaterEqual(score, 0.0)

    def test_recency_helps(self):
        # Fixed `now`, so the test doesn't go stale as the calendar moves on.
        recent, _ = score_job("Backend Engineer", "Python backend.", "2026-09-10T00:00:00Z", now=NOW)
        old, _ = score_job("Backend Engineer", "Python backend.", "2026-01-01T00:00:00Z", now=NOW)
        self.assertGreater(recent, old)

    def test_recency_understands_epoch_dates(self):
        recent, _ = score_job("Backend Engineer", "Python backend.", "1789430400", now=NOW)  # 2026-09-15
        old, _ = score_job("Backend Engineer", "Python backend.", "1767225600000", now=NOW)  # 2026-01-01 ms
        self.assertGreater(recent, old)


class TestSkillMatching(unittest.TestCase):
    def test_skills_match_whole_words_only(self):
        _, matched = _skills_overlap("We use JavaScript for rapid storage leverage")
        self.assertIn("javascript", matched)
        for false_hit in ("java", "api", "rag"):
            self.assertNotIn(false_hit, matched)

    def test_plurals_and_punctuation_still_match(self):
        _, matched = _skills_overlap("Build ETL pipelines, REST APIs (Python/SQL) and RAG.")
        for skill in ("etl", "pipeline", "api", "python", "sql", "rag"):
            self.assertIn(skill, matched)

    def test_symbol_skills_from_preferences(self):
        _, matched = _skills_overlap("Strong C++ and Node.js", extra_skills=["C++", "node.js", "c"])
        self.assertIn("c++", matched)
        self.assertIn("node.js", matched)
        self.assertNotIn("c", matched)


if __name__ == "__main__":
    unittest.main()
