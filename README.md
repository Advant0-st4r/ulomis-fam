# Ulomis Student A — Money in Limbo

Netlify-native deployment.

- Auth: Netlify Identity (`@netlify/identity`)
- Database: Netlify Database / managed Postgres (`@netlify/database`)
- AI: OpenAI from Netlify Functions only
- Database schema: automatic migration at `netlify/database/migrations/001_initial/migration.sql`
- Browser receives no database credentials and no OpenAI secret.

## Human setup
1. Enable **Project configuration → Identity** in Netlify. Keep registration Open for public student testing.
2. Set `OPENAI_API_KEY`; optionally set `OPENAI_RECONSTRUCTION_MODEL` (default: `gpt-5.6-luna`).
3. Deploy. Netlify Database provisions automatically and applies migrations before publish.
4. Open `/.netlify/functions/health`.

The first reconstruction does not require signup. Durable acceptance and continuity do.

## LLM runtime contract

Household reconstruction is one bounded server-side OpenAI Responses API call behind a thin adapter. It uses strict structured output, deterministic domain validation, `store: false`, low reasoning effort for GPT-5-family models, at most two transient attempts, and a 22-second timeout per attempt. A timeout or provider failure never mutates canonical state. Accepted writes use a client request id so retries do not create duplicate threads.


## Reconstruction latency contract

Household reconstruction uses `gpt-5.6-luna` by default with reasoning disabled, a 12s provider deadline, and no synchronous retry after a timeout. Provider 429/5xx/connection failures may retry once. The legacy `OPENAI_MODEL` variable is intentionally ignored so an older slow model setting cannot silently reintroduce the timeout failure.
