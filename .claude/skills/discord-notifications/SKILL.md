---
name: discord-notifications
description: Use when building or changing Discord linking or Discord direct-message notifications in Iris.
---

# Discord notifications

## How it works
- One Discord application with a bot, added to the company server. Bot token is a secret (`DISCORD_BOT_TOKEN`).
- **Linking:** user clicks "Connect Discord" > Discord OAuth2 with scope `identify` > callback exchanges the code, reads the user's Discord ID, stores it in `discord_links`. Use a random `state` value stored in the session to prevent forgery. Redirect URI = `DISCORD_REDIRECT_URI`, registered in the Discord developer portal.
- **Sending:** use the REST API with the bot token (no gateway needed):
  1. `POST https://discord.com/api/v10/users/@me/channels` with `{ "recipient_id": "<discord id>" }` gives a DM channel id (cache it).
  2. `POST /channels/{id}/messages` with `{ "content": "...", "allowed_mentions": { "parse": [] } }`.
- Send from a small queue with retries. Never block the user's action on Discord.

## Messages
Short and useful: who did what, ticket title, link to `APP_BASE_URL/tickets/<id>`. Example: `Sarah moved "GitHub access for Adam" to In Review. Open: https://iris.../tickets/42`

## Failure handling
- 403 or "cannot send messages to this user": mark the link as unreachable, show a hint in Settings (join the server, allow DMs).
- 429: wait `Retry-After`, then retry.
- 401: bot token wrong. Tell the admin in Settings.
- Per-user toggle to turn Discord notifications off. "Send test message" button.

## Tests
Mock the HTTP client. Test: link flow state check, DM sent per event, failure does not break the ticket action, toggle off sends nothing, user without Discord only gets the in-app notification.

## STEPS.md prerequisites to document
Create application at the Discord developer portal, add a Bot, copy token, copy Client ID/Secret, add redirect URI, invite the bot to the server (scope `bot`, no special permissions needed to DM), get the Server (Guild) ID, tell employees to join the server and allow DMs from server members.
