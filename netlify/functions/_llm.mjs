const MAX_ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS = 12000;
const RETRY_DELAY_MS = 200;
const MAX_OUTPUT_TOKENS = 1400;

export class LlmError extends Error {
  constructor(kind, message, { status = 502, attempts = 1, latencyMs = 0, providerRequestId = null } = {}) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
    this.status = status;
    this.attempts = attempts;
    this.latencyMs = latencyMs;
    this.providerRequestId = providerRequestId;
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function isRetryableStatus(status) { return status === 429 || status === 500 || status === 502 || status === 503 || status === 504; }
function reasoningConfig(model) {
  // Reconstruction is extraction/classification, not open-ended reasoning.
  // GPT-5.6 supports `none`, which is the latency baseline for this workflow.
  if (/^gpt-5\.6(?:-|$)/i.test(model)) return { effort: 'none' };
  if (/^gpt-5\.4-(?:mini|nano)$/i.test(model)) return { effort: 'none' };
  if (/^gpt-5(?:\.|-|$)/i.test(model)) return { effort: 'low' };
  return undefined;
}
function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
      if (part?.type === 'refusal') throw new LlmError('refusal', 'The model could not reconstruct this input.', { status: 422 });
    }
  }
  return '';
}

export async function structuredResponse({ apiKey, model, input, schema, safetyIdentifier = undefined }) {
  const started = Date.now();
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const payload = {
        model,
        input,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false,
        text: { format: { type: 'json_schema', name: 'ulomis_reconstruction', strict: true, schema } }
      };
      const reasoning = reasoningConfig(model);
      if (reasoning) payload.reasoning = reasoning;
      if (safetyIdentifier) payload.safety_identifier = safetyIdentifier;

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const providerRequestId = response.headers.get('x-request-id');
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);
        const kind = response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'provider_5xx' : response.status === 401 || response.status === 403 ? 'provider_auth' : 'provider_request';
        const err = new LlmError(kind, data?.error?.message || `Provider request failed (${response.status})`, {
          status: kind === 'rate_limit' || kind === 'provider_5xx' ? 503 : 502,
          attempts: attempt,
          latencyMs: Date.now() - started,
          providerRequestId
        });
        if (!retryable || attempt === MAX_ATTEMPTS) throw err;
        lastError = err;
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      const text = extractOutputText(data);
      if (!text) throw new LlmError('empty_output', 'The model returned no reconstruction.', {
        status: 502,
        attempts: attempt,
        latencyMs: Date.now() - started,
        providerRequestId
      });

      return {
        text,
        attempts: attempt,
        latencyMs: Date.now() - started,
        providerRequestId,
        usage: {
          inputTokens: Number(data?.usage?.input_tokens || 0),
          outputTokens: Number(data?.usage?.output_tokens || 0),
          totalTokens: Number(data?.usage?.total_tokens || 0)
        }
      };
    } catch (error) {
      if (error instanceof LlmError) throw error;
      const timedOut = error?.name === 'AbortError';
      const err = new LlmError(timedOut ? 'timeout' : 'connection', timedOut ? 'The model timed out.' : 'Could not reach the model provider.', {
        status: timedOut ? 504 : 503,
        attempts: attempt,
        latencyMs: Date.now() - started
      });
      // A timeout is not retried synchronously: repeating the same slow call is exactly
      // what produced the observed 25s+ 504s. Network connection failures may retry once.
      if (timedOut || attempt === MAX_ATTEMPTS) throw err;
      lastError = err;
      await sleep(RETRY_DELAY_MS * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new LlmError('unknown', 'Reconstruction failed.');
}

export const LLM_RUNTIME = Object.freeze({ MAX_ATTEMPTS, ATTEMPT_TIMEOUT_MS, MAX_OUTPUT_TOKENS });
