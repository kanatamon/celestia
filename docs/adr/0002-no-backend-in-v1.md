# No backend or user accounts in v1.0.0

Celestia v1.0.0 ships as a Chrome extension with no server, no database, and no Celestia user account. All data is real-time only — scoped to the current Live Session and discarded when it ends. This eliminates the double-login problem: users are already logged into TikTok in their browser; adding a Celestia login on top would create two separate auth contexts and confuse the onboarding.

When monetization is introduced (v2), it will use Google OAuth as the single Celestia account. TikTok login remains owned by TikTok's tab. Users log into Celestia once via Google — a credential they already have ambient in Chrome — and never manage a separate Celestia password.

## Considered options

- **Extension + backend from day one** — enables subscriptions and usage tracking but reintroduces the login friction this decision eliminates.
- **Chrome Web Store payments** — zero login required but Google takes 30% and Celestia owns no user relationship.
- **Extension-only v1, Google OAuth v2** — chosen. Proves the extension works first; layers in accounts only when there's a clear monetization reason to justify the friction.
