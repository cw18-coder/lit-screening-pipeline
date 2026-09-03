# AI-Assisted Abstract Screening \u2014 Running Plan

**Location:** `G:\My Drive\ESGCIDBA\correctness-wedge\thesis-review-method\ai-assistance\ai-assisted-screening.md`
**Status:** Running document. v0.2 (2026-09-03) locks the sampling plan.
**Owner:** Clarence Wong
**Method chapter reference:** Chapter 2, correctness-wedge PRISMA methodology.

---

## 1. Purpose

Automate the title-and-abstract screening of the Track 1 identification pool with a validated AI adjudicator so that Clarence can complete Chapter 2 of the thesis under a realistic solo timeline while remaining defensible under PRISMA 2020 reporting rules and the ESGCI DBA rubric.

Manual screening of 300-plus abstracts by a single reviewer within a DBA schedule (Section 8 of `CLAUDE.md`) is not feasible without shortcuts that damage inter-rater agreement in the absence of a second reviewer. PRISMA 2020 (Page et al., 2021) permits automation-assisted screening provided the automation is documented, validated against a human-labelled sample, and the residual error is bounded and reported.

## 2. Governing constraints

- **PRISMA 2020 clause 22 (Studies selection).** Reviewers must state whether any automation tools were used and how they were validated. This document is that record.
- **Locked constraint L5 (`CLAUDE.md`).** Solo execution. No second human reviewer available; AI adjudicator substitutes for the conventional second-reviewer role.
- **Locked constraint L4.** Positivist / post-positivist paradigm. The screening decision is treated as a measurement problem with a ground-truth label and a classifier under test; performance is reported quantitatively.
- **`.github/skills/lit-screening` skill (v1.0.0).** The pipeline, prompt pack, and adjudication rubric already exist. This document instantiates that skill on the Track 1 pool with a validated performance envelope.
- **Site alignment principle (site DESIGN.md \u00a70.5).** Every number reported here \u2014 sample size, performance metrics, per-question breakdown \u2014 must match the corresponding count in the thesis appendix and on the interactive site.

## 3. Screening pool

- **Source of truth:** `01c_identification_dedup.csv` on Google Drive (Track 1 unique references after deduplication), filtered to `pipeline_status = 'active'`.
- **Pool as of 2026-09-03:**
  - Total 01c rows: 332.
  - Ignored under `pipeline_status = 'ignored_optional_q15'`: 20 (Q15 was pre-specified as optional in the search protocol; reviewer decided post-retrieval not to operationalise; rows retained for audit).
  - 01c active: **312**.
  - Cross-track overlaps (Track 2 anchors that also appear in 01c): 5 (reassigned to Track 2, bypass screening).
  - **Effective screening pool: 307.**
- The 20 Q15 rows carry `pipeline_status = 'ignored_optional_q15'` in 01a, 01c, and 2b. See `.github/instructions/csv-log-discipline.instructions.md` Rule 10.

## 4. Sample size and stratification (locked 2026-09-03)

- **n = 126.** Balanced at **k = 6 per stratum** across the **21 non-Q15 primary-query strata**.
- **Seed = 20260903** (deterministic; skill birth date).
- **Pool fingerprint = 17ca7c8e1033d9e6** (SHA-256 prefix over sorted `stable_id` set at draw time). Any future re-draw against a different pool state will produce a different fingerprint and is a lint-visible drift.
- Power analysis (see `power_analysis_results.csv`; scipy-verified; \u03b1 = 0.05, 1 - \u03b2 = 0.80, prevalence assumed 0.30):

  | Framing | Question | n required | % of pool |
  |---|---|---|---|
  | A_sens | Sensitivity CI half-width \u2264 \u00b10.075 | 127 | 41 % |
  | A_spec | Specificity CI half-width \u2264 \u00b10.075 | 105 | 34 % |
  | B_kappa | Detect \u03ba \u2265 0.70 vs 0.40 | 105 | 34 % |
  | C_mcnemar | McNemar detect \u03c0 = 0.10 vs 0.05 | 168 | 55 % |

  n = 126 meets Framings A_spec and B_kappa cleanly, is one short of A_sens (median), and does not meet C_mcnemar's stricter target. C_mcnemar's target is a secondary comparison; the PRISMA-primary metric is sensitivity, met by n = 127 and materially unaffected by the one-record shortfall.

- **Stratification:** by primary Consensus query (first token of `query_ids` split on `|`). 21 strata after Q15 removal; every stratum has \u2265 6 records available. Balanced allocation `min(6, N_stratum)` = 6 for every stratum \u2192 21 \u00d7 6 = 126.
- **5-fold stratified CV** stratified by (`primary_query_id` \u00d7 `include_label`) to preserve query balance and class balance in every fold.

## 5. Metrics

Following the `lit-screening` skill's validation rubric (`SKILL.md`, Validation section), the following metrics are recorded per fold and aggregated (mean \u00b1 sd):

| Metric | Target | Rationale |
|---|---|---|
| Sensitivity (recall on include) | \u2265 0.95 | False negatives at screening are lost evidence; expensive to recover. |
| Specificity (correct reject rate) | \u2265 0.80 | False positives cost only the reviewer's time at full-text; acceptable trade. |
| Precision | \u2265 0.60 | Weak target by design; human catches remaining false positives cheaply. |
| F1 score | \u2265 0.80 | Balanced summary. |
| Cohen's kappa (LLM vs Clarence) | \u2265 0.70 | Substantial agreement (Landis and Koch, 1977). |
| Per-question sensitivity | \u2265 0.90 per Q## | Guards against theme-specific blind spots. |

If any metric misses its target on the calibration set, the rubric is revised (documented as a rubric version bump in `.github/skills/lit-screening/prompts/adjudication.md`) and the sample is re-adjudicated.

## 6. Pipeline stages

```
1. Rubric freeze (below)
   \u2193
2. Power analysis \u2192 sample size n
   \u2193
3. Stratification design \u2192 per-stratum allocation
   \u2193
4. Sample draw (deterministic seed)
   \u2192 hand_labelled_sample.csv
   \u2193
5. Clarence hand-labels the sample (include / exclude + reason)
   \u2193
6. LLM adjudicates the same sample under the frozen rubric
   \u2193
7. 5-fold stratified cross-validation
   \u2192 fold_results.csv, confusion matrices, disagreement list
   \u2193
8. If metrics pass: adjudicate the remaining 308 \u2212 n abstracts
   If metrics fail: revise rubric, re-run steps 5-7 with rubric_vN+1
   \u2193
9. Merge decisions into 2b_screening_excluded.csv and the reviewed shortlist
   \u2193
10. Report in thesis (Chapter 2 \u00a7 methodology + Appendix 2.C)
    Mirror on interactive site (site DESIGN.md \u00a710.3)
```

## 7. Relationship to existing skills and logs

- **`consensus-search-log` skill** produced `01c_identification_dedup.csv` and the abstracts corpus that this screening consumes.
- **`lit-screening` skill** (v1.0.0) supplies the deterministic dedup and hard-filter scripts (Stages 2a and 2b) plus the LLM adjudication rubric (Stage 2c). This document instantiates the skill on the 308-reference pool with a documented calibration and validation run.
- **`prisma-tally.csv`** on Drive tracks the funnel counts. When AI screening completes, its output updates `screening_records_pending_track1`, `screening_excluded_title_abstract_track1`, and downstream nodes.
- **`csv-log-discipline.instructions.md` Rule 9** governs the tally updates so the interactive site and the thesis remain in sync.

## 8. Rubric (locked 2026-09-03 at v1.1.0)

The adjudication rubric lives at `.github/skills/lit-screening/prompts/adjudication.md` **v1.1.0**. It is a binary 12-item checklist: 6 exclusion criteria (E1\u2013E6) plus 6 inclusion criteria (I1\u2013I6), applied at title-and-abstract stage. The reviewer ticks any criterion that applies; the aggregate decision follows an exclusion-wins rule.

### Exclusion criteria (E1\u2013E6)

- **E1. Non-empirical and non-theoretical.**
- **E2. Out-of-domain application.**
- **E3. Software engineering incidental.**
- **E4. AI research without software-engineering grounding.**
- **E5. Programming pedagogy only.**
- **E6. Tool artefact without downstream evaluation.**

### Inclusion criteria (I1\u2013I6)

- **I1. Developer productivity \u2014 empirical or theoretical.**
- **I2. Code review effort dynamics.**
- **I3. FOSS and corporate-sponsored OSS governance and pull-request dynamics.**
- **I4. Quality-adjusted productivity (correctness-wedge signal).**
- **I5. Managerial relevance and applicability.**
- **I6. Methodological precedent for Chapter 3.**

Full sentence-length definitions of each criterion live in the rubric markdown at v1.1.0 and in the labelling UI's `app.js` (single source at authoring time; two mirrors at runtime).

### Decision rule

| Boxes ticked | Decision |
|---|---|
| Any Ex checked | **exclude** |
| No Ex, any Ix checked | **include** |
| Nothing checked | INVALID; form refuses to submit |

### Data-backed metadata (no self-reported confidence)

Recorded per submission:

- `checked_exclusions`, `checked_inclusions` \u2014 the raw box states.
- `n_boxes_checked` \u2014 falls out of the state; a data-backed proxy for "how many angles pointed the same way".
- `time_to_decide_seconds` \u2014 auto-captured; a data-backed proxy for reviewer hesitation.
- `additional_comments` \u2014 optional free text.
- `submitted_at_utc`, `reviewer` (`human` or `ai`), `rubric_version`.

No `label_confidence` field. Self-reported confidence would be introspection unsupported by data.

### Full-text eligibility (later stage)

The same 12-item checklist re-applies at full-text eligibility as a first pass, extended with dimensions that the abstract cannot reveal (study design, outcome operationalisation, setting, comparator strength, effect-size extractability, risk of bias). Eligibility rubric to be authored when we reach that stage; screening decisions carry over automatically.

## 9. Governance and reproducibility

- **Seeded sample draw.** The sample is drawn with a fixed random seed (recorded in this document) so the calibration set is reproducible.
- **Human labels are immutable.** Once Clarence hand-labels a paper, that label does not change even if the LLM disagrees. Disagreements go into a `disagreement_log.csv` for post-hoc rubric review.
- **LLM calls are logged.** Every adjudication carries prompt version, model version, temperature, and response verbatim in a JSONL trail alongside the fold outputs.
- **Two artefacts are always version-tagged together:** the hand-labelled sample CSV and the rubric markdown. A rubric bump requires either re-adjudication of the same sample or a fresh sample draw \u2014 documented in this file.

## 10. Pending decisions (open)

1. **Include-prevalence assumption** \u2014 30 % from the psychology-adjacent Q15 purge pattern is a rough estimate. Once Clarence completes ~30 hand-labels the assumption gets re-checked; sample size is re-verified.
2. **AI decisions run** \u2014 the LLM adjudicator (Copilot Chat under v1.1.0 rubric) needs to be executed on the same 126-sample set. Output lands at `ai_decisions.csv`; feeds `crossval_metrics.py`.
3. **Eligibility rubric** \u2014 authored when the review reaches full-text stage. Screening rubric v1.1.0 is the anchor plus expanded dimensions.

## 11. Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-09-03 | Initial overview. Sample size, stratification, and rubric pending chat resolution. |
| v0.2 | 2026-09-03 | Q15 reclassified as not-operationalised optional query via `pipeline_status = 'ignored_optional_q15'` in 01a, 01c, and 2b. Active pool = 307. Sample size locked at n = 126 (balanced at k = 6 across 21 non-Q15 strata). Deterministic seed 20260903. Pool fingerprint 17ca7c8e1033d9e6. Skill `.github/skills/ai-assisted-screening` created with scipy-verified `power_analysis.py`, `strata_availability.py`, `stratified_sample.py`, and `crossval_metrics.py`. All script outputs land in `ai-assistance/*.csv` for downstream lift-and-render. |
| v0.3 | 2026-09-03 | Rubric locked at v1.1.0: 6 exclusion + 6 inclusion boxes, binary decision, exclusion-wins rule, no self-reported confidence (data-backed proxies `n_boxes_checked` and `time_to_decide_seconds` instead). Labelling UI built at `.github/skills/ai-assisted-screening/labelling/` (HTML + CSS + JS single-page app) with a Python HTTP server launcher `label_ui.py`. `crossval_metrics.py` rewritten to compare `human_decisions.csv` and `ai_decisions.csv` on both binary decision and 12-dimensional box-level agreement (Hamming, Jaccard, per-code F1). |

---

*Running document. Sections 10 and 11 grow as decisions land.*
