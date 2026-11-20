---
name: add-feature
description: Use when adding, changing or fixing any feature in this project. Gives the safe loop - read spec, plan, implement in small steps, test, update docs.
---

# Add or change a feature

1. **Read** `build.md` and `CLAUDE.md`. Find the section the request touches. If the request conflicts with the spec, stop and ask.
2. **Plan** in at most 8 lines: files to change, data changes, edge cases, how you will test it. Wait for approval if the change is large or touches money, auth or data.
3. **Test first when fixing a bug:** write a failing test that reproduces it.
4. **Implement in small steps.** After each step run the test command from `CLAUDE.md`.
5. **Validate on the server** (never trust the browser). Use parameterised queries. Handle errors with clear messages.
6. **Update docs:** `build.md` (feature table and decision log), `INSTRUCTIONS.md`, `STEPS.md` and `.env.example` if setup changed.
7. **Report** in 3 lines: what changed, test result, what you did not test.

Do not: add dependencies without saying why, refactor unrelated code, or claim success without running the tests.
