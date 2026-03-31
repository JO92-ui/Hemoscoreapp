"""
app/utils/file_io.py
File I/O utilities: JSON, CSV, Excel.

All public functions accept paths as str or pathlib.Path.
Parent directories are created automatically on write operations.
Excel support requires pandas + openpyxl (imported lazily so the rest
of the app works even if those packages are absent).
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any


# ──────────────────────────────────────────────────────────────────────────────
# JSON
# ──────────────────────────────────────────────────────────────────────────────

def load_json(path: str | Path) -> Any:
    """Load and return the parsed content of a JSON file.

    Args:
        path: Absolute or relative path to the .json file.

    Returns:
        The deserialized Python object (dict, list, …).

    Raises:
        FileNotFoundError: If *path* does not exist.
        json.JSONDecodeError: If the file is not valid JSON.
    """
    with open(Path(path), "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(data: Any, path: str | Path, *, indent: int = 2) -> None:
    """Serialize *data* to a JSON file.

    Args:
        data:   Any JSON-serializable Python object.
        path:   Destination file path. Parent directories are created if needed.
        indent: Pretty-print indentation level (default 2).
    """
    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=indent)


# ──────────────────────────────────────────────────────────────────────────────
# CSV
# ──────────────────────────────────────────────────────────────────────────────

def load_csv(path: str | Path) -> list[dict[str, str]]:
    """Load a CSV file and return a list of row dictionaries.

    Uses csv.DictReader; values are raw strings.
    Handles UTF-8 BOM (utf-8-sig) produced by Excel.

    Args:
        path: Path to the .csv file.

    Returns:
        List of dicts mapping column name → cell value (string).
    """
    with open(Path(path), newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        return [dict(row) for row in reader]


def save_csv(
    rows: list[dict[str, Any]],
    path: str | Path,
    *,
    fieldnames: list[str] | None = None,
) -> None:
    """Write a list of dicts to a CSV file.

    Args:
        rows:       List of dicts to write; all dicts should share the same keys.
        path:       Destination file path. Parent directories are created if needed.
        fieldnames: Explicit column order. Inferred from the first row if omitted.
    """
    if not rows:
        return

    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cols = fieldnames or list(rows[0].keys())

    with open(dest, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


# ──────────────────────────────────────────────────────────────────────────────
# Excel  (pandas + openpyxl, imported lazily)
# ──────────────────────────────────────────────────────────────────────────────

def load_excel(
    path: str | Path,
    *,
    sheet_name: str | int = 0,
) -> list[dict[str, Any]]:
    """Load an Excel worksheet and return a list of row dicts.

    The first row is treated as the column header.
    Empty cells are returned as empty-string "".

    Args:
        path:       Path to the .xlsx (or .xls) file.
        sheet_name: Sheet name or 0-based integer index (default: first sheet).

    Returns:
        List of dicts mapping column name → cell value.

    Raises:
        ImportError: If pandas or openpyxl is not installed.
    """
    import pandas as pd  # noqa: PLC0415

    df = pd.read_excel(Path(path), sheet_name=sheet_name, dtype=str)
    df.fillna("", inplace=True)
    return df.to_dict(orient="records")


def save_excel(
    rows: list[dict[str, Any]],
    path: str | Path,
    *,
    sheet_name: str = "Report",
    fieldnames: list[str] | None = None,
) -> None:
    """Write a list of dicts to an Excel (.xlsx) file.

    Args:
        rows:       List of dicts to write.
        path:       Destination file path. Parent directories are created if needed.
        sheet_name: Name of the worksheet (default "Report").
        fieldnames: Explicit column order. Inferred from data if omitted.

    Raises:
        ImportError: If pandas or openpyxl is not installed.
    """
    import pandas as pd  # noqa: PLC0415

    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cols = fieldnames or (list(rows[0].keys()) if rows else [])
    df = pd.DataFrame(rows, columns=cols)
    df.to_excel(dest, sheet_name=sheet_name, index=False, engine="openpyxl")
