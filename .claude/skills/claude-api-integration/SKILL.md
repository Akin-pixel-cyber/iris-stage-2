---
name: claude-api-integration
description: Use when adding Claude API features (chat, summaries, classification, tool use) to an app.
---

# Adding Claude API features

1. **Key stays on the server.** `ANTHROPIC_API_KEY` in `.env` only. The browser calls your endpoint; your endpoint calls Claude. Never ship the key to front-end code.
2. **Model in config.** Read the model name from an env var (`CLAUDE_MODEL`) so you can switch without code changes. Check https://docs.claude.com for current model names and SDK usage before writing code.
3. **Official SDK.** Use `@anthropic-ai/sdk` (Node) or `anthropic` (Python). Set `max_tokens`. Use streaming for chat-like UIs.
4. **System prompt in its own file** (`prompts/<feature>.md`), versioned in git.
5. **Treat model output as untrusted input.** Validate JSON, escape before rendering, never run it as code or SQL.
6. **Guardrails:** per-user rate limit, request size limit, timeout, clear error message when the API fails, and a cost cap or usage log.
7. **Privacy:** do not send secrets or more personal data than the feature needs.
8. **Test** with a mocked client so tests do not call the real API.
9. Add `ANTHROPIC_API_KEY` and `CLAUDE_MODEL` to `.env.example` and to the prerequisites in `STEPS.md` (account, key, billing).
