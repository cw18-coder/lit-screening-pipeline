"""publish_skill.py — extract the shareable subset of the lit-screening
workspace skill to a public-release folder, ready for GitHub push + Zenodo
DOI mint.

Extracts (from the source skill folder):
  SKILL.md
  README.md
  prompts/**/*.md
  scripts/**/*.py

Adds (generated fresh in the target folder):
  LICENSE (MIT)
  .gitignore
  CITATION.cff (Zenodo-compatible citation metadata)
  examples/README.md (placeholder)

Excludes (deliberately not shipped):
  tests/           private Zotero-derived titles + abstracts
  .working/        anything under a working scratch folder
  *.bak            in-place backup files

Usage:
  python publish_skill.py \\
      --source .github/skills/lit-screening \\
      --target ../lit-screening-public \\
      [--init-git] [--tag v1.0.0] [--force]

Notes:
  * The script does not push to a remote or mint a DOI. Those are user
    actions (they need auth + GitHub UI clicks + Zenodo integration wiring).
  * A first release typically runs:
        python publish_skill.py --source ... --target ... --init-git --tag v1.0.0
    Then:
        cd <target> && git remote add origin <github-url> && git push -u origin main --tags
    Then in the Zenodo GitHub integration UI, flip the switch for the repo
    and cut a GitHub release named v1.0.0 to mint the DOI.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import shutil
import subprocess
import sys
from pathlib import Path

INCLUDE_FILES = {
    "SKILL.md",
    "README.md",
}
INCLUDE_DIRS = {
    "prompts",
    "scripts",
}
EXCLUDE_NAMES = {
    "tests",
    ".working",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}
EXCLUDE_SUFFIXES = {".bak", ".pyc"}

MIT_LICENSE = """MIT License

Copyright (c) {year} Clarence Wong

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the \"Software\"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
"""

GITIGNORE = """# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
env/

# Tooling
.ruff_cache/
.mypy_cache/
.pytest_cache/
.coverage
.tox/

# Editor / OS
.vscode/
.idea/
*.swp
.DS_Store
Thumbs.db

# Working data (not shipped)
tests/
.working/
*.bak
"""

CITATION_CFF = """cff-version: 1.2.0
message: If you use this software, please cite it using these metadata.
title: lit-screening — hybrid semi-automated screening pipeline for systematic literature reviews
authors:
  - family-names: Wong
    given-names: Clarence
    orcid: https://orcid.org/0000-0000-0000-0000
version: {version}
date-released: {date}
license: MIT
type: software
keywords:
  - systematic literature review
  - PRISMA 2020
  - LLM adjudication
  - GitHub Copilot
  - Claude Opus
  - Consensus MCP
  - hybrid pipeline
repository-code: https://github.com/<owner>/<repo>
abstract: |
  Hybrid semi-automated screening pipeline for systematic literature reviews.
  Combines deterministic Python scripts for deduplication and hard filters
  with LLM adjudication (Claude Opus via GitHub Copilot Chat in agent mode).
  Designed for the ESGCI DBA thesis literature review on AI-assisted software
  development but generalises to any focused systematic review with a
  well-defined scope. Ships a SKILL.md, prompt pack with eight gold
  calibration examples, deterministic script rule set, and a validation
  harness with a retrospective ground-truth test.
"""

EXAMPLES_README = """# examples

This folder is a placeholder for demo inputs and outputs so users can run
the pipeline end-to-end without touching private data.

**Do not commit real Zotero-derived data here.** The reviewer's Zotero
library is private and the tests/ folder used during development sits
outside this public release.

Suggested contents (to be added by users):
- `raw_records.example.jsonl` — a small demo of the input JSONL format
- `ground_truth.example.csv` — a small demo of the ground-truth CSV
- `expected_shortlist.example.csv` — the expected pipeline output for the demo
"""


def _should_copy(rel_path: Path) -> bool:
    parts = rel_path.parts
    if not parts:
        return False
    if parts[0] in EXCLUDE_NAMES:
        return False
    if any(p in EXCLUDE_NAMES for p in parts):
        return False
    if rel_path.suffix in EXCLUDE_SUFFIXES:
        return False
    if len(parts) == 1:
        return parts[0] in INCLUDE_FILES or parts[0] in INCLUDE_DIRS
    return parts[0] in INCLUDE_DIRS


def _copy_extractable(source: Path, target: Path) -> list[Path]:
    """Return list of copied relative paths."""
    copied: list[Path] = []
    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(source)
        if not _should_copy(rel):
            continue
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        copied.append(rel)
    return copied


def _write_scaffold(target: Path, version: str) -> None:
    now = _dt.date.today().isoformat()
    year = now[:4]
    (target / "LICENSE").write_text(MIT_LICENSE.format(year=year), encoding="utf-8")
    (target / ".gitignore").write_text(GITIGNORE, encoding="utf-8")
    (target / "CITATION.cff").write_text(
        CITATION_CFF.format(version=version, date=now), encoding="utf-8"
    )
    examples = target / "examples"
    examples.mkdir(parents=True, exist_ok=True)
    (examples / "README.md").write_text(EXAMPLES_README, encoding="utf-8")


def _run_git(cmd: list[str], cwd: Path) -> None:
    print(f"    $ git {' '.join(cmd)}")
    subprocess.run(["git", *cmd], cwd=cwd, check=True)


def _git_init_and_tag(target: Path, tag: str | None) -> None:
    if (target / ".git").exists():
        print("    git repo already initialised; skipping git init")
    else:
        _run_git(["init", "-b", "main"], target)
    _run_git(["add", "."], target)
    try:
        _run_git(["commit", "-m", f"Initial public release {tag or ''}".strip()], target)
    except subprocess.CalledProcessError:
        # nothing to commit
        print("    (nothing to commit)")
    if tag:
        _run_git(["tag", "-a", tag, "-m", f"Release {tag}"], target)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", required=True,
                    help="workspace skill folder (e.g. .github/skills/lit-screening)")
    ap.add_argument("--target", required=True,
                    help="destination folder for the public release")
    ap.add_argument("--init-git", action="store_true",
                    help="git init the target and make an initial commit")
    ap.add_argument("--tag", default=None,
                    help="annotated tag to create after the initial commit (e.g. v1.0.0)")
    ap.add_argument("--force", action="store_true",
                    help="overwrite existing files in the target (still refuses to clear a non-empty target unless --force is set)")
    args = ap.parse_args()

    source = Path(args.source).resolve()
    target = Path(args.target).resolve()
    if not source.exists():
        print(f"error: source does not exist: {source}", file=sys.stderr)
        sys.exit(2)
    if not (source / "SKILL.md").exists():
        print(f"error: SKILL.md not found under source: {source}", file=sys.stderr)
        sys.exit(2)

    if target.exists() and any(target.iterdir()) and not args.force:
        print(f"error: target is not empty ({target}); pass --force to overwrite",
              file=sys.stderr)
        sys.exit(2)
    target.mkdir(parents=True, exist_ok=True)

    print(f"[publish] source: {source}")
    print(f"[publish] target: {target}")

    copied = _copy_extractable(source, target)
    print(f"[publish] copied {len(copied)} files:")
    for rel in copied:
        print(f"    {rel}")

    version = args.tag.lstrip("v") if args.tag else "1.0.0"
    _write_scaffold(target, version)
    print("[publish] wrote LICENSE, .gitignore, CITATION.cff, examples/README.md")

    if args.init_git:
        print("[publish] initialising git repo...")
        _git_init_and_tag(target, args.tag)

    print("[publish] done.")
    print()
    print("Next steps:")
    print(f"  cd {target}")
    print("  git remote add origin <github-url>")
    print("  git push -u origin main --tags")
    print("  # then flip the Zenodo switch for the repo and cut a GitHub release")


if __name__ == "__main__":
    main()
