"""Stage 2b: Deterministic hard filters.

Four boolean gates, each with an exclusion code:
  H1  Date range: publication year 2018-2026 (transformer era). W3 anchor
      records exempt via --exempt-collection.
  H2  Language: English (records with >= 10% non-Latin abstract chars
      are flagged, not excluded, and forwarded to LLM adjudication).
  H3  Venue integrity: peer-reviewed journal, peer-reviewed conference,
      or indexed preprint server (arXiv, SSRN, OSF).
  H4  Item type: research article, systematic review, theoretical
      contribution, empirical study.

Input:  deduped_records.jsonl
Output: hard_filtered_records.jsonl (records passing all gates OR flagged
        for adjudication)
        hard_filter_exclusions.csv (excluded records keyed by rule code)

Usage:
    python hard_filters.py --in deduped_records.jsonl \\
                           --out hard_filtered_records.jsonl \\
                           --log hard_filter_exclusions.csv \\
                           --min-year 2018 --max-year 2026
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


PREPRINT_HOSTS = ("arxiv", "ssrn", "osf", "preprints.org", "biorxiv", "chemrxiv")
NON_SCHOLARLY_HINTS = (
    "medium.com", "dev.to", "hackernoon", "substack",
    "linkedin", "youtube", "blogspot", "github pages",
)
BAD_ITEM_TYPES = {"editorial", "letter", "book review", "call for papers",
                  "corrigendum", "erratum", "blog", "webinar", "press release"}


def latin_ratio(text: str) -> float:
    if not text:
        return 1.0
    latin = sum(1 for c in text if c.isalpha() and c.isascii())
    total = sum(1 for c in text if c.isalpha())
    return latin / total if total else 1.0


def in_year_range(rec: dict, min_year: int, max_year: int) -> bool:
    y = rec.get("year")
    if y is None:
        return False
    try:
        y = int(y)
    except (TypeError, ValueError):
        return False
    return min_year <= y <= max_year


def language_ok(rec: dict) -> tuple[bool, bool]:
    """Return (auto_exclude, needs_adjudication)."""
    abstract = rec.get("abstract") or ""
    lr = latin_ratio(abstract)
    if lr >= 0.9:
        return False, False
    if 0.8 <= lr < 0.9:
        return False, True
    return True, False


def venue_ok(rec: dict) -> bool:
    v = (rec.get("venue") or "").lower()
    if not v:
        # No venue string; keep and let adjudication catch it.
        return True
    if any(host in v for host in PREPRINT_HOSTS):
        return True
    if any(bad in v for bad in NON_SCHOLARLY_HINTS):
        return False
    # Any journal or conference name typically has "journal", "conf",
    # "proc", "acm", "ieee", "springer", "elsevier", or similar.
    scholarly_hints = ("journal", "conf", "proc", "acm", "ieee", "springer",
                       "elsevier", "wiley", "sage", "mit press", "acm queue")
    return any(h in v for h in scholarly_hints)


def item_type_ok(rec: dict) -> bool:
    t = (rec.get("item_type") or "").lower()
    if not t:
        return True
    return t not in BAD_ITEM_TYPES


def filter_records(records: list[dict], min_year: int, max_year: int, exempt_ids: set[str]) -> tuple[list[dict], list[dict]]:
    kept: list[dict] = []
    exclusions: list[dict] = []
    for r in records:
        rid = r["record_id"]
        exempt = rid in exempt_ids
        reasons: list[str] = []
        needs_adj = False
        if not exempt and not in_year_range(r, min_year, max_year):
            reasons.append("H1_year")
        auto_ex, adj = language_ok(r)
        if auto_ex:
            reasons.append("H2_non_latin")
        if adj:
            needs_adj = True
        if not venue_ok(r):
            reasons.append("H3_venue")
        if not item_type_ok(r):
            reasons.append("H4_item_type")

        if reasons and not needs_adj:
            exclusions.append({
                "record_id": rid,
                "title": r.get("title", "")[:200],
                "exclusion_codes": "|".join(reasons),
            })
        else:
            r2 = dict(r)
            r2["needs_adjudication_hint"] = needs_adj
            kept.append(r2)
    return kept, exclusions


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="input", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--log", required=True)
    ap.add_argument("--min-year", type=int, default=2018)
    ap.add_argument("--max-year", type=int, default=2026)
    ap.add_argument("--exempt-ids", default="",
                    help="Comma-separated record ids exempt from H1 (W3 seminal anchors).")
    args = ap.parse_args()

    exempt = {x.strip() for x in args.exempt_ids.split(",") if x.strip()}
    records = [json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()]
    kept, exclusions = filter_records(records, args.min_year, args.max_year, exempt)

    Path(args.out).write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in kept) + "\n",
        encoding="utf-8",
    )
    with open(args.log, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["record_id", "title", "exclusion_codes"])
        w.writeheader()
        w.writerows(exclusions)

    print(f"input records:      {len(records)}")
    print(f"passed hard gates:  {len(kept)}")
    print(f"excluded:           {len(exclusions)}")
    from collections import Counter
    reasons = Counter()
    for e in exclusions:
        for code in e["exclusion_codes"].split("|"):
            reasons[code] += 1
    print("exclusion breakdown:")
    for k, v in sorted(reasons.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
