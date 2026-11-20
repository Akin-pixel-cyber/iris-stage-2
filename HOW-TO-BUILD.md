# How to build Iris with this pack

## What is in the pack
| File | Job |
|---|---|
| `build.md` | WHAT Iris is: features, rules, stages. Your single source of truth |
| `CLAUDE.md` | HOW Claude must work in this repo (rules, stack) |
| `KICKOFF-PROMPT.md` | The prompts you paste: first stage, next stages, everyday |
| `.claude/skills/` | Manuals Claude follows: tickets, integrations, Discord, deploy, security |
| `.claude/commands/` | Shortcuts for Claude Code: `/stage 1`, `/new-feature`, `/review`, `/deploy-check` |
| `design/` | Your screenshots (optional) |

## Step 0: Decide first (10 minutes)
1. Open `build.md` and search for **ASSUMPTION**. Change any you disagree with.
2. Put screenshots in `design/` (see `design/README.md`).
3. You do **not** need GitHub, AWS, Discord or email credentials until Stage 4 to 6. A Mock tool lets everything be built and tested without them.

## Option 1: Claude chat (free or paid)

1. Open a new chat. Upload: `build.md`, `CLAUDE.md`, screenshots, and a zip of the `.claude/` folder.
2. Paste **KICKOFF-PROMPT.md, block A**. Answer Claude's questions, then say "go".
3. Claude builds Stage 1 and gives you `iris-stage-1.zip`.
4. **Check it** (see the checklist below). If something is wrong, ask for fixes in the same chat and get an updated zip.
5. When happy, open a **new chat**. Upload `iris-stage-1.zip`, `build.md` and `CLAUDE.md`. Paste the "next stage" prompt (section C) for Stage 2.
6. Repeat through Stage 6. Each new zip is the starting point for the next stage.
7. If chat says it cannot finish a stage in one go, ask it to split the stage in two and give a zip after each half.

Run any zip on your computer:
```bash
unzip iris-stage-1.zip && cd iris-stage-1     # folder name may differ
cp .env.example .env
npm install
npm run dev
```
(Needs Node.js 22. Open http://localhost:3000.)

## Option 2: Claude Code (paid plan)

1. Install once (needs Node.js 18+): `npm install -g @anthropic-ai/claude-code`
2. Make the project folder and put the pack in it:
   ```bash
   mkdir iris && cd iris
   unzip ../iris-starter-pack.zip
   cp -r iris-starter-pack/. . && rm -rf iris-starter-pack
   git init
   ```
3. Run `claude` in that folder and log in the first time.
4. Paste **KICKOFF-PROMPT.md, block B** (or type `/stage 1`). Answer questions, say "go".
5. When the stage is done, **check it**, then run `git log` to see the commit. Type `/clear` and run `/stage 2`. Repeat.
6. To change requirements: edit `build.md` or add screenshots in your editor, then tell Claude "I edited build.md, sync the code".
7. Before Stage 6 ends run `/review` and `/deploy-check`.

## Checklist after each stage
| Stage | Check by hand |
|---|---|
| 1 | Register with a gmail address: must be refused. Register with `you@exquisappfactory.com`: verify link arrives (or prints in the terminal). Cannot log in before verifying. Profile picture shows to another user |
| 2 | As Adam, create a ticket for Sarah. As Sarah, try to set Done: refused. In Review: Adam gets a bell notification. Adam sets Done: Sarah is notified |
| 3 | Two browsers: DM and a group chat arrive instantly and survive a page refresh. A third user cannot see them |
| 4 | Link Discord. A ticket event arrives as a DM from the Iris bot. Turn it off: nothing arrives |
| 5 | Run the full Adam and Sarah workflow on the Mock tool. Then connect a test GitHub org and a test AWS account |
| 6 | Follow STEPS.md on a fresh EC2 server. Iris opens over HTTPS |

## Rules that save you pain
- Never skip the "plan, then go" step.
- One stage per chat or session.
- Test with fake or test accounts first. Never connect your real production GitHub org or AWS account until Stage 5 passes on the test ones.
- If Claude says it did not test something, test it yourself.
- Add a line to `CLAUDE.md` Gotchas whenever Claude repeats a mistake.
