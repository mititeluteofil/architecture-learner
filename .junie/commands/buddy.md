---
description: Ask the Learning Buddy a question. Socratic — no solutions, no code.
---

Invoke the `learning-buddy` subagent. Pass any text after `/buddy` as the learner's question or topic. The buddy reads its memory files, the current day file, and recent git diff, then responds with at most 3 questions.

The buddy will not write any files in this mode. If it tries, override and remind it: "buddy memory is updated only via `/debrief`."

Return the buddy's response verbatim.
