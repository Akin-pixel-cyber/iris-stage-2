---
name: ticket-workflow
description: Use when touching tickets, statuses, the board, dashboard or notifications in Iris. Holds the status rules, notification matrix and required tests.
---

# Ticket workflow rules

Terms: **assigner** = creator of the ticket. **assignee** = person it is given to.

## Status rules (implement once as `canTransition(ticket, actor, newStatus)`)
- Statuses: To Do, In Progress, In Review, Done.
- Assignee (not assigner): may set To Do, In Progress, In Review. Never Done.
- Assigner (not assignee): may set any status. Only the assigner can set Done. May send back or reopen.
- Same person: any status.
- Admin: no override.
- Use it from the API, the board drag-and-drop, and the UI (hide or disable illegal buttons, but the server is the real check).

## Notifications (all through `notify()`)
Created > assignee. In Progress / In Review > assigner. Done / sent back / reopened > assignee. Comment > other party. Access granted/revoked > affected person. Never notify the actor.

## Required tests
1. Assignee cannot set Done on a ticket someone else created (403).
2. Assignee can set Done on a self-created self-assigned ticket.
3. Assigner can set Done, sent-back, and reopen.
4. A third user cannot read or change the ticket (404 or 403).
5. In Review notifies the assigner exactly once; Done notifies the assignee; nobody is notified of their own action.
6. Full scenario: Adam creates for Sarah > Sarah In Progress > Sarah In Review > Sarah tries Done (rejected) > Adam Done.
7. Every status change adds a `ticket_events` row.
