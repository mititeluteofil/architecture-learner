---
description: End-of-session retro — 3 reflection questions, then record the session and award XP.
---

This command has three phases. Run them sequentially.

### Phase 1 — Reflect (Learning Buddy)

Invoke the `learning-buddy` subagent in "debrief mode". It must:

1. Read `.claude/buddy/{overview,learner-profile,session-log}.md`.
2. Run `git diff $(cat .claude/buddy/.last-debrief-sha 2>/dev/null || echo HEAD~10) HEAD --stat` (best-effort) to see what changed.
3. Ask exactly **three** reflection questions. The first is always: "What did you attempt today, and how far did you get?" The other two come from the buddy's read of the diff and profile.

Print the questions. Wait for the learner to answer all three in a single reply. Capture verbatim.

### Phase 2 — Collect the session data

Gather, from the learner's answers and the curriculum:

- `day` (from `progress/profile.json.current_day`)
- `project` (same)
- `duration_minutes` and `planned_minutes` — ask the learner if not stated.
- `main_quest.goals[].status` — ask the learner to mark each of today's goals (from the day file) as `done`, `in_progress`, or `not_started`.
- `decisions` — extract from reflection text; confirm with learner before recording.
- `blockers` — extract; confirm.
- `side_quests` — ask: "Did you attempt any side quests today? If so, which and what status?"
- `reflection` — the concatenated answers, lightly cleaned.
- `buddy_questions_asked` — the three questions from Phase 1.
- `journal_title` — ask: "One-line headline for today's journal entry?" Optional; used only by the dashboard republish in Phase 3, not passed to `award-xp`.
- `verification` — if `/verify day-NN` was run in this session, use its result; else assume `all_passed: false` (no `daily_acceptance` XP, just `debrief`).

### Phase 3 — Commit the record

1. Invoke the `update-buddy` skill with a ≤200-word summary built from the reflection and decisions. It rewrites `learner-profile.md` and prepends to `session-log.md`.
2. Invoke the `award-xp` skill with the session data. Events to include: `debrief` always; `micro_step` once per `## Main Quest` goal marked `done` (max 5); `daily_acceptance` only if `verification.all_passed === true`; `side_quest` per completed side quest; `adr` per new ADR (check `curriculum/adr/` for files newer than the last session); `adr_landing` per ADR the learner points to a passing test for (ask — never infer); `property_bug` / `public_artifact` only if the learner reports one with evidence.
3. **Republish the dashboard.** Only after `award-xp` has finished writing. Canvas: `https://claude.ai/artifact/EfeuGDbr9yb8RTrmJzs6Tf` (Design artifact, four artboards under `project/`).
   - **No Artifact tool in this session** (e.g. plain CLI, Junie): skip this step, print `Dashboard not republished — no Artifact tool in this session.` and continue. Never abort the debrief over it.
   - Read each artboard from the canvas first (`read` with `path`), so hand edits made in the page are kept: `project/Main.dc.html`, `project/Session.dc.html`, `project/Achievements.dc.html`, `project/Journal.dc.html`.
   - In each file, replace **only** the object returned by `getData()` between `// ===== TEMPLATE DATA` and `// ===== END TEMPLATE DATA =====`. Never touch markup, styles or other methods. Copy JSON from `progress/` verbatim (it is valid JS).

     | Artboard | Mode | `getData()` returns |
     |---|---|---|
     | `Main.dc.html` | overwrite | `{ profile, feed, achievements }` = `profile.json`, `feed.json`, `achievements.json` |
     | `Achievements.dc.html` | overwrite | `{ generated_at: feed.generated_at, profile, achievements }` |
     | `Session.dc.html` | rebuilt from history | `{ nextAchievement, sessions }`: `sessions` = every `progress/sessions/session-*.json`, oldest first; `nextAchievement` = name of the first definition in `achievements.json` not in `unlocked[]` (`"All unlocked"` if none) |
     | `Journal.dc.html` | rebuilt from history | `{ entries }`, one per session file, oldest first: `session`, `day`, `date`, `project`, `duration_minutes`, `xp_earned`, `title`, `done` (labels of goals with `status: done`), `decisions` (summary strings), `blockers` (text strings), `reflection` (verbatim), `notes` (`""`) |

   - `title` for a journal entry: ask the learner in Phase 2 for a one-line headline for today; for older sessions keep the title already in the Journal artboard's data. If none, use the first sentence of the reflection, cut to 80 characters.
   - Sessions and Journal are regenerated in full from the session files every run, so re-running `/debrief` the same day never duplicates entries.
   - Publish the four files in **one** call: `url` = the canvas above, `root` = the scratch folder holding `project/`, `file_path` = `<root>/project/Main.dc.html`, `files` = the other three. Never send `project/canvas.json`, `index.html`, `SKILL.md` or anything under `artifact-type/`.
   - A refused publish (someone edited meanwhile): re-read the files it names, redo the data swap, publish once more. Still refused: print the reason and continue.
4. Record the current `HEAD` sha to `.claude/buddy/.last-debrief-sha` so the next `/debrief` knows where to diff from.
5. Print the retro banner: today's XP, level (and change if any), new achievements, streak. Then either "Dashboard updated: https://claude.ai/artifact/EfeuGDbr9yb8RTrmJzs6Tf" or the skip/refusal note from step 3.

If anything in Phase 2 is missing and the learner doesn't supply it, **abort and ask** rather than guessing. No half-recorded sessions.
