# Runtime boundary

Browser → Netlify Functions → Netlify Database
Browser ↔ Netlify Identity
Netlify Functions → OpenAI

The LLM proposes candidate state. Deterministic domain validation runs before display and again before persistence. Only an authenticated user can accept canonical state. Database access is server-only; user ownership is enforced in every query by Netlify Identity user ID.

## Abuse + privacy boundary

Guest reconstruction abuse limiting uses a short-lived one-way hash of the Netlify request IP and variant/day. Raw IP addresses are not stored by Ulomis. Browser code never receives database credentials or a connection string.
