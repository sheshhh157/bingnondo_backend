/**
 * aiClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-provider AI client with automatic fallback.
 *
 * Supported providers:
 *   - gemini   → Google Gemini (generativelanguage.googleapis.com)
 *   - groq     → Groq (api.groq.com) — OpenAI-compatible
 *   - openai   → OpenAI (api.openai.com) — default
 *
 * Fallback order: PRIMARY first, then BACKUP.
 * A provider is skipped on quota/rate-limit/auth errors (429, 401, 402, 503).
 * Any other error (bad request, parse failure) surfaces immediately.
 *
 * .env setup:
 *   AI_PRIMARY_PROVIDER=gemini
 *   AI_PRIMARY_KEY=AIzaSy...
 *   AI_PRIMARY_MODEL=gemini-1.5-flash          # optional
 *
 *   AI_BACKUP_PROVIDER=groq
 *   AI_BACKUP_KEY=gsk_...
 *   AI_BACKUP_MODEL=llama-3.1-8b-instant       # optional
 * ─────────────────────────────────────────────────────────────────────────────
 */

const https = require('https');

// ── Provider Defaults ─────────────────────────────────────────────────────────

const PROVIDER_DEFAULTS = {
  gemini: {
    host:  'generativelanguage.googleapis.com',
    model: 'gemini-1.5-flash',
  },
  groq: {
    host:  'api.groq.com',
    model: 'llama-3.1-8b-instant',
  },
  openai: {
    host:  'api.openai.com',
    model: 'gpt-4o-mini',
  },
};

// ── Key / Provider Configuration ──────────────────────────────────────────────

function buildProvider(label, providerEnv, keyEnv, modelEnv) {
  const key      = process.env[keyEnv];
  const provider = (process.env[providerEnv] || 'openai').toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
  const model    = process.env[modelEnv] || defaults.model;

  if (!key) return null;

  return { label, provider, key, model, host: defaults.host };
}

const PROVIDERS = [
  buildProvider('PRIMARY', 'AI_PRIMARY_PROVIDER', 'AI_PRIMARY_KEY', 'AI_PRIMARY_MODEL'),
  buildProvider('BACKUP',  'AI_BACKUP_PROVIDER',  'AI_BACKUP_KEY',  'AI_BACKUP_MODEL'),
].filter(Boolean);

if (PROVIDERS.length === 0) {
  console.warn('[aiClient] WARNING: No AI keys configured. Chatbot will not work.');
}
if (PROVIDERS.length === 1) {
  console.warn(`[aiClient] Only PRIMARY (${PROVIDERS[0].provider}) configured. Fallback is inactive.`);
}
if (PROVIDERS.length === 2) {
  console.log(`[aiClient] PRIMARY: ${PROVIDERS[0].provider} | BACKUP: ${PROVIDERS[1].provider}`);
}

// ── Status codes that trigger a provider swap ─────────────────────────────────
const FALLBACK_ON_STATUSES = new Set([401, 402, 429, 503]);

// ── Low-level: Gemini ─────────────────────────────────────────────────────────

/**
 * Gemini uses a completely different API shape:
 *   POST /v1beta/models/{model}:generateContent?key={apiKey}
 *   Body: { system_instruction, contents: [{ role, parts: [{text}] }] }
 *   Response: { candidates: [{ content: { parts: [{text}] } }] }
 */
function callGemini({ key, model, host }, messages, systemPrompt, maxTokens) {
  return new Promise((resolve, reject) => {
    // Convert OpenAI-style messages to Gemini format
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const payload = JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.5,
      },
    });

    const path = `/v1beta/models/${model}:generateContent?key=${key}`;

    const options = {
      hostname: host,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) return reject({ status: 500, body: 'Empty response from Gemini' });
            resolve(text);
          } catch {
            reject({ status: 500, body: 'Failed to parse Gemini response' });
          }
        } else {
          reject({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject({ status: 503, body: err.message }));
    req.write(payload);
    req.end();
  });
}

// ── Low-level: OpenAI-compatible (Groq, OpenAI, etc.) ────────────────────────

/**
 * Standard OpenAI Chat Completions format.
 * Groq is fully compatible so both use the same function.
 */
function callOpenAICompat({ key, model, host }, messages, systemPrompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.5,
    });

    const options = {
      hostname: host,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    // OpenAI uses /v1/... not /openai/v1/...
    if (host === 'api.openai.com') {
      options.path = '/v1/chat/completions';
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.choices?.[0]?.message?.content?.trim();
            if (!text) return reject({ status: 500, body: 'Empty response from AI' });
            resolve(text);
          } catch {
            reject({ status: 500, body: 'Failed to parse AI response' });
          }
        } else {
          reject({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject({ status: 503, body: err.message }));
    req.write(payload);
    req.end();
  });
}

// ── Router: pick the right caller per provider ────────────────────────────────

function callProvider(providerConfig, messages, systemPrompt, maxTokens) {
  if (providerConfig.provider === 'gemini') {
    return callGemini(providerConfig, messages, systemPrompt, maxTokens);
  }
  return callOpenAICompat(providerConfig, messages, systemPrompt, maxTokens);
}

// ── Public: callWithFallback ──────────────────────────────────────────────────

/**
 * callWithFallback(messages, systemPrompt, maxTokens?)
 *
 * Tries PRIMARY first. If it fails with a quota/rate/auth error, tries BACKUP.
 * Returns: { text: string, keyLabel: string }
 * Throws:  Error on total failure (caught by controller → graceful 503).
 */
async function callWithFallback(messages, systemPrompt, maxTokens = 600) {
  if (PROVIDERS.length === 0) {
    throw new Error('No AI keys configured.');
  }

  let lastError = null;

  for (const providerConfig of PROVIDERS) {
    try {
      console.log(`[aiClient] Trying ${providerConfig.label} (${providerConfig.provider} / ${providerConfig.model})...`);
      const text = await callProvider(providerConfig, messages, systemPrompt, maxTokens);
      console.log(`[aiClient] Success with ${providerConfig.label} (${providerConfig.provider}).`);
      return { text, keyLabel: providerConfig.label };
    } catch (err) {
      const status = err?.status ?? 0;
      console.warn(`[aiClient] ${providerConfig.label} (${providerConfig.provider}) failed — status ${status}: ${err?.body ?? err}`);

      if (FALLBACK_ON_STATUSES.has(status)) {
        lastError = err;
        continue; // try next provider
      }

      // Non-recoverable error (bad request, parse failure) — don't retry
      throw new Error(`AI request failed (${status}): ${err?.body ?? 'Unknown error'}`);
    }
  }

  throw new Error(
    `All AI providers exhausted. Last error (${lastError?.status}): ${lastError?.body ?? 'Unknown'}`
  );
}

module.exports = { callWithFallback };