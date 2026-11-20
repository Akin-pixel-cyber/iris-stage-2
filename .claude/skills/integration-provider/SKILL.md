---
name: integration-provider
description: Use when adding or changing a connected external tool in Iris (GitHub, AWS, Mock, or a new one like Azure or Slack), or the Integrations settings and Access pages.
---

# Integration providers

Every tool is one file in `src/integrations/` that exports the same shape, so the UI and routes never contain tool-specific code.

```js
module.exports = {
  id: 'github',
  label: 'GitHub',
  // Fields the admin fills in Settings > Integrations. The UI is generated from this.
  fields: [
    { key: 'org', label: 'Organization login', type: 'text', required: true },
    { key: 'appId', label: 'App ID', type: 'text', required: true },
    { key: 'privateKey', label: 'Private key (.pem)', type: 'textarea', secret: true, required: true },
  ],
  linkedAccountLabel: 'GitHub username',          // what a user stores in linked_accounts
  async test(config) {},                          // throws a clear error if credentials are wrong
  async listResources(config, kind) {},           // e.g. repos, teams, IAM groups
  async getAccess(config, externalUsername) {},   // what this person can access NOW
  async grant(config, externalUsername, grant) {},   // { resource, level }
  async revoke(config, externalUsername, grant) {},
};
```

## Rules
1. Register the provider in `src/integrations/index.js`. Nothing else changes.
2. Config is stored encrypted (AES-256-GCM, `INTEGRATION_ENCRYPTION_KEY`). Fields marked `secret` are never returned to the browser; the UI shows "saved" and allows replacing.
3. Decrypt only inside the provider call. Never log config, tokens or private keys. Redact errors.
4. Grant and revoke go through one service that checks the caller is a grantor/admin, calls the provider, writes `access_audit` (success or failure), and calls `notify()`.
5. Handle: expired or revoked credentials (mark integration "Error", tell the admin), rate limits (retry once with backoff), and pagination.
6. Least privilege. Document the exact permissions needed in `STEPS.md` prerequisites (GitHub App permissions, AWS IAM policy JSON).
7. Cache `getAccess` for 60 seconds. "Refresh" bypasses the cache.
8. Always build against the **mock provider first** and test with it. Real-API calls must be mockable in tests (inject an HTTP client). Never call real GitHub or AWS from automated tests.
9. State plainly what was tested only against mocks.

## GitHub notes
- Use a GitHub App with an installation token (JWT signed with the private key, exchanged for a 1-hour token). Needed permissions: Organization members (R/W), Administration repo (R/W), Metadata (R).
- Adding someone to an org sends an invitation (pending until accepted). Show "Invited".
- Repo permission levels: pull, triage, push, maintain, admin.
- "What can this person access" = org membership + teams + per-repo permission via `GET /repos/{owner}/{repo}/collaborators/{user}/permission`; paginate and cache.

## AWS notes
- Use `@aws-sdk/client-iam`. Auth either from the EC2 instance role (default credential chain) or stored access key, optionally assuming a role.
- v1 manages IAM group membership (`AddUserToGroup`, `RemoveUserFromGroup`) and reads (`ListGroupsForUser`, `ListAttachedUserPolicies`, `ListAttachedGroupPolicies`). Direct policy attach only if the admin turns that setting on.
- Provide the least-privilege policy JSON in `STEPS.md`.
- The IAM user must already exist. Creating users is LATER.
