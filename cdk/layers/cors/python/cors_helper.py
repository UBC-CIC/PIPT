"""
CORS origin helper for Python Lambda functions.

Reads ALLOWED_ORIGINS from environment (comma-separated, supports wildcard subdomains).
Returns headers dict with the matching origin echoed back.
Falls back to "*" if ALLOWED_ORIGINS is not set.
"""

import os
import re

_raw = os.environ.get("ALLOWED_ORIGINS", "*")
_ALLOWED = [s.strip() for s in _raw.split(",") if s.strip()]


def get_cors_headers(event):
    """Build CORS headers dict for a Lambda proxy response."""
    origin = (event.get("headers") or {}).get("origin") or (event.get("headers") or {}).get("Origin") or ""
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": _resolve_origin(origin),
        "Access-Control-Allow-Methods": "*",
    }


def _resolve_origin(origin):
    if not _ALLOWED or "*" in _ALLOWED:
        return "*"
    if not origin:
        return _ALLOWED[0]
    for p in _ALLOWED:
        if "*" in p:
            regex = "^" + re.escape(p).replace(r"\*", ".+") + "$"
            if re.match(regex, origin):
                return origin
        elif p == origin:
            return origin
    return _ALLOWED[0]
