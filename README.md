# lit-screening

[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.22210843-blue)](https://doi.org/10.5281/zenodo.22210843)

Hybrid semi-automated screening pipeline for the ESGCI DBA thesis
literature review.

## Overview

This skill combines deterministic scripts with LLM adjudication to
reduce a large discovery pool (thousands of records from a
natural-language search platform) into a human-reviewable shortlist.

Three stages:

| Stage | What | Where |
|---|---|---|
| 2a  | DOI + title-normalisation deduplication | `scripts/dedup.py` |
| 2b  | Date, language, venue, item-type hard filters | `scripts/hard_filters.py` |
| 2c  | LLM adjudication (Claude Opus 4.7 via Copilot Chat) | `scripts/adjudicate.py` + `prompts/adjudication.md` |

Then a fourth script validates the whole pipeline against a
ground-truth set:

| Stage | What | Where |
|---|---|---|
| V   | Retrospective validation (sensitivity, specificity, F1) | `scripts/validate.py` |

## Quick start

```powershell
# Stage 2a: dedup
python scripts/dedup.py `
    --in raw_records.jsonl `
    --out deduped_records.jsonl `
    --log dedup_log.csv

# Stage 2b: hard filters
python scripts/hard_filters.py `
    --in deduped_records.jsonl `
    --out hard_filtered_records.jsonl `
    --log hard_filter_exclusions.csv `
    --min-year 2018 --max-year 2026

# Stage 2c: LLM adjudication (production backend)
python scripts/adjudicate.py `
    --in hard_filtered_records.jsonl `
    --out adjudicated_records.jsonl `
    --shortlist human_shortlist.csv `
    --backend copilot

# Validation
python scripts/validate.py `
    --decisions adjudicated_records.jsonl `
    --ground-truth ground_truth.csv `
    --report validation_report.md `
    --backend-label copilot
```

## Backends

`adjudicate.py` supports two backends:

- **`copilot`** (production): each record is passed to Claude Opus 4.7
  through GitHub Copilot Chat in agent mode using the prompt pack under
  `prompts/adjudication.md`. Requires an active Copilot Chat session.
- **`heuristic`** (offline testing): a deterministic keyword-scoring
  backend that mirrors the LLM's interface (scores 0–10, class buckets,
  rationale strings) but scores on presence of scope-keywords in title
  and abstract. Not a substitute for the LLM in production.

The retention rule (forward to human if `relevance_score ≥ 6` OR
`predicted_class == "ambiguous"` OR `confidence == "low"`) is applied
identically regardless of backend.

## Ground-truth format

`ground_truth.csv` has two columns:

| Column | Values |
|---|---|
| record_id | matches the record_id used in the pipeline JSONL |
| ground_truth | `in_scope` \| `out_of_scope` |

For the thesis validation, the 125 items in the reviewer's Zotero pool
are labelled `in_scope` (they all passed title-and-abstract screening
by definition), plus 50 adversarial samples from unrelated domains are
labelled `out_of_scope`.

## Design notes

- **Reproducibility.** Model version, temperature, seed (where the API
  supports it), prompt-pack version, and script versions are recorded
  in every run's decision log.
- **Auditability.** Every excluded record carries the code of the rule
  that excluded it. Every retained record carries a scored rationale.
  A reviewer can pick any paper in the final corpus and trace it back
  to a specific query, decision, and rationale.
- **Bias mitigation.** The retention rule is inclusive (forward on
  ambiguity or low confidence) so that borderline items reach the human
  reviewer rather than being auto-excluded.
- **Prompt calibration.** Eight gold examples are embedded in the
  prompt pack; they represent the boundary cases (clear-in, clear-out,
  ambiguous). Any material change to the prompt pack requires a
  re-validation run against the ground truth.

## References

The pipeline is documented in Chapter 2 Section 2.2.4 of the thesis.
Appendix 2.C reproduces the SKILL.md, prompt pack, deterministic rule
set, and the validation report for the submission-time run.

## Licence

To be added on public release; the thesis-time internal copy is
governed by the reviewer's private workspace terms.
