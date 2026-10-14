"""Make a clean review download: the stand alone app plus the source a reviewer needs, with no personal data and no raw data.

Usage: python make_review_zip.py            (writes HotS_Tools_review_<today>.zip next to this file)

Included: hots_tools.html (the shareable app), README_REVIEW.md, HOTS_TOOLS.md, PROJECT_STATE.md, the build and test scripts, playbook/,
hotstools/, draftlab/, knowledge/expert/ (hero profiles, lens catalog, notes), scripts/.
Left out: the personal edition (hots_tools_hunter*.html), every database and knowledge/raw (Hunter's game history lives there), the archive
copies, caches and anything git ignored by name here. Run the tests first: they must print OK.
"""
import datetime, pathlib, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / f"HotS_Tools_review_{datetime.date.today().isoformat()}.zip"

TOP_FILES = ["hots_tools.html", "README_REVIEW.md", "HOTS_TOOLS.md", "PROJECT_STATE.md", "UPDATE_PLAYBOOK.md"]
TOP_GLOBS = ["build_*.py", "test_*.py", "test_*.js", "analyze_*.py", "apply_owner_notes.py", "audit_hero_ratings.py", "make_review_zip.py",
             "medea_reader.py", "hero_tags.py", "kb.py", "comps.py"]
TREES = ["playbook", "hotstools", "draftlab", "scripts", "knowledge/expert"]
SKIP_PARTS = {"__pycache__", "raw", "node_modules"}
SKIP_SUFFIX = {".db", ".gz", ".zip", ".ldb", ".pyc"}
SKIP_NAMES = {"hots_tools_hunter.html", "hots_tools_hunter_artifact.html", "build_hunter.py", "test_hunter.py", "build_players_hp.py", "build_sl_mmr.py"}


def ok(path):
    if path.name in SKIP_NAMES or path.suffix in SKIP_SUFFIX:
        return False
    return not (set(path.parts) & SKIP_PARTS)


def main():
    files = []
    for n in TOP_FILES:
        p = ROOT / n
        if p.exists():
            files.append(p)
    for g in TOP_GLOBS:
        files += sorted(ROOT.glob(g))
    for t in TREES:
        base = ROOT / t
        if base.exists():
            files += sorted(p for p in base.rglob("*") if p.is_file())
    seen, n = set(), 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            rel = p.relative_to(ROOT)
            if rel in seen or not ok(rel):
                continue
            seen.add(rel)
            z.write(p, "HotS_Tools_review/" + rel.as_posix())
            n += 1
    print(f"{OUT.name}: {n} files, {OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
