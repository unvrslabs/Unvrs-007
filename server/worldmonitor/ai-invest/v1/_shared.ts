/**
 * Shared constants and helpers for the AI invest service handlers.
 */

export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'llama-3.1-8b-instant';
export const UPSTREAM_TIMEOUT_MS = 30_000;
export const ANALYSIS_CACHE_TTL = 900; // 15 min
export const RADAR_CACHE_TTL = 300; // 5 min

export { hashString } from '../../../_shared/hash';
