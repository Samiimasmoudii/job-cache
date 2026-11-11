import json
import unittest
from email.message import Message
from unittest.mock import patch, MagicMock

import app as app_module


def _headers(**kv):
    m = Message()
    for k, v in kv.items():
        m[k] = v
    return m


class TestFrameBlocked(unittest.TestCase):
    def test_no_headers_is_not_blocked(self):
        self.assertFalse(app_module._frame_blocked(_headers()))

    def test_x_frame_options_deny_is_blocked(self):
        self.assertTrue(app_module._frame_blocked(_headers(**{"X-Frame-Options": "DENY"})))

    def test_x_frame_options_sameorigin_is_blocked(self):
        self.assertTrue(app_module._frame_blocked(_headers(**{"X-Frame-Options": "SAMEORIGIN"})))

    def test_csp_frame_ancestors_wildcard_overrides_deny(self):
        # Ashby: X-Frame-Options: DENY but CSP frame-ancestors *  ->  embeddable.
        self.assertFalse(app_module._frame_blocked(_headers(**{
            "X-Frame-Options": "DENY",
            "Content-Security-Policy": "default-src 'self'; frame-ancestors *;",
        })))

    def test_csp_frame_ancestors_restrictive_is_blocked(self):
        self.assertTrue(app_module._frame_blocked(_headers(**{
            "Content-Security-Policy": "frame-ancestors 'self';",
        })))

    def test_report_only_csp_is_ignored(self):
        # Workday: only a Report-Only CSP (no frame-ancestors enforced) + XFO DENY -> blocked via XFO.
        self.assertTrue(app_module._frame_blocked(_headers(**{
            "X-Frame-Options": "DENY",
            "Content-Security-Policy-Report-Only": "frame-ancestors *;",
        })))


class TestProxyEndpoint(unittest.TestCase):
    def _mock_response(self, headers, body=b"<html><head></head><body>hi</body></html>"):
        resp = MagicMock()
        resp.headers = headers
        resp.read.return_value = body
        resp.__enter__.return_value = resp
        resp.__exit__.return_value = False
        return resp

    def test_bad_url_rejected(self):
        with self.assertRaises(Exception):
            app_module.proxy("not-a-url")

    def test_unblocked_site_returns_direct_mode(self):
        headers = _headers(**{"Content-Type": "text/html"})
        with patch("urllib.request.urlopen", return_value=self._mock_response(headers)):
            resp = app_module.proxy("https://jobs.lever.co/acme/1")
        body = json.loads(bytes(resp.body))
        self.assertTrue(body["ok"])
        self.assertEqual(body["mode"], "direct")
        self.assertNotIn("html", body)

    def test_blocked_site_returns_proxy_mode_with_html(self):
        headers = _headers(**{"Content-Type": "text/html", "X-Frame-Options": "DENY"})
        with patch("urllib.request.urlopen", return_value=self._mock_response(headers)):
            resp = app_module.proxy("https://acme.wd5.myworkdayjobs.com/en-US/careers/job/1")
        body = json.loads(bytes(resp.body))
        self.assertTrue(body["ok"])
        self.assertEqual(body["mode"], "proxy")
        self.assertIn("<base href=", body["html"])

    def test_non_html_response_is_an_error(self):
        headers = _headers(**{"Content-Type": "application/json"})
        with patch("urllib.request.urlopen", return_value=self._mock_response(headers)):
            resp = app_module.proxy("https://example.com/not-html")
        self.assertEqual(resp.status_code, 502)
        body = json.loads(bytes(resp.body))
        self.assertFalse(body["ok"])


if __name__ == "__main__":
    unittest.main()
