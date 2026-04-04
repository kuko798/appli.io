from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from resume_optimizer.models import BulletInput
from resume_optimizer.pipeline import rewrite_bullet


def main() -> None:
    p = argparse.ArgumentParser(description="Domain-agnostic resume bullet optimizer")
    p.add_argument("-b", "--bullet", help="Single resume bullet")
    p.add_argument("--file", help="Path to file with bullets (one per line)")
    p.add_argument("--role", default=None)
    p.add_argument("--company", default=None, dest="target_company")
    p.add_argument("--jd", default=None, dest="job_description")
    p.add_argument("--model", default=None)
    p.add_argument("--base-url", default=None)
    p.add_argument("--json", action="store_true", dest="as_json")

    args = p.parse_args()

    if not args.bullet and not args.file:
        raise ValueError("Provide either --bullet or --file")

    jd_text = None
    if args.job_description:
        jd_text = Path(args.job_description).read_text(encoding="utf-8", errors="replace")

    # Collect bullets
    bullets = []
    if args.file:
        bullets = Path(args.file).read_text(encoding="utf-8").splitlines()
    else:
        bullets = [args.bullet]

    results = []

    for bullet in bullets:
        if not bullet.strip():
            continue

        inp = BulletInput(
            text=bullet,
            role=args.role,
            target_company=args.target_company,
            job_description=jd_text,
        )

        out = rewrite_bullet(
            inp,
            model=args.model,
            base_url=args.base_url,
        )

        results.append(out)

    # JSON output
    if args.as_json:
        print(json.dumps([r.model_dump() for r in results], indent=2))
        return

    # Pretty output
    for idx, out in enumerate(results, 1):
        print(f"\n=== Bullet {idx} ===")
        print("Domain:", out.domain)

        s = out.score
        print("\nScores:")
        print(f"  impact={s.impact}/10  clarity={s.clarity}/10  specificity={s.specificity}/10  metrics={s.has_metrics}")
        for t in s.suggestions:
            print(f"  - {t}")

        print("\nVersions:")
        for i, v in enumerate(out.improved_versions, 1):
            print(f"  {i}. {v}")


if __name__ == "__main__":
    main()