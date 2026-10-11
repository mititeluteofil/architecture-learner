#!/usr/bin/env python3
"""Deterministic helpers for .github/workflows/learning-loop.yml.

Stdlib only. Sub-commands:
  config                         -> learning-path.yml + profile.json as step outputs
  session-tests --base --head    -> pick test classes added/changed this session, grouped by module
  run-tests                      -> run only the session's tests, classify results (passed / LEARNER-locked / real failures)
  verify --day N                 -> run the `## Verification` block of curriculum/day-by-day/day-NN.md
                                    (every check is listed; checks after the first failure are recorded as not_run)
  manifest                       -> write .learning-out/run-manifest.json: session window, scaffolder scope, selected vs
                                    reported tests, the decision trail of every gate and the loop-back target.
                                    Inputs come from LL_* environment variables (see cmd_manifest).
  dashboard --out FILE [--title] -> render the gamified markdown dashboard (includes the manifest when present)

All artefacts are written to .learning-out/ (git-ignored). Nothing here writes to progress/ or .claude/buddy/ —
those stay owned by the award-xp and update-buddy skills.
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = os.getcwd()
OUT = os.path.join(ROOT, ".learning-out")
CONFIG_FILE = os.path.join(ROOT, ".github", "learning-path.yml")
PROFILE_FILE = os.path.join(ROOT, "progress", "profile.json")
ACHIEVEMENTS_FILE = os.path.join(ROOT, "progress", "achievements.json")
FEED_FILE = os.path.join(ROOT, "progress", "feed.json")
DEBRIEF_SHA_FILE = os.path.join(ROOT, ".claude", "buddy", ".last-debrief-sha")

LEVELS = [
    ("L1", "Apprentice", 0), ("L2", "Journeyman", 301), ("L3", "Engineer", 801),
    ("L4", "Senior", 1601), ("L5", "Staff", 2801), ("L6", "Architect", 4501),
]
LEVEL_ICONS = {"L1": "🪨", "L2": "🔨", "L3": "⚙️", "L4": "🛡️", "L5": "🏛️", "L6": "👑"}
NULL_SHA = "0" * 40
MANIFEST_FILE = os.path.join(OUT, "run-manifest.json")
TRACKS = {
    "core": ["p1", "p2", "p3", "p4", "p5"],
    "cloud": ["p4", "p7", "p8", "p9"],
    "distributed": ["p3", "p5", "p6"],
    "full": ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"],
}
BASE_REASONS = {
    "last-debrief": "since your last debrief (`.claude/buddy/.last-debrief-sha`)",
    "push-before": "since the previous push only — no usable `.claude/buddy/.last-debrief-sha`, commit it to widen the session",
    "head-parent": "only the last commit — no debrief marker and no usable push base",
    "none": "the whole repository — no history to diff against",
}


# --------------------------------------------------------------------------- utils

def ensure_out():
    os.makedirs(OUT, exist_ok=True)


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def write_json(path, data):
    ensure_out()
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


def set_output(key, value):
    target = os.environ.get("GITHUB_OUTPUT")
    line = f"{key}={value}\n"
    if target:
        with open(target, "a", encoding="utf-8") as fh:
            fh.write(line)
    else:
        sys.stdout.write(line)


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)


def is_commit(sha):
    return bool(sha) and sha != NULL_SHA and git("cat-file", "-e", f"{sha}^{{commit}}").returncode == 0


def load_config():
    cfg = {
        "planned_minutes": "150", "pace": "sprint", "track": "full", "scaffold_level": "thorough",
        "review_tone": "honest", "auto_verify": "true", "auto_update_buddy": "true",
    }
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, encoding="utf-8") as fh:
            for raw in fh:
                line = raw.split("#", 1)[0].strip()
                if ":" in line:
                    key, value = line.split(":", 1)
                    cfg[key.strip()] = value.strip().strip('"').strip("'")
    return cfg


def tail(text, lines=40):
    return "\n".join((text or "").splitlines()[-lines:])


def short(sha):
    return (sha or "")[:7] or "—"


def project_id(project):
    """`p1-loan-core-java8` -> `p1`."""
    return (project or "").split("-", 1)[0]


def next_on_track(track, current_project):
    path = TRACKS.get(track, TRACKS["full"])
    current = project_id(current_project)
    if current in path:
        index = path.index(current)
        return (path[index + 1], "") if index + 1 < len(path) else (None, "track complete after this project")
    number = int(current[1:]) if current[1:].isdigit() else 0
    ahead = [p for p in path if int(p[1:]) > number]
    target = ahead[0] if ahead else path[0]
    return target, f"`{current or '—'}` is not on track `{track}`"


# --------------------------------------------------------------------------- config

def cmd_config(_args):
    cfg = load_config()
    profile = read_json(PROFILE_FILE, {})
    for key, value in cfg.items():
        set_output(key, value)
    day = int(profile.get("current_day", 1))
    set_output("day", day)
    set_output("day_padded", f"{day:02d}")
    set_output("project", profile.get("current_project", ""))


# --------------------------------------------------------------------------- session tests

def resolve_base(cli_base, head):
    """Session start = last debrief commit (if it is an ancestor), else the push's `before`, else HEAD~1."""
    candidates = []
    if os.path.exists(DEBRIEF_SHA_FILE):
        with open(DEBRIEF_SHA_FILE, encoding="utf-8") as fh:
            candidates.append(("last-debrief", fh.read().strip()))
    candidates.append(("push-before", cli_base))
    for reason, sha in candidates:
        if is_commit(sha) and git("merge-base", "--is-ancestor", sha, head).returncode == 0:
            return sha, reason
    parent = git("rev-parse", f"{head}~1")
    return (parent.stdout.strip(), "head-parent") if parent.returncode == 0 else (None, "none")


def module_of(test_path):
    marker = "/src/test/"
    if marker not in test_path:
        return None
    return test_path.split(marker, 1)[0]


def cmd_session_tests(args):
    head = args.head or "HEAD"
    base, reason = resolve_base(args.base, head)
    if base:
        diff = git("diff", "--name-only", "--diff-filter=AMR", base, head)
        changed = diff.stdout.split()
    else:
        changed = git("ls-files", "projects").stdout.split()

    modules = {}
    for path in changed:
        if not path.startswith("projects/") or not re.search(r"/src/test/java/.+\.(java|kt)$", path):
            continue
        name = os.path.splitext(os.path.basename(path))[0]
        if not re.search(r"(Test|Tests|IT|Properties|Property|Contract.*)$", name):
            continue
        module = module_of(path)
        if module and os.path.exists(os.path.join(module, "pom.xml")):
            modules.setdefault(module, set()).add(name)

    result = {
        "base": base, "base_reason": reason, "head": head,
        "modules": {m: sorted(t) for m, t in sorted(modules.items())},
        "projects": sorted({m.split("/")[1] for m in modules}),
    }
    write_json(os.path.join(OUT, "session-tests.json"), result)
    set_output("has_tests", "true" if modules else "false")
    set_output("base", base or "")
    set_output("projects", ",".join(result["projects"]))
    print(json.dumps(result, indent=2))


def registered_modules():
    try:
        with open(os.path.join(ROOT, "pom.xml"), encoding="utf-8") as fh:
            return set(re.findall(r"<module>([^<]+)</module>", fh.read()))
    except OSError:
        return set()


def parse_surefire(module):
    cases = []
    for report in glob.glob(os.path.join(module, "target", "surefire-reports", "TEST-*.xml")) + \
            glob.glob(os.path.join(module, "target", "failsafe-reports", "TEST-*.xml")):
        try:
            tree = ET.parse(report)
        except ET.ParseError:
            continue
        for tc in tree.iter("testcase"):
            status, message = "passed", ""
            for tag in ("failure", "error"):
                node = tc.find(tag)
                if node is not None:
                    message = (node.get("message") or node.text or "").strip()
                    status = "locked" if "LEARNER" in message else "failed"
            if tc.find("skipped") is not None:
                status = "skipped"
            cases.append({
                "class": tc.get("classname", "").split(".")[-1],
                "name": tc.get("name", ""),
                "status": status,
                "message": message.splitlines()[0][:200] if message else "",
            })
    return cases


def cmd_run_tests(_args):
    plan = read_json(os.path.join(OUT, "session-tests.json"), {"modules": {}})
    registered = registered_modules()
    results = {"modules": [], "totals": {"passed": 0, "locked": 0, "failed": 0, "skipped": 0, "build_errors": 0}}

    for module, tests in plan.get("modules", {}).items():
        selector = ",".join(tests)
        base_cmd = ["mvn", "-B", "-ntp", "test", f"-Dtest={selector}",
                    "-Dsurefire.failIfNoSpecifiedTests=false", "-DfailIfNoTests=false"]
        cmd = base_cmd + (["-pl", module, "-am"] if module in registered else ["-f", f"{module}/pom.xml"])
        print("::group::" + " ".join(cmd))
        proc = subprocess.run(cmd, capture_output=True, text=True)
        print(tail(proc.stdout, 200))
        print("::endgroup::")

        cases = parse_surefire(module)
        build_error = proc.returncode != 0 and not cases
        entry = {"module": module, "tests": tests, "exit_code": proc.returncode, "cases": cases,
                 "build_error": build_error, "log_tail": tail(proc.stdout + proc.stderr) if build_error else ""}
        results["modules"].append(entry)
        for case in cases:
            results["totals"][case["status"]] += 1
        if build_error:
            results["totals"]["build_errors"] += 1

    totals = results["totals"]
    write_json(os.path.join(OUT, "test-results.json"), results)
    set_output("real_failures", totals["failed"] + totals["build_errors"])
    set_output("locked", totals["locked"])
    set_output("passed", totals["passed"])
    set_output("green", "true" if totals["failed"] + totals["build_errors"] + totals["locked"] == 0 else "false")
    print(json.dumps(totals))


# --------------------------------------------------------------------------- verification

def verification_commands(day_file):
    with open(day_file, encoding="utf-8") as fh:
        text = fh.read()
    match = re.search(r"^##\s+Verification\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S)
    if not match:
        return []
    commands = []
    in_fence = False
    for line in match.group(1).splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            if stripped and not stripped.startswith("#"):
                commands.append(stripped)
            continue
        item = re.match(r"^[-*]\s+(?:\[[ xX]\]\s+)?(.*)$", stripped)
        if item:
            body = item.group(1)
            code = re.search(r"`([^`]+)`", body)
            commands.append(code.group(1) if code else body)
    return commands


def cmd_verify(args):
    day = int(args.day)
    day_file = os.path.join(ROOT, "curriculum", "day-by-day", f"day-{day:02d}.md")
    result = {"day": day, "checks": [], "all_passed": False, "reason": ""}
    if not os.path.exists(day_file):
        result["reason"] = f"{os.path.relpath(day_file, ROOT)} not found"
    else:
        commands = verification_commands(day_file)
        if not commands:
            result["reason"] = "no ## Verification checklist found"
        failed = False
        for command in commands:
            if failed:
                # stop executing at the first failure (like the verify-day skill) but keep the rest of the checklist visible
                result["checks"].append({"label": command, "status": "not_run", "passed": False, "exit_code": None})
                continue
            try:
                proc = subprocess.run(["bash", "-lc", command], capture_output=True, text=True, timeout=300)
                check = {"label": command, "passed": proc.returncode == 0, "exit_code": proc.returncode}
                if proc.returncode != 0:
                    check["tail"] = tail(proc.stdout + proc.stderr)
            except subprocess.TimeoutExpired:
                check = {"label": command, "passed": False, "exit_code": None, "tail": "timeout (5 min)"}
            check["status"] = "passed" if check["passed"] else "failed"
            result["checks"].append(check)
            failed = not check["passed"]
        result["all_passed"] = bool(result["checks"]) and all(c["passed"] for c in result["checks"])
    write_json(os.path.join(OUT, "verification.json"), result)
    set_output("all_passed", "true" if result["all_passed"] else "false")
    print(json.dumps(result, indent=2))


# --------------------------------------------------------------------------- run manifest (the read model)

def env(name, default=""):
    return (os.environ.get(name) or default).strip()


def env_list(name):
    return [item.strip() for item in env(name).split(",") if item.strip()]


def gate(name, status, reason):
    return {"gate": name, "status": status, "reason": reason}


def cmd_manifest(_args):
    """Collect what the run *holds* into one file. Inputs (all optional, from the workflow):

    LL_EVENT, LL_PUSH_BASE, LL_CHANGED_MAIN, LL_TEST_SCAFFOLD_RESULT, LL_SCAFFOLDED (comma list of added files),
    LL_SESSION_CI_RESULT, LL_GREEN, LL_REVIEW_RESULT, LL_VERIFY_JOB_RESULT, LL_DAY, LL_PROJECT.
    Job results are GitHub's `success | failure | cancelled | skipped` (empty = unknown).
    """
    cfg = load_config()
    profile = read_json(PROFILE_FILE, {})
    session = read_json(os.path.join(OUT, "session-tests.json"), None)
    tests = read_json(os.path.join(OUT, "test-results.json"), None)
    verification = read_json(os.path.join(OUT, "verification.json"), None)
    before = read_json(os.path.join(OUT, "profile-before.json"), None)

    day = int(env("LL_DAY") or profile.get("current_day", 1))
    project = env("LL_PROJECT") or profile.get("current_project", "")
    auto_verify = cfg.get("auto_verify", "true") == "true"
    auto_buddy = cfg.get("auto_update_buddy", "true") == "true"
    changed_main = env_list("LL_CHANGED_MAIN")
    scaffolded = env_list("LL_SCAFFOLDED")
    scaffold_result = env("LL_TEST_SCAFFOLD_RESULT")
    ci_result = env("LL_SESSION_CI_RESULT")
    review_result = env("LL_REVIEW_RESULT")
    verify_job = env("LL_VERIFY_JOB_RESULT")
    totals = (tests or {}).get("totals", {})
    real_failures = totals.get("failed", 0) + totals.get("build_errors", 0)
    locked = totals.get("locked", 0)

    # session window
    reason = (session or {}).get("base_reason", "unknown")
    window = {"base": (session or {}).get("base"), "head": (session or {}).get("head"), "reason": reason,
              "explanation": BASE_REASONS.get(reason, "session tests were not selected in this run")}

    # selected vs reported tests
    selected = (session or {}).get("modules", {})
    reported = {m["module"]: {c["class"] for c in m["cases"]} for m in (tests or {}).get("modules", [])}
    test_selection = []
    for module, classes in selected.items():
        got = reported.get(module, set())
        test_selection.append({"module": module, "selected": classes,
                               "reported": sorted(c for c in classes if c in got),
                               "missing": sorted(c for c in classes if c not in got)})

    # decision trail
    gates = []
    if scaffold_result in ("", "skipped"):
        gates.append(gate("test-scaffold", "skipped", "no `src/main` changes in this push" if not changed_main
                          else "did not run"))
    elif scaffold_result == "success":
        gates.append(gate("test-scaffold", "ran", f"scope `{', '.join(changed_main)}` · "
                          + (f"added {len(scaffolded)} skeleton(s)" if scaffolded else "nothing missing, no skeletons added")))
    else:
        gates.append(gate("test-scaffold", "failed", f"test-scaffolder {scaffold_result} — session CI was blocked"))

    if ci_result in ("", "skipped"):
        gates.append(gate("session-ci", "skipped", "blocked by test-scaffold" if scaffold_result == "failure" else "did not run"))
    elif not selected:
        gates.append(gate("session-ci", "ran", "no test classes added/changed this session — nothing to run"))
    elif ci_result == "success":
        gates.append(gate("session-ci", "ran", f"{totals.get('passed', 0)} passed · {locked} 🔒 locked"))
    else:
        gates.append(gate("session-ci", "failed", f"{real_failures} real failure(s)/build error(s)"))

    if review_result == "success":
        has_review = os.path.exists(os.path.join(OUT, "review.md"))
        gates.append(gate("learning-review", "ran" if has_review else "failed",
                          "review written" if has_review else "agent finished but wrote no `review.md`"))
    elif review_result in ("", "skipped"):
        gates.append(gate("learning-review", "skipped", "session CI did not run"))
    else:
        gates.append(gate("learning-review", "failed", f"review agent {review_result}"))

    verified = bool(verification and verification.get("all_passed"))
    if verification is not None:
        checks = verification.get("checks", [])
        if verified:
            note = f"all {len(checks)} check(s) green"
        else:
            first = next((c for c in checks if c.get("status") == "failed" or not c.get("passed")), None)
            note = (f"check {checks.index(first) + 1}/{len(checks)} failed: `{first['label']}`" if first
                    else verification.get("reason") or "not passed")
        if locked:
            note += f" · ran with {locked} 🔒 locked test(s) remaining"
        gates.append(gate("verify-day", "ran" if verified else "failed", note))
    elif not auto_verify:
        gates.append(gate("verify-day", "skipped", "`auto_verify: false` in `.github/learning-path.yml`"))
    elif real_failures:
        gates.append(gate("verify-day", "skipped", f"{real_failures} real failure(s) in the session tests — fix them first"))
    else:
        gates.append(gate("verify-day", "skipped", "session CI did not succeed" if ci_result != "success" else "did not run"))

    award_banner = os.path.exists(os.path.join(OUT, "award.md"))
    xp_gained = profile.get("xp_total", 0) - before.get("xp_total", 0) if before else None
    if verified and verify_job == "success":
        gates.append(gate("award-xp", "ran", "banner written" if award_banner
                          else f"no banner from the agent — profile delta: {'+' if (xp_gained or 0) >= 0 else ''}{xp_gained or 0} XP"))
        gates.append(gate("update-buddy", "ran" if auto_buddy else "skipped",
                          "buddy memory + `.last-debrief-sha` updated" if auto_buddy else "`auto_update_buddy: false`"))
    elif verified:
        gates.append(gate("award-xp", "failed", f"verify-and-award job {verify_job or 'unknown'} after verification passed"))
        gates.append(gate("update-buddy", "skipped", "award-xp did not complete"))
    else:
        gates.append(gate("award-xp", "skipped", "day not verified"))
        gates.append(gate("update-buddy", "skipped", "runs only after award-xp"))

    # loop-back: where the learner re-enters the loop
    day_padded = f"{day:02d}"
    build_modules = [m["module"] for m in (tests or {}).get("modules", []) if m.get("build_error")]
    if scaffold_result == "failure":
        loop_back = "🔁 Re-run the workflow — the test-scaffolder failed (agent/infra issue, not your code)."
    elif build_modules:
        loop_back = f"🔁 Fix the build in `{', '.join(build_modules)}` and push — the loop restarts at test-scaffold."
    elif real_failures:
        loop_back = f"🔁 Fix {real_failures} failing test(s) on the quest board and push — the loop restarts. Stuck? `/buddy`."
    elif verification is not None and not verified:
        first = next((c for c in verification.get("checks", []) if c.get("status") == "failed"), None)
        target = f"`{first['label']}`" if first else verification.get("reason", "the day's checklist")
        loop_back = f"🔁 Make {target} pass and push — the loop re-enters at session CI → verify-day {day_padded}."
    elif verification is None and not auto_verify and ci_result == "success":
        loop_back = f"▶️ Session green. Run `/verify day-{day_padded}` locally when you are ready (auto-verify is off)."
    elif locked and not verified:
        loop_back = f"🔒 Fill the {locked} remaining `LEARNER:` test(s) and push."
    elif verified:
        loop_back = "🎉 Day accepted. Run `/debrief` locally, then pull the `[learning-bot]` progress commit."
    elif not selected:
        loop_back = "✍️ Nothing was exercised: add or change a test for what you built and push."
    else:
        loop_back = "⏳ Waiting for the next push."

    # warnings
    warnings = []
    touched = sorted({project_id(p) for p in (session or {}).get("projects", []) + changed_main})
    if touched and project_id(project) and any(p != project_id(project) for p in touched):
        warnings.append(f"You worked on `{', '.join(touched)}` but `progress/profile.json` says Day {day} / `{project}` — "
                        f"verification ran against Day {day_padded}.")
    if not os.path.exists(DEBRIEF_SHA_FILE) or git("ls-files", "--error-unmatch", DEBRIEF_SHA_FILE).returncode != 0:
        warnings.append("`.claude/buddy/.last-debrief-sha` is not committed — sessions shrink to single pushes.")
    for entry in test_selection:
        if entry["missing"]:
            warnings.append(f"`{entry['module']}`: selected but no report for `{', '.join(entry['missing'])}` "
                            "(not compiled, excluded by the surefire config, or no test methods).")

    nxt, nxt_note = next_on_track(cfg.get("track", "full"), project)
    manifest = {
        "event": env("LL_EVENT"), "day": day, "project": project,
        "session_window": window,
        "test_scaffold": {"scope": changed_main, "result": scaffold_result or "skipped", "added": scaffolded},
        "test_selection": test_selection,
        "totals": totals,
        "ready_to_verify": env("LL_GREEN") == "true",
        "gates": gates,
        "loop_back": loop_back,
        "warnings": warnings,
        "settings": cfg,
        "next_on_track": {"track": cfg.get("track", "full"), "project": nxt, "note": nxt_note},
        "xp_gained": xp_gained,
    }
    write_json(MANIFEST_FILE, manifest)
    print(json.dumps(manifest, indent=2))


# --------------------------------------------------------------------------- dashboard

def bar(value, total, width=20):
    total = max(total, 1)
    filled = max(0, min(width, round(width * value / total)))
    return "█" * filled + "░" * (width - filled)


def render_dashboard(title):
    cfg = load_config()
    profile = read_json(PROFILE_FILE, {})
    achievements = read_json(ACHIEVEMENTS_FILE, {"definitions": [], "unlocked": []})
    feed = read_json(FEED_FILE, {})
    tests = read_json(os.path.join(OUT, "test-results.json"), None)
    verification = read_json(os.path.join(OUT, "verification.json"), None)
    before = read_json(os.path.join(OUT, "profile-before.json"), None)
    manifest = read_json(MANIFEST_FILE, None)

    level = profile.get("level", {})
    level_id = level.get("id", "L1")
    xp_total = profile.get("xp_total", 0)
    in_level = level.get("xp_in_level", 0)
    to_next = level.get("xp_to_next", 0)
    next_name = next((name for lid, name, _ in LEVELS if lid > level_id), None)
    day = profile.get("current_day", 1)

    md = [f"## {title}", ""]
    md.append(f"### {LEVEL_ICONS.get(level_id, '🎓')} {level.get('name', 'Apprentice')} · Day {day}/30 · "
              f"`{profile.get('current_project', '—')}`")
    md.append("")
    md.append("```text")
    md.append(f"XP     {bar(in_level, in_level + to_next)}  {in_level}/{in_level + to_next}"
              + (f"  → {to_next} XP to {next_name}" if next_name else "  MAX LEVEL"))
    md.append(f"Course {bar(day - 1, 30)}  day {day}/30")
    md.append(f"Streak {'🔥' * min(profile.get('streak_days', 0), 14)} {profile.get('streak_days', 0)} day(s)")
    md.append("```")
    if before:
        gained = xp_total - before.get("xp_total", xp_total)
        if gained:
            md.append(f"> ✨ **+{gained} XP this run** (total {xp_total})")
        if before.get("level", {}).get("id") != level_id:
            md.append(f"> 🎉 **LEVEL UP → {level.get('name')}**")
    if manifest:
        if manifest.get("ready_to_verify"):
            md.append("> 🟢 **Session green** — no 🔒 locked or failing tests: the day is ready to verify.")
        md.append(f"> **Next:** {manifest['loop_back']}")
    md.append("")

    md.append("<details><summary>🪜 Level ladder</summary>\n")
    md.append("| | Level | From XP |")
    md.append("|---|---|---|")
    for lid, name, floor in LEVELS:
        marker = "👉" if lid == level_id else ("✅" if lid < level_id else "")
        md.append(f"| {marker} | {LEVEL_ICONS[lid]} {name} | {floor} |")
    md.append("\n</details>\n")

    unlocked = {u["id"]: u for u in achievements.get("unlocked", [])}
    definitions = achievements.get("definitions", [])
    md.append(f"### 🏆 Achievements {len(unlocked)}/{len(definitions)}")
    md.append("")
    cells = []
    for d in definitions:
        if d["id"] in unlocked:
            cells.append(f"🏆 **{d['name']}**<br><sub>+{d['xp']} XP · {d['description']}</sub>")
        else:
            cells.append(f"🔒 {d['name']}<br><sub>{d['xp']} XP · {d['description']}</sub>")
    per_row = 3
    if cells:
        md.append("| " + " | ".join([" "] * per_row) + " |")
        md.append("|" + "---|" * per_row)
        for i in range(0, len(cells), per_row):
            row = cells[i:i + per_row] + [" "] * (per_row - len(cells[i:i + per_row]))
            md.append("| " + " | ".join(row) + " |")
    md.append("")

    series = feed.get("xp_timeseries") or []
    if len(series) >= 2:
        days = ", ".join(str(p["day"]) for p in series)
        values = ", ".join(str(p["xp_cumulative"]) for p in series)
        md += ["### 📈 XP over time", "", "```mermaid", "xychart-beta",
               '  title "Cumulative XP"', f"  x-axis [{days}]", '  y-axis "XP"',
               f"  line [{values}]", "```", ""]

    if manifest:
        md += render_manifest(manifest)

    if tests is not None:
        t = tests["totals"]
        md.append("### ⚔️ Session quest board")
        md.append("")
        md.append(f"✅ **{t['passed']}** cleared · 🔒 **{t['locked']}** still `LEARNER:` · "
                  f"❌ **{t['failed']}** broken · 💥 **{t['build_errors']}** build errors · ⏭️ {t['skipped']} skipped")
        md.append("")
        for module in tests["modules"]:
            md.append(f"<details><summary><code>{module['module']}</code> — {len(module['cases'])} test(s)</summary>\n")
            if module["build_error"]:
                md.append("```text\n" + module["log_tail"] + "\n```")
            icons = {"passed": "✅", "locked": "🔒", "failed": "❌", "skipped": "⏭️"}
            for case in module["cases"]:
                note = f" — <sub>{case['message']}</sub>" if case["status"] in ("failed", "locked") and case["message"] else ""
                md.append(f"- {icons[case['status']]} `{case['class']}` · {case['name']}{note}")
            md.append("\n</details>\n")
        if not tests["modules"]:
            md.append("_No test classes were added or changed this session._\n")

    if verification is not None:
        state = "🟢 PASSED" if verification["all_passed"] else "🔴 NOT YET"
        md.append(f"### ✅ Day {verification['day']:02d} verification — {state}")
        md.append("")
        if verification.get("reason"):
            md.append(f"_{verification['reason']}_")
        check_icons = {"passed": "✅", "failed": "❌", "not_run": "⏸️"}
        for check in verification["checks"]:
            status = check.get("status") or ("passed" if check["passed"] else "failed")
            suffix = " — <sub>not run (an earlier check failed)</sub>" if status == "not_run" else ""
            md.append(f"- {check_icons[status]} `{check['label']}`{suffix}")
            if status == "failed" and check.get("tail"):
                md.append("  <details><summary>output</summary>\n\n```text\n" + check["tail"] + "\n```\n</details>")
        if not verification["all_passed"]:
            md.append("\n> Stuck? Run `/buddy` locally — the Learning Buddy can ask you a Socratic question about this check.")
        md.append("")

    nxt, nxt_note = next_on_track(cfg["track"], profile.get("current_project", ""))
    nxt_text = f"`{nxt}`" if nxt else "—"
    if nxt_note:
        nxt_text += f" ({nxt_note})"
    md.append(f"<sub>Path: pace `{cfg['pace']}` · track `{cfg['track']}` → next {nxt_text} · "
              f"{cfg['planned_minutes']} min/day · scaffold `{cfg['scaffold_level']}` · review tone `{cfg['review_tone']}` · "
              f"auto_verify `{cfg['auto_verify']}` · auto_update_buddy `{cfg['auto_update_buddy']}` "
              f"— edit `.github/learning-path.yml`</sub>")
    return "\n".join(md) + "\n"


def render_manifest(manifest):
    icons = {"ran": "✅", "failed": "❌", "skipped": "⏭️"}
    window = manifest.get("session_window", {})
    md = ["### 🧭 Why this run did what it did", ""]
    md.append(f"**Session window** `{short(window.get('base'))}…{short(window.get('head'))}` — {window.get('explanation', '')}")
    md.append("")
    scaffold = manifest.get("test_scaffold", {})
    scope = ", ".join(scaffold.get("scope") or []) or "none"
    md.append(f"**Test-scaffolder scope** `{scope}` — {len(scaffold.get('added') or [])} skeleton(s) added")
    for path in scaffold.get("added") or []:
        md.append(f"  - ➕ `{path}`")
    md.append("")
    selection = manifest.get("test_selection") or []
    if selection:
        md.append("| Module | Selected | Reported | Missing |")
        md.append("|---|---|---|---|")
        for entry in selection:
            md.append(f"| `{entry['module']}` | {len(entry['selected'])} | {len(entry['reported'])} | "
                      + (", ".join(f"`{c}`" for c in entry["missing"]) or "—") + " |")
        md.append("")
    md.append("**Decision trail**")
    md.append("")
    md.append("| Gate | | Why |")
    md.append("|---|---|---|")
    for g in manifest.get("gates", []):
        md.append(f"| `{g['gate']}` | {icons.get(g['status'], '❔')} {g['status']} | {g['reason']} |")
    md.append("")
    for warning in manifest.get("warnings", []):
        md.append(f"> ⚠️ {warning}")
    if manifest.get("warnings"):
        md.append("")
    md.append("<sub>Full state: `run-manifest.json` artifact of this run.</sub>")
    md.append("")
    return md


def cmd_dashboard(args):
    content = render_dashboard(args.title)
    ensure_out()
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(content)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(content)
    print(content)


def cmd_snapshot(_args):
    write_json(os.path.join(OUT, "profile-before.json"), read_json(PROFILE_FILE, {}))


# --------------------------------------------------------------------------- main

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("config").set_defaults(func=cmd_config)
    sub.add_parser("snapshot").set_defaults(func=cmd_snapshot)
    p = sub.add_parser("session-tests")
    p.add_argument("--base", default="")
    p.add_argument("--head", default="HEAD")
    p.set_defaults(func=cmd_session_tests)
    sub.add_parser("run-tests").set_defaults(func=cmd_run_tests)
    p = sub.add_parser("verify")
    p.add_argument("--day", required=True)
    p.set_defaults(func=cmd_verify)
    sub.add_parser("manifest").set_defaults(func=cmd_manifest)
    p = sub.add_parser("dashboard")
    p.add_argument("--out", required=True)
    p.add_argument("--title", default="🎮 Learning Loop")
    p.set_defaults(func=cmd_dashboard)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
