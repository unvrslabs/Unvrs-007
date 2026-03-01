import type {
  ServerContext,
  ListIranEventsRequest,
  ListIranEventsResponse,
  IranEvent,
} from '../../../../src/generated/server/worldmonitor/conflict/v1/service_server';

import { getCachedJson, setCachedJson } from '../../../_shared/redis';
import { fetchAcledCached, type AcledRawEvent } from '../../../_shared/acled';

const REDIS_KEY = 'conflict:iran-events:v1';
const CACHE_TTL = 1800; // 30 min

/** Countries relevant to an Iran-conflict layer */
const IRAN_COUNTRIES = ['Iran', 'Israel', 'Iraq', 'Syria', 'Lebanon', 'Yemen'];

/** All ACLED event types relevant for conflict/military activity */
const EVENT_TYPES = 'Battles,Explosions/Remote violence,Violence against civilians,Strategic developments';

function severityFromAcled(e: AcledRawEvent): string {
  const fatalities = parseInt(e.fatalities || '0', 10);
  if (fatalities >= 10) return 'high';
  if (fatalities >= 1) return 'medium';
  const sub = (e.sub_event_type || '').toLowerCase();
  if (sub.includes('air') || sub.includes('missile') || sub.includes('drone') || sub.includes('shelling')) return 'high';
  if (sub.includes('armed clash') || sub.includes('suicide bomb')) return 'medium';
  return 'low';
}

function categoryFromAcled(e: AcledRawEvent): string {
  const type = (e.event_type || '').toLowerCase();
  const sub = (e.sub_event_type || '').toLowerCase();
  if (type.includes('battle') || sub.includes('armed clash') || sub.includes('air') || sub.includes('missile') || sub.includes('drone')) return 'military';
  if (type.includes('explosion') || sub.includes('remote')) return 'military';
  if (type.includes('strategic')) return 'diplomacy';
  if (type.includes('violence against')) return 'military';
  return 'politics';
}

function acledToIranEvent(e: AcledRawEvent): IranEvent | null {
  const lat = parseFloat(e.latitude || '');
  const lon = parseFloat(e.longitude || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const title = e.notes || e.sub_event_type || e.event_type || 'Unknown event';

  return {
    id: e.event_id_cnty || `acled-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.length > 200 ? title.slice(0, 197) + '...' : title,
    category: categoryFromAcled(e),
    sourceUrl: '',
    latitude: lat,
    longitude: lon,
    locationName: [e.location, e.admin1, e.country].filter(Boolean).join(', '),
    timestamp: e.event_date ? new Date(e.event_date).getTime() : Date.now(),
    severity: severityFromAcled(e),
  };
}

export async function listIranEvents(
  _ctx: ServerContext,
  _req: ListIranEventsRequest,
): Promise<ListIranEventsResponse> {
  // 1. Try Redis cache first
  try {
    const cached = await getCachedJson(REDIS_KEY);
    if (cached && typeof cached === 'object' && 'events' in (cached as Record<string, unknown>)) {
      const c = cached as ListIranEventsResponse;
      if (c.events.length > 0) return c;
    }
  } catch { /* fall through to fetch */ }

  // 2. Fetch fresh data from ACLED
  try {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10); // last 90 days

    const allEvents: AcledRawEvent[] = [];
    for (const country of IRAN_COUNTRIES) {
      const events = await fetchAcledCached({
        eventTypes: EVENT_TYPES,
        startDate: start,
        endDate: end,
        country,
        limit: 200,
      });
      allEvents.push(...events);
    }

    // Also filter by Iran-related actors/notes in broader Middle East events
    const iranKeywords = /\biran\b|\birgc\b|\bhezbollah\b|\bhouthi\b|\bquds\b|\bpasdaran\b/i;
    const mapped = allEvents
      .filter(e => {
        // Keep all events from Iran itself
        if ((e.country || '').toLowerCase() === 'iran') return true;
        // For other countries, only keep events mentioning Iran-linked actors
        const text = `${e.actor1 || ''} ${e.actor2 || ''} ${e.notes || ''} ${e.tags || ''}`;
        return iranKeywords.test(text);
      })
      .map(acledToIranEvent)
      .filter((e): e is IranEvent => e !== null)
      // Deduplicate by id
      .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
      // Sort by timestamp descending
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 500);

    const response: ListIranEventsResponse = {
      events: mapped,
      scrapedAt: Date.now(),
    };

    if (mapped.length > 0) {
      await setCachedJson(REDIS_KEY, response, CACHE_TTL).catch(() => {});
    }

    return response;
  } catch {
    return { events: [], scrapedAt: 0 };
  }
}
