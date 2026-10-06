---
name: update-buddy
description: Rewrite the Learning Buddy's memory files (`.claude/buddy/learner-profile.md` and `.claude/buddy/session-log.md`) with new summaries. Enforces length caps, redacts solutions, and keeps a rolling 7-session window. Invoked by the buddy at the end of `/debrief`.
---

# update-buddy

You rewrite the Buddy's two evolving memory files. You never write into `overview.md` (that's the stable canonical doc).

## Inputs

The caller (the buddy) provides:

- The just-ended session's reflection answers (3 questions, 3 answers).
- A short summary (≤200 words) of what the learner attempted, decided, and got stuck on.
- The day number and project id.

## Outputs

You produce two files, in this exact format and within these caps.

### `.claude/buddy/learner-profile.md`

Total cap: **400 words**. Structure:

```markdown
# Learner Profile

_Last updated: <ISO date>_

## Pace
<1–3 sentences. Current day vs target. Trend over last 7 sessions.>

## Style
<1–3 sentences. Top-down vs bottom-up. Test-first? Diagram-first? Reads spec or jumps in?>

## Strengths
- <bullet>
- <bullet>
- <bullet>

## Recurring blind spots
- <bullet, framed as a tendency, never as a moral judgment>
- <bullet>

## Decisions style
<1–2 sentences on how the learner decides — fast and revisable, slow and thorough, gut, evidence-driven, etc.>
```

When updating, **prefer revision over append**. If a previous blind spot has been resolved by the latest session, remove it. Profile must read as the truth *today*, not the diary of everything ever.

### `.claude/buddy/session-log.md`

Total cap: **7 entries**, FIFO. Each entry capped at **120 words**. Structure of one entry:

```markdown
## Session NN — Day NN — `p<N>-<name>` — <date>

**Attempted:** <≤2 sentences>
**Decided:** <≤2 sentences, no code, just the decision and rationale>
**Stuck on:** <≤1 sentence; omit if nothing>
**Buddy noticed:** <≤1 sentence — pattern, surprise, or shift>
```

When writing a new entry, **prepend** it and drop the oldest if there are now 8.

## Hard rules

- **Never include code, class names, library names, or specific design patterns** in the buddy files. Use abstractions: "the learner refactored toward typed boundaries", not "switched from `String` to `Money`".
- **Never quote solutions or hints** from the day file. The buddy files are about *the learner*, not the curriculum.
- **Redact identifiers**. If the reflection mentions a class or method, generalize it.
- **No flattery, no judgment.** Neutral, factual, kind.
- **If the inputs contradict the existing profile**, prefer the newer signal but keep one sentence noting the shift.

## Process

1. Read the existing `learner-profile.md` and `session-log.md`.
2. Compose the updated profile (full rewrite under cap).
3. Compose the new session-log entry; prepend; trim to 7.
4. Write both files. Report a one-line confirmation: "Buddy memory updated — profile <X> words, log <Y> entries."
