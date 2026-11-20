---
name: write-steps-md
description: Use when creating or updating STEPS.md or INSTRUCTIONS.md for a repo - the standard for deployment and run instructions.
---

# STEPS.md standard

Every repo must have `STEPS.md` and `INSTRUCTIONS.md`.

## STEPS.md structure
1. **Goal** (one line): where the reader ends up, e.g. "app open at http://SERVER-IP:3000".
2. **0. Prerequisites, at the top:** a table of everything to set up first. Instance type and size, disk size, OS and version, ports/security group rules, accounts, tokens/API keys, tools on the local computer, files needed.
3. **Numbered steps**, each with copy-paste command blocks, labelled where they run (YOUR computer or the SERVER).
4. **Verify step:** a command and the expected output.
5. **Everyday commands:** logs, restart, stop, update, backup.
6. **Troubleshooting table:** symptom -> fix.

## Style
- Brief. Commands over prose. One action per line.
- Pin versions where they matter (Node 22, Ubuntu 24.04, Postgres 16).
- Never skip steps: include `sudo apt update`, `sudo apt upgrade -y`, every install, every security group rule, file permissions, env file setup.
- Show how to generate secrets (`openssl rand -hex 32`), never print real ones.
- Say what the reader should see after each important command.

## INSTRUCTIONS.md structure
What the app does, project layout, run locally, run with Docker, config table (env vars), and a production checklist.

Finally: follow the steps yourself where possible (dry run) and list any step you could not test.
