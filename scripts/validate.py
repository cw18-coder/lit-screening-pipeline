"""Retrospective validation of the lit-screening pipeline.

Compares the pipeline's LLM adjudication decisions against a ground-truth
set built from the reviewer's Zotero pool + a set of adversarial
out-of-scope samples.

Ground-truth construction:
  * The 125 items in the reviewer's Zotero pool are labelled from the
    per_study_appraisal.csv classification:
      - included_study, included_anchor        -> ground_truth = in_scope
      - excluded_at_full_text                  -> ground_truth = in_scope
        (they passed title/abstract screening even if they later failed
        full-text eligibility)
      - supplementary_source                   -> ground_truth = in_scope
        (cited directly; the adjudicator should not exclude them at Stage 2c)
  * Adversarial out-of-scope samples are supplied via --adversarial;
    typically 50 records from Consensus responses pulled from unrelated
    domains.

Metrics reported:
  sensitivity (recall on ground-truth in-scope items)
  specificity (correct rejection of adversarial samples)
  precision   (fraction of forwarded items that are in-scope)
  f1_score
  cohen_kappa
  per-class confusion matrix
  disagreement list (for prompt refinement)

Usage:
    python validate.py --decisions adjudicated_records.jsonl \\
                       --ground-truth ground_truth.csv \\
                       --report validation_report.md
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def load_decisions(path: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        out[d["record_id"]] = d
    return out


def load_ground_truth(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in csv.DictReader(open(path, encoding="utf-8-sig")):
        out[row["record_id"]] = row["ground_truth"]
    return out


def predicted_forward(decision: dict) -> bool:
    predicted_class = decision.get("predicted_class")
    score = decision.get("relevance_score", 0)
    confidence = decision.get("confidence")
    if predicted_class == "out_of_scope" and confidence in ("high", "medium"):
        return False
    if score <= 3 and confidence in ("high", "medium"):
        return False
    return True


def evaluate(decisions: dict[str, dict], ground_truth: dict[str, str]) -> dict:
    """Return metrics dict + disagreement list."""
    tp = fp = tn = fn = 0
    disagreements = []
    covered = 0
    for rid, gt in ground_truth.items():
        if rid not in decisions:
            continue
        covered += 1
        d = decisions[rid]
        forwarded = predicted_forward(d)
        gt_is_in = gt == "in_scope"

        if forwarded and gt_is_in:
            tp += 1
        elif forwarded and not gt_is_in:
            fp += 1
        elif not forwarded and not gt_is_in:
            tn += 1
        else:  # not forwarded, gt_is_in
            fn += 1
            disagreements.append({
                "record_id": rid,
                "ground_truth": gt,
                "predicted_class": d.get("predicted_class"),
                "relevance_score": d.get("relevance_score"),
                "confidence": d.get("confidence"),
                "rationale": d.get("rationale"),
            })

    def safe_div(n, d):
        return n / d if d else 0.0

    sens = safe_div(tp, tp + fn)
    spec = safe_div(tn, tn + fp)
    prec = safe_div(tp, tp + fp)
    f1 = safe_div(2 * prec * sens, prec + sens) if (prec + sens) else 0.0

    # Cohen's kappa (LLM forward-vs-not vs ground-truth in-scope-vs-not).
    total = tp + fp + tn + fn
    po = safe_div(tp + tn, total)
    p_pred_pos = safe_div(tp + fp, total)
    p_true_pos = safe_div(tp + fn, total)
    pe = p_pred_pos * p_true_pos + (1 - p_pred_pos) * (1 - p_true_pos)
    kappa = safe_div(po - pe, 1 - pe) if pe < 1 else 0.0

    return {
        "covered": covered,
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "sensitivity": sens,
        "specificity": spec,
        "precision": prec,
        "f1_score": f1,
        "cohen_kappa": kappa,
        "disagreements": disagreements,
    }


def write_report(metrics: dict, report_path: Path, backend: str) -> None:
    lines = [
        "# Lit-screening pipeline validation report",
        "",
        f"**Adjudicator backend:** `{backend}`",
        f"**Ground-truth records evaluated:** {metrics['covered']}",
        "",
        "## Confusion matrix",
        "",
        "|   | Ground-truth in-scope | Ground-truth out-of-scope |",
        "|---|---|---|",
        f"| **LLM forwards** | {metrics['tp']} (TP) | {metrics['fp']} (FP) |",
        f"| **LLM excludes** | {metrics['fn']} (FN) | {metrics['tn']} (TN) |",
        "",
        "## Metrics",
        "",
        f"- Sensitivity (recall on in-scope): **{metrics['sensitivity']:.3f}** (target ≥ 0.95)",
        f"- Specificity (correct out-of-scope rejection): **{metrics['specificity']:.3f}** (target ≥ 0.95)",
        f"- Precision on shortlist: **{metrics['precision']:.3f}** (target ≥ 0.60)",
        f"- F1 score: **{metrics['f1_score']:.3f}**",
        f"- Cohen's kappa: **{metrics['cohen_kappa']:.3f}**",
        "",
    ]
    if metrics["disagreements"]:
        lines.append(f"## Disagreements ({len(metrics['disagreements'])} in-scope items the LLM excluded)")
        lines.append("")
        lines.append("| record_id | predicted_class | score | conf | rationale |")
        lines.append("|---|---|---|---|---|")
        for d in metrics["disagreements"][:50]:
            lines.append(
                f"| {d['record_id']} | {d['predicted_class']} | "
                f"{d['relevance_score']} | {d['confidence']} | "
                f"{d['rationale'][:200] if d['rationale'] else ''} |"
            )
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--ground-truth", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--backend-label", default="unspecified")
    args = ap.parse_args()

    decisions = load_decisions(Path(args.decisions))
    ground_truth = load_ground_truth(Path(args.ground_truth))
    metrics = evaluate(decisions, ground_truth)

    write_report(metrics, Path(args.report), args.backend_label)

    print(f"records evaluated:  {metrics['covered']}")
    print(f"sensitivity:        {metrics['sensitivity']:.3f}")
    print(f"specificity:        {metrics['specificity']:.3f}")
    print(f"precision:          {metrics['precision']:.3f}")
    print(f"f1_score:           {metrics['f1_score']:.3f}")
    print(f"cohen_kappa:        {metrics['cohen_kappa']:.3f}")
    print(f"disagreements:      {len(metrics['disagreements'])}")


if __name__ == "__main__":
    main()
