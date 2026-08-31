"""Stage 2a: Deterministic deduplication.

Two rounds:
  1. DOI-based dedup (case-insensitive, whitespace-normalised).
  2. Title-normalisation dedup for records without DOI, using both
     Levenshtein distance <= 5 and Jaccard token similarity >= 0.9.

Input:  a JSONL file of raw records, one per line, with fields:
        record_id, title, doi (optional), authors, year, venue, abstract.
Output: deduped_records.jsonl (unique canonical records)
        dedup_log.csv (for every collapsed record, which canonical it merged into)

Usage:
    python dedup.py --in raw_records.jsonl \\
                    --out deduped_records.jsonl \\
                    --log dedup_log.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


def normalise_doi(doi: str | None) -> str:
    if not doi:
        return ""
    return re.sub(r"\s+", "", doi.strip().lower())


def normalise_title(title: str | None) -> str:
    if not title:
        return ""
    t = re.sub(r"[^a-z0-9\s]", " ", title.lower())
    t = re.sub(r"\s+", " ", t).strip()
    return t


def title_tokens(title_norm: str) -> set[str]:
    return {t for t in title_norm.split() if len(t) > 2}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def levenshtein(a: str, b: str, cap: int = 6) -> int:
    """Small-alphabet Levenshtein with an early-exit cap.
    Returns cap if the real distance is >= cap."""
    if abs(len(a) - len(b)) >= cap:
        return cap
    if not a:
        return min(len(b), cap)
    if not b:
        return min(len(a), cap)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        cur = [i + 1]
        for j, cb in enumerate(b):
            cost = 0 if ca == cb else 1
            cur.append(min(cur[-1] + 1, prev[j + 1] + 1, prev[j] + cost))
        if min(cur) >= cap:
            return cap
        prev = cur
    return min(prev[-1], cap)


def dedupe(records: list[dict]) -> tuple[list[dict], list[dict]]:
    """Return (canonical_records, dedup_log_rows)."""
    canonical: list[dict] = []
    log: list[dict] = []

    # Round 1: DOI-keyed
    by_doi: dict[str, dict] = {}
    no_doi: list[dict] = []
    for r in records:
        d = normalise_doi(r.get("doi"))
        if d:
            if d in by_doi:
                log.append({
                    "collapsed_record_id": r["record_id"],
                    "canonical_record_id": by_doi[d]["record_id"],
                    "reason": "same_doi",
                })
            else:
                by_doi[d] = r
        else:
            no_doi.append(r)

    round1_canon = list(by_doi.values())

    # Round 2: title-normalisation dedup on no_doi + newly-canonical.
    # Compare each no_doi candidate to (a) the round-1 canonicals, (b)
    # previously-accepted no-doi canonicals.
    accepted_no_doi: list[dict] = []
    all_canon_titles = [
        (r, normalise_title(r["title"]), title_tokens(normalise_title(r["title"])))
        for r in round1_canon
    ]
    for r in no_doi:
        t = normalise_title(r["title"])
        tok = title_tokens(t)
        matched = None
        # check against round-1
        for canon, canon_t, canon_tok in all_canon_titles:
            if jaccard(tok, canon_tok) >= 0.9 or levenshtein(t, canon_t) <= 5:
                matched = canon
                break
        if matched is None:
            for canon in accepted_no_doi:
                canon_t = normalise_title(canon["title"])
                canon_tok = title_tokens(canon_t)
                if jaccard(tok, canon_tok) >= 0.9 or levenshtein(t, canon_t) <= 5:
                    matched = canon
                    break
        if matched is not None:
            log.append({
                "collapsed_record_id": r["record_id"],
                "canonical_record_id": matched["record_id"],
                "reason": "same_title",
            })
        else:
            accepted_no_doi.append(r)
            all_canon_titles.append((r, t, tok))

    canonical = round1_canon + accepted_no_doi
    return canonical, log


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="input", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--log", required=True)
    args = ap.parse_args()

    records = [json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()]
    canonical, log = dedupe(records)

    Path(args.out).write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in canonical) + "\n",
        encoding="utf-8",
    )
    with open(args.log, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["collapsed_record_id", "canonical_record_id", "reason"])
        w.writeheader()
        w.writerows(log)

    print(f"input records:       {len(records)}")
    print(f"canonical (unique):  {len(canonical)}")
    print(f"duplicates removed:  {len(log)}")


if __name__ == "__main__":
    main()
