import { GEMINI_WORKER_URL } from '../config/constants.js';

// Client errors are POSTed here and land in the gemini worker's Workers Logs,
// so frontend + backend failures live in one searchable place.
const LOG_ENDPOINT = `${GEMINI_WORKER_URL}/log`;

/**
 * Log an error. Always prints to the devtools console; best-effort ships a
 * structured entry to the worker log sink. Never throws — logging must not
 * break the flow it's reporting on.
 *
 * @param {string} context  Feature tag, e.g. 'chat.send', 'excel.export'
 * @param {unknown} error   The caught error
 * @param {object} [meta]   Extra context (ids, inputs) — keep it small & non-PII
 */
export function logError(context, error, meta = {}) {
  const entry = {
    context,
    message: error?.message || String(error),
    stack: typeof error?.stack === 'string' ? error.stack.slice(0, 2000) : undefined,
    meta,
    ts: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.href : undefined,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // Always visible locally.
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, error, meta);

  // Fire-and-forget to the sink; swallow any failure.
  try {
    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true, // survives page navigation/unload
    }).catch(() => {});
  } catch {
    // ignore — logging is never allowed to throw
  }
}
