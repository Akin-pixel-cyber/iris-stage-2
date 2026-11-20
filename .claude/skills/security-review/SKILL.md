---
name: security-review
description: Use before a release or when asked to review security. Checklist for web apps with logins, money or user data.
---

# Security review checklist

Go through each item, inspect the code, and report PASS / FAIL / N/A with file and line for every FAIL.

**Auth**
- Passwords hashed (bcrypt/argon2), never logged or returned.
- Session/JWT secret from env, strong, not defaulted in production.
- Cookies: httpOnly, sameSite, secure when on HTTPS. Expiry set.
- Rate limit on login/register/password change.

**Input and injection**
- All input validated on the server (type, length, range).
- Database queries parameterised. No string-built SQL.
- Output rendered with textContent / escaped. No user data in innerHTML.
- Content-Security-Policy and other headers set (helmet).

**Access control**
- Every route checks who is calling and whether they own the resource (no user A reading user B's data).
- Admin routes check the role on the server.

**Money / critical state**
- Integer minor units. Multi-step changes inside one DB transaction.
- Balance cannot go negative. Replays and double-clicks cannot double-spend.

**Secrets and deploy**
- `.env` in `.gitignore` and `.dockerignore`. No secrets in git history.
- Container runs as non-root. Only needed ports open. Database port closed.
- Dependencies audited (`npm audit --omit=dev`).

**Realtime**
- Sockets authenticated. Server is the source of truth for game/room state. Every event handler wrapped in try/catch.

End with the top 3 risks and a suggested fix order.
