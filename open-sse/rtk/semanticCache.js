/**
 * Exact response cache for non-streaming requests.
 */

import crypto from "crypto";

const responseCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

function cacheKey(body, model, apiKey) {
  if (!apiKey) return null;
  try {
    return crypto.createHash("sha256")
      .update(JSON.stringify({ apiKey, model, body }))
      .digest("hex");
  } catch {
    return null;
  }
}

export function checkSemanticCache(body, model, apiKey) {
  if (!body || body.stream) return null;
  if (body.tool_choice && body.tool_choice !== "auto") return null;

  const hashKey = cacheKey(body, model, apiKey);
  if (!hashKey) return null;

  const cached = responseCache.get(hashKey);
  if (cached && Date.now() < cached.expiresAt) return cached.response;

  if (cached) responseCache.delete(hashKey);
  return null;
}

export function saveToSemanticCache(body, model, responseBody, apiKey) {
  if (!body || body.stream || !responseBody) return;
  if (body.tool_choice && body.tool_choice !== "auto") return;
  if (responseBody.error || responseBody.is_error) return;

  const hashKey = cacheKey(body, model, apiKey);
  if (!hashKey) return;

  responseCache.set(hashKey, {
    response: responseBody,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  if (responseCache.size > 1000) {
    responseCache.delete(responseCache.keys().next().value);
  }
}
