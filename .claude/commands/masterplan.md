---
description: List or show masterplans (domain manifests mapped onto the architecture spine).
---

Argument: `list` or `show [id]`. `new <id>` and `switch <id>` arrive in Wave 6; if asked, say so and stop. Anything else: print this usage and stop.

Read-only. Never modify files.

## `/masterplan list`

1. Scan `curriculum/masterplan.yaml` and `curriculum/masterplans/*/masterplan.yaml` (skip `_template`).
2. Print a table: `id`, `title`, `core_aggregate`, days path. Mark the active one: the `masterplan:` key in `.github/learning-path.yml` (default `loan-servicing`).
3. Run `node tools/masterplan-lint/lint.mjs <manifest>` for each and add a `lint` column (`ok` / `N errors`).

## `/masterplan show [id]`

1. Default `id` is the active masterplan. Find its manifest as above; if unknown, list the valid ids and stop.
2. Read `curriculum/spine.yaml` and the manifest. Print one row per spine slot: slot, concept, days, project slug (and `dir` when overridden), brief.
3. Below the table print the `paths` (days, side_quests, vectors) and the lint summary line.
