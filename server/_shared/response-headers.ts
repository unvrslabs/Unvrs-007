/**
 * Edge-compatible response header helpers.
 *
 * Since Edge functions don't have mutable response objects during handler execution,
 * these helpers attach metadata to the request object that can be read later
 * when constructing the final Response.
 */

const HEADERS_KEY = '__wm_response_headers__';
const NO_CACHE_KEY = '__wm_no_cache__';

/**
 * Mark a request so the gateway knows to set Cache-Control: no-store.
 */
export function markNoCacheResponse(request: Request): void {
  (request as unknown as Record<string, unknown>)[NO_CACHE_KEY] = true;
}

/**
 * Check whether a request was marked as no-cache.
 */
export function isNoCacheResponse(request: Request): boolean {
  return !!(request as unknown as Record<string, unknown>)[NO_CACHE_KEY];
}

/**
 * Attach a custom response header to the request metadata.
 * The gateway merges these into the final Response.
 */
export function setResponseHeader(request: Request, name: string, value: string): void {
  const req = request as unknown as Record<string, unknown>;
  if (!req[HEADERS_KEY]) req[HEADERS_KEY] = {} as Record<string, string>;
  (req[HEADERS_KEY] as Record<string, string>)[name] = value;
}

/**
 * Retrieve all custom response headers attached to a request.
 */
export function getResponseHeaders(request: Request): Record<string, string> {
  return ((request as unknown as Record<string, unknown>)[HEADERS_KEY] as Record<string, string>) || {};
}
