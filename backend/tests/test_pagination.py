import unittest
from unittest.mock import patch

from adapters import smartrecruiters, workday


def _wd_posting(i):
    return {"title": f"Engineer {i}", "externalPath": f"/job/{i}",
            "bulletFields": [f"R{i}"], "locationsText": "Paris"}


class TestWorkdayPagination(unittest.TestCase):
    COMPANY = {"name": "Acme", "ats_slug": "acme.wd3.myworkdayjobs.com|acme|External"}

    def test_walks_every_page(self):
        calls = []

        def fake_post(url, payload, **kw):
            calls.append(payload["offset"])
            start = payload["offset"]
            batch = [_wd_posting(i) for i in range(start, min(start + 20, 45))]
            # Workday only reports the real total on the first page.
            return {"total": 45 if start == 0 else 0, "jobPostings": batch}

        with patch.object(workday, "post_json", side_effect=fake_post):
            jobs = workday.fetch(self.COMPANY)
        self.assertEqual(len(jobs), 45)
        self.assertEqual(calls, [0, 20, 40])
        self.assertEqual(len({j.ats_job_id for j in jobs}), 45)

    def test_stops_on_empty_page(self):
        with patch.object(workday, "post_json",
                          return_value={"total": 100, "jobPostings": []}) as m:
            self.assertEqual(workday.fetch(self.COMPANY), [])
        self.assertEqual(m.call_count, 1)


class TestSmartRecruitersPagination(unittest.TestCase):
    COMPANY = {"name": "Acme", "ats_slug": "acme"}

    def test_walks_every_page(self):
        urls = []

        def fake_get(url, **kw):
            urls.append(url)
            offset = int(url.split("offset=")[1])
            batch = [{"id": i, "name": f"Role {i}", "location": {"city": "Paris"}}
                     for i in range(offset, min(offset + 100, 230))]
            return {"totalFound": 230, "content": batch}

        with patch.object(smartrecruiters, "get_json", side_effect=fake_get), \
                patch.object(smartrecruiters, "_description", return_value=""):
            jobs = smartrecruiters.fetch(self.COMPANY)
        self.assertEqual(len(jobs), 230)
        self.assertEqual(len(urls), 3)
        self.assertTrue(urls[-1].endswith("offset=200"))


if __name__ == "__main__":
    unittest.main()
