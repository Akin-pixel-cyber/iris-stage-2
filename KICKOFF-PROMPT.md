# Kickoff prompt: Iris

Paste the block for your tool. Both are already filled in. Edit `build.md` first if you want to change anything.

## A. Claude chat

Before pasting: start a **new chat** and upload `build.md`, `CLAUDE.md`, your screenshots from `design/`, and a zip of the `.claude/` folder (skills).

```
You are the lead engineer building "Iris", an internal company app. Read the uploaded build.md and CLAUDE.md fully, open the zipped .claude/skills, and look at my screenshots.

Today we do STAGE 1 only (section 11 of build.md). Do not build later stages.

How to work:
1. First list anything in build.md that is unclear or that you disagree with (max 8 short points), especially the items marked ASSUMPTION. Wait for my answers.
2. Then show a short plan: file tree, database tables for this stage, screens. Wait for my "go".
3. Build it. Run the tests in your environment and show me the result.
4. Follow the add-feature, write-steps-md and security-review skills. Keep INSTRUCTIONS.md, STEPS.md and .env.example current. STEPS.md starts with prerequisites, then brief copy-paste steps.
5. Finish by giving me ONE zip named iris-stage-1.zip containing the whole project (include CLAUDE.md, build.md, .claude/ and design/), then tell me: how to run it, what works, what you did NOT test, and what I should check by hand.

Keep replies short and plain. For code changes, show current code next to the replacement.
```

## B. Claude Code

Before pasting: put the pack in a new folder, `cd` into it, run `git init`, then run `claude`.

```
Read CLAUDE.md, build.md, .claude/skills/ and design/. We are building "Iris".

Do STAGE 1 only (section 11 of build.md).

1. First list anything unclear or that you disagree with (max 8 short points), especially items marked ASSUMPTION. Wait for my answers.
2. Then give a short plan (files, tables, screens). Wait for my "go".
3. Build in small steps. Run `npm test` after each step. Commit to git at the end of the stage with a clear message.
4. Keep INSTRUCTIONS.md, STEPS.md and .env.example current.
5. Finish with: how to run it, what works, what you did NOT test, and what I should check by hand.

Keep replies short and plain.
```

Shortcut once the pack is in place: `/stage 1`, `/stage 2` and so on.

## C. Prompts for the next stages

Use a **new chat** (or `/clear` in Claude Code) for each stage. In chat, upload the latest `iris-stage-N.zip`, plus `build.md` and `CLAUDE.md` again. Then paste:

```
We are continuing the Iris project. The uploaded zip is the app so far (Stage N-1 is done and checked). Read CLAUDE.md and build.md. Build STAGE N only. First give a short plan and wait for "go". Run the tests, update the docs, and give me a new zip named iris-stage-N.zip with the whole project. Finish with what works, what you did NOT test, and what to check by hand.
```

What to add per stage (paste after the block above):

- **Stage 2:** `Follow the ticket-workflow skill. Write all 7 tests it lists, including the Adam and Sarah scenario.`
- **Stage 3:** `Chat must check conversation membership on every message and every socket event. Messages are shown with textContent only.`
- **Stage 4:** `Follow the discord-notifications skill. Use a mocked HTTP client in tests. List every Discord Developer Portal step I must do by hand.`
- **Stage 5:** `Follow the integration-provider skill. Build the Mock provider first and make the full Adam and Sarah workflow pass on it. Then GitHub and AWS, tested with mocks only. Give me the exact GitHub App permissions and AWS IAM policy JSON.`
- **Stage 6:** `Run the security-review skill and fix FAIL items. Produce Dockerfile, docker-compose.yml with Caddy HTTPS, .env.example, INSTRUCTIONS.md, STEPS.md covering every prerequisite (EC2, DNS record, security group 22/80/443, SES or SMTP, GitHub App, AWS IAM, Discord bot) and every command from a clean Ubuntu 24.04 server.`

## D. Everyday prompts

Change the spec:
```
I edited build.md (section: [name]). Update the code, tests and docs to match. Summarise what changed.
```

Bug:
```
Bug: [what I did] > [what happened] > [what I expected]. Write a failing test first, then fix it.
```

Add a new tool (for example Azure):
```
Add an Azure provider using the integration-provider skill. Ask me which Azure actions matter most, build it against the mock first, and list the credentials Settings must ask for.
```
