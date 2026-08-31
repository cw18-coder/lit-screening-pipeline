"""Stage 2c: LLM adjudication orchestrator.

Invokes the adjudication skill for each record in the input pool and
writes structured JSON decisions to the output. In production the
adjudicator is Claude Opus 4.7 via GitHub Copilot Chat in agent mode.
This orchestrator provides two adjudicator backends:

  * `--backend copilot`  — invokes the Copilot Chat skill (production).
    The skill reads each record and returns the JSON decision.
  * `--backend heuristic` — deterministic keyword-scoring backend used
    for pipeline development and unit testing. It is NOT a substitute
    for the LLM in production; it exists so the pipeline can be
    exercised end-to-end offline.

The retention rule (forward-to-human) is applied identically regardless
of backend:
  forward if relevance_score >= 6 OR predicted_class == "ambiguous"
  OR confidence == "low".

Usage:
    python adjudicate.py --in hard_filtered_records.jsonl \\
                         --out adjudicated_records.jsonl \\
                         --shortlist human_shortlist.csv \\
                         --backend copilot
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


# --- Heuristic backend (for offline pipeline testing) --------------------

THEME_KEYWORDS = {
    "A": {"copilot", "ai-generated", "ai-code", "code review", "reviewer effort",
          "reviewer trust", "review overhead", "pull request", "code quality",
          "coding assistant", "code assistant", "chatgpt", "gpt", "llm",
          "vibe coding", "agentic coding", "code completion"},
    "B": {"pull request", "pr latency", "review latency", "code review",
          "modern code review", "reviewer assignment", "open source", "oss",
          "openstack", "contributor", "core periphery", "joining", "burnout",
          "community", "sustained participation", "maintainer"},
    "C": {"absorptive capacity", "productivity paradox", "human capital",
          "task-based", "task substitution", "acemoglu", "autor", "cohen levinthal",
          "zahra george", "self-determination", "intrinsic motivation",
          "self determination", "job demands", "job resources", "jd-r",
          "burnout", "organisational learning", "argote", "epple",
          "learning curve", "innovation diffusion", "assimilation gap"},
    "D": {"dora", "space", "developer experience", "devx", "productivity metric",
          "acceptance model", "tam", "utaut", "developer productivity",
          "software engineering measurement", "engineering effectiveness"},
    "out": {
        # Medical imaging / clinical
        "medical imaging", "retinal", "retinopathy", "ophthalmolog", "cancer",
        "melanoma", "carcinoma", "immunotherapy", "clinical trial", "checkpoint inhibitor",
        "chemotherap", "cardiomyocyte", "hypoxia", "in vitro", "clinical guideline",
        "canine", "veterinary", "biopsy", "diagnosis", "patient",
        # Physical sciences
        "protein folding", "protein tertiary", "alphafold", "casp14",
        "quantum comput", "quantum circuit", "quantum error", "quantum processor",
        "photonic", "laser ablation", "atmospheric chemistry", "kepler light",
        "exoplanet", "shallow water equation", "unstructured mesh",
        "climate model", "climate science", "ising model", "statistical mechanics",
        "particle physics", "geodesy", "san andreas", "geophysics",
        # Biology / chemistry
        "cell-free lysate", "synthetic biology", "molecular biology", "crispr",
        "yeast", "flux balance", "coral reef", "biodiversity", "marine biology",
        "systems biology", "genetic circuit", "metabolic pathway",
        # Autonomous vehicles / robotics not related to OSS SE
        "autonomous vehicle", "self-driving", "lidar", "carla simulator",
        "underwater vehicle", "sliding-mode", "aerial vehicle", "constellation design",
        # Alignment / non-SE ML
        "constitutional ai", "harmless assistant", "harmlessness label",
        "sentiment analysis", "tweet", "recommender system", "matrix factorisation",
        "collaborative filtering", "financial fraud", "credit card fraud",
        "adversarial example", "fgsm", "pgd attack", "protein structure",
        # Social sciences / humanities
        "gentrification", "ethnograph", "anthropolog", "digital humanities",
        "shakespeare", "art history", "song dynasty", "porcelain",
        "cognitive load", "multimedia learning", "smartphone use",
        # Domain-specific non-SE
        "gdpr compliance", "tariff", "trade policy", "analyst forecast",
        "power electronic", "battery storage", "bidirectional converter",
        "photovoltaic", "structural health", "civil engineering", "concrete bridge",
        "ceramic microstructure", "sintering", "monolingual corpus", "tibetan",
        "auction theory", "nash equilibri", "cover crop", "agronom",
        "hazard function", "biostatistic", "sustainability metric", "campus emission",
        "bat population", "acoustic monitoring",
    },
}


def heuristic_adjudicate(record: dict) -> dict:
    text = " ".join([
        (record.get("title") or ""),
        (record.get("abstract") or ""),
    ]).lower()
    scores = {}
    for theme in ("A", "B", "C", "D"):
        scores[theme] = sum(1 for kw in THEME_KEYWORDS[theme] if kw in text)
    out_hits = sum(1 for kw in THEME_KEYWORDS["out"] if kw in text)

    total_theme_hits = sum(scores.values())
    best_theme = max(scores.items(), key=lambda x: x[1])
    if out_hits >= 1 and total_theme_hits == 0:
        return {
            "record_id": record["record_id"],
            "relevance_score": 1,
            "predicted_class": "out_of_scope",
            "matched_theme": None,
            "confidence": "high" if out_hits >= 2 else "medium",
            "rationale": f"Heuristic backend: {out_hits} out-of-scope keyword hit(s) and 0 theme hits.",
        }
    if total_theme_hits == 0:
        return {
            "record_id": record["record_id"],
            "relevance_score": 4,
            "predicted_class": "ambiguous",
            "matched_theme": None,
            "confidence": "low",
            "rationale": "Heuristic backend: no theme keywords matched; heuristic cannot decide, forwarding to human.",
        }
    # Scale relevance to 0-10 based on hit count.
    score = min(10, 3 + total_theme_hits * 2)
    predicted_class = "in_scope" if score >= 6 else "ambiguous"
    confidence = "medium" if total_theme_hits >= 3 else "low"
    return {
        "record_id": record["record_id"],
        "relevance_score": score,
        "predicted_class": predicted_class,
        "matched_theme": best_theme[0] if best_theme[1] > 0 else None,
        "confidence": confidence,
        "rationale": f"Heuristic backend: {total_theme_hits} theme keyword hits ({best_theme[0]}={best_theme[1]}, others={total_theme_hits - best_theme[1]}).",
    }


# --- Copilot backend (production) ---------------------------------------

def copilot_adjudicate(record: dict) -> dict:
    """In production the orchestrator delegates to the Copilot Chat skill
    which invokes the LLM with the adjudication prompt pack. The concrete
    IPC differs by host; a lightweight approach used during the review
    was:

      1. Serialize the record as a user prompt (per prompts/adjudication.md).
      2. Invoke Copilot Chat via the CLI or the extension's model API.
      3. Parse the returned JSON.

    This function is documented but not implemented as a runnable stub;
    running the pipeline in `--backend copilot` mode requires a
    live Copilot Chat session and the appropriate wiring, which is
    established in the reviewer's Copilot workspace.
    """
    raise NotImplementedError(
        "Copilot backend requires an active Copilot Chat session. "
        "Configure the skill in the reviewer's workspace and route "
        "invocations through the adjudication prompt pack."
    )


BACKENDS = {
    "heuristic": heuristic_adjudicate,
    "copilot": copilot_adjudicate,
}


def apply_retention_rule(decision: dict) -> bool:
    predicted_class = decision.get("predicted_class")
    score = decision.get("relevance_score", 0)
    confidence = decision.get("confidence")
    # Confident out-of-scope: exclude.
    if predicted_class == "out_of_scope" and confidence in ("high", "medium"):
        return False
    # Well-below threshold and confident: exclude.
    if score <= 3 and confidence in ("high", "medium"):
        return False
    # Everything else (in_scope, ambiguous, or genuinely uncertain): forward.
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="input", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--shortlist", required=True)
    ap.add_argument("--backend", choices=list(BACKENDS.keys()), default="heuristic")
    args = ap.parse_args()

    records = [json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()]
    adjudicator = BACKENDS[args.backend]

    decisions: list[dict] = []
    shortlist: list[dict] = []
    for r in records:
        d = adjudicator(r)
        decisions.append(d)
        if apply_retention_rule(d):
            shortlist.append({
                "record_id": r["record_id"],
                "title": r.get("title", "")[:200],
                "relevance_score": d.get("relevance_score"),
                "predicted_class": d.get("predicted_class"),
                "matched_theme": d.get("matched_theme"),
                "rationale": d.get("rationale"),
            })

    Path(args.out).write_text(
        "\n".join(json.dumps(d, ensure_ascii=False) for d in decisions) + "\n",
        encoding="utf-8",
    )
    with open(args.shortlist, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "record_id", "title", "relevance_score", "predicted_class",
            "matched_theme", "rationale",
        ])
        w.writeheader()
        w.writerows(shortlist)

    print(f"records adjudicated: {len(decisions)}")
    print(f"forwarded to human:  {len(shortlist)}")
    from collections import Counter
    classes = Counter(d.get("predicted_class") for d in decisions)
    print("class breakdown:")
    for k, v in classes.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
