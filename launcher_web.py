"""
launcher_web.py
Entry point for the HEMOSCOREAPP standalone web exe.

Starts the FastAPI + uvicorn server (which also serves the Next.js static
frontend), waits until the port is open, then opens the default browser to
http://localhost:8000.  The process stays alive until the terminal window is
closed, which shuts down uvicorn.
"""

from __future__ import annotations

import io
import logging
import os
import socket
import sys
import threading
import time
import webbrowser

# ── Fix for PyInstaller windowed mode: stdout/stderr are None ─────────────────
# uvicorn's logging calls sys.stdout.isatty() which crashes if stdout is None.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

# ── Logging: suppress uvicorn's access log noise ──────────────────────────────
logging.basicConfig(level=logging.WARNING)

_PORT = 8000
_URL = f"http://localhost:{_PORT}"


# ── Frozen-mode: pre-inject backend config as app.config before any import ────
# backend/app/core/__init__.py handles this, but ensure it is already in
# sys.modules so later imports don't trigger the file-based loader path.
if getattr(sys, "frozen", False) and "app.config" not in sys.modules:
    import importlib as _il
    import backend.app.config as _bcfg  # noqa: E402
    sys.modules["app.config"] = _bcfg


# ── Browser opener ────────────────────────────────────────────────────────────

def _wait_and_open() -> None:
    """Poll until the server accepts connections, then launch the browser."""
    for _ in range(60):           # wait up to 30 s
        try:
            with socket.create_connection(("127.0.0.1", _PORT), timeout=0.5):
                break
        except OSError:
            time.sleep(0.5)
    webbrowser.open(_URL)


threading.Thread(target=_wait_and_open, daemon=True).start()


# ── Start server ──────────────────────────────────────────────────────────────
import uvicorn  # noqa: E402

# Import the app object directly so PyInstaller's static analyser can trace
# all transitive imports during the build phase.
from backend.app.main import app as _fastapi_app  # noqa: E402

uvicorn.run(
    _fastapi_app,
    host="127.0.0.1",
    port=_PORT,
    log_level="warning",
)
