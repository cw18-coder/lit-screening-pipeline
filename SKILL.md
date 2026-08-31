---
name: lit-screening
description: Hybrid semi-automated screening pipeline for a systematic literature review. Combines deterministic scripts (deduplication, hard filters on date/language/venue/item type) with LLM adjudication (Claude Opus 4.7 via GitHub Copilot Chat in agent mode) to reduce a raw discovery pool of thousands of records to a human-reviewable shortlist. Designed for the ESGCI DBA thesis literature review on AI-assisted software development but generalises to any focused systematic review with a well-defined scope. Skill returns per-record decisions with rationales, keyed to the source record identifier for full audit-trail reconstruction.
---

# lit-screening

## What this skill does

This skill implements Stages 2a, 2b, and 2c of the multi-stage screening
workflow documented in Section 2.2.4 of the ESGCI DBA thesis. It takes a pool
of raw literature records retrieved from a discovery channel (Consensus MCP
Server in the thesis case; adaptable to other channels) and produces a
shortlist of records for human title-and-abstract review, along with a full
decision log for every record.

## Pipeline stages

### Stage 2a — Deterministic deduplication

Script: `scripts/dedup.py`.

Two rounds:
1. DOI-based deduplication. Records with the same DOI (case-insensitive,
   whitespace-normalised) collapse to one canonical record.
2. Title-normalisation deduplication for records without DOI. Titles are
   lower-cased, punctuation stripped, whitespace collapsed. Levenshtein
   distance ≤ 5 characters or Jaccard similarity ≥ 0.9 on token sets
   triggers a duplicate collapse.

Output: `deduped_records.jsonl` with one JSON record per unique paper; an
audit CSV `dedup_log.csv` recording every collapsed record and the
canonical it merged into.

### Stage 2b — Deterministic hard filters

Script: `scripts/hard_filters.py`.

Four boolean gates, each documented as a discrete rule:

| Filter | Rule | Exclusion code |
|---|---|---|
| Date range | Publication year in 2018–2026 (transformer era). W3 anchor queries explicitly exempt. | H1 |
| Language | English. Records with non-Latin abstract characters ≥ 10% are flagged for LLM adjudication rather than auto-excluded. | H2 |
| Venue integrity | Peer-reviewed journal OR peer-reviewed conference OR indexed preprint server (arXiv, SSRN, OSF). Excludes vendor blogs, marketing whitepapers, non-scholarly aggregators. | H3 |
| Item type | Research article, systematic review, theoretical contribution, or empirical study. Excludes editorials, letters to editor, book reviews, calls for papers, corrigenda. | H4 |

Output: `hard_filtered_records.jsonl` (records that passed all four gates);
`hard_filter_exclusions.csv` (records excluded, keyed to the rule that
excluded them).

### Stage 2c — LLM adjudication

Script: `scripts/adjudicate.py` (orchestrator); prompt pack:
`prompts/adjudication.md`.

For each record that passed Stage 2b, invoke the LLM with a structured
prompt combining the record's title + abstract, the review scope, and the
seven-question adjudication rubric (see `prompts/adjudication.md`). LLM
returns structured JSON:

```json
{
  "record_id": "consensus-abc123",
  "relevance_score": 7,
  "predicted_class": "in_scope",
  "rationale": "Empirical study of AI-assisted code review effort on 300 GitHub OSS repositories; directly addresses Theme A (AI-generated code + code review effort).",
  "matched_theme": "A",
  "confidence": "high"
}
```

Retention rule: forward to human review if `relevance_score >= 6` OR
`predicted_class == "ambiguous"` OR `confidence == "low"`. Auto-exclude the
rest with the LLM's rationale logged.

Model configuration (locked for reproducibility):
- Model: Claude Opus 4.7 via GitHub Copilot Chat in agent mode
- Temperature: 0.1
- Max output tokens: 512 per record
- Seeded prompt with 8 gold calibration examples (see prompt pack)

Output: `adjudicated_records.jsonl` with one record per input, containing
the LLM's decision + rationale; `human_shortlist.csv` with the subset
retained for human review.

## Validation

Script: `scripts/validate.py`.

The pipeline is validated retrospectively against a ground-truth set: the
125 items already in the reviewer's Zotero pool (66 in-corpus + 53
excluded-at-full-text + 5 supplementary) plus 50 adversarial
out-of-scope samples pulled from unrelated domains (medical imaging LLM
applications, autonomous vehicle perception, generic NLP benchmarks).

Metrics reported:
- **Sensitivity** (recall on in-scope items): fraction of the ground-truth
  in-scope items that the LLM correctly forwards to human review. Target
  ≥ 95%.
- **Specificity** (correct rejection of adversarial samples): fraction of
  adversarial out-of-scope samples correctly auto-excluded. Target ≥ 95%.
- **Precision** on the LLM shortlist: fraction of items forwarded to
  human that are actually in-scope per ground truth. Target ≥ 60%
  (precision is deliberately soft; the human catches remaining false
  positives cheaply).
- **F1 score** and **Cohen's kappa** with the ground-truth labels.

Output: `validation_report.md` with per-class metrics, confusion matrix,
and a per-record disagreement list (LLM-said-X but ground-truth-says-Y)
for prompt refinement.

## Reproducibility controls

- Model + version pinned in a config header at every script invocation.
- Random seeds fixed where the LLM supports them.
- Every LLM call is logged with the exact prompt, response, and
  wall-clock timestamp.
- Prompt pack is versioned; changes bump the pipeline's minor version.

## Integration with the review workflow

The pipeline sits between Consensus MCP retrieval and the reviewer's
manual Zotero-based screen:

```
Consensus MCP  →  Stage 2a dedup  →  Stage 2b hard filters  →  Stage 2c LLM adjudication  →  Human shortlist  →  Zotero pool
```

The final `human_shortlist.csv` is imported into Zotero as a new
collection; the reviewer works through it applying the review's own
inclusion criteria + exclusion codes E1–E4 (documented in Section 2.2.3
of the thesis).

## When to invoke this skill

Invoke on any of the following user requests:
- "screen this batch of records"
- "run the lit-screening pipeline"
- "adjudicate this paper against the review scope"
- "validate the screening skill against the ground truth"
- "shortlist for manual review"

The skill assumes the reviewer's scope prompt pack has already been
authored under `prompts/`. If not, prompt the reviewer to run through the
one-time scope-definition wizard first.
