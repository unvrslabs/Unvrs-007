export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type EventCategory =
  | 'conflict' | 'protest' | 'disaster' | 'diplomatic' | 'economic'
  | 'terrorism' | 'cyber' | 'health' | 'environmental' | 'military'
  | 'crime' | 'infrastructure' | 'tech' | 'general';

export interface ThreatClassification {
  level: ThreatLevel;
  category: EventCategory;
  confidence: number;
  source: 'keyword' | 'ml' | 'llm';
}

import { getCSSColor } from '@/utils';

/** @deprecated Use getThreatColor() instead for runtime CSS variable reads */
export const THREAT_COLORS: Record<ThreatLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
};

const THREAT_VAR_MAP: Record<ThreatLevel, string> = {
  critical: '--threat-critical',
  high: '--threat-high',
  medium: '--threat-medium',
  low: '--threat-low',
  info: '--threat-info',
};

export function getThreatColor(level: string): string {
  return getCSSColor(THREAT_VAR_MAP[level as ThreatLevel] || '--text-dim');
}

export const THREAT_PRIORITY: Record<ThreatLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

import { t } from '@/services/i18n';

export function getThreatLabel(level: ThreatLevel): string {
  return t(`components.threatLabels.${level}`);
}

export const THREAT_LABELS: Record<ThreatLevel, string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
  info: 'INFO',
};

type KeywordMap = Record<string, EventCategory>;

const CRITICAL_KEYWORDS: KeywordMap = {
  'nuclear strike': 'military',
  'nuclear attack': 'military',
  'nuclear war': 'military',
  'invasion': 'conflict',
  'declaration of war': 'conflict',
  'declares war': 'conflict',
  'all-out war': 'conflict',
  'full-scale war': 'conflict',
  'martial law': 'military',
  'coup': 'military',
  'coup attempt': 'military',
  'genocide': 'conflict',
  'ethnic cleansing': 'conflict',
  'chemical attack': 'terrorism',
  'biological attack': 'terrorism',
  'dirty bomb': 'terrorism',
  'mass casualty': 'conflict',
  'massive strikes': 'military',
  'military strikes': 'military',
  'retaliatory strikes': 'military',
  'launches strikes': 'military',
  'launch attacks on iran': 'military',
  'launch attack on iran': 'military',
  'attacks on iran': 'military',
  'strikes on iran': 'military',
  'strikes iran': 'military',
  'bombs iran': 'military',
  'attacks iran': 'military',
  'attack on iran': 'military',
  'attack iran': 'military',
  'attacked iran': 'military',
  'attack against iran': 'military',
  'bombing iran': 'military',
  'bombed iran': 'military',
  'war with iran': 'conflict',
  'war on iran': 'conflict',
  'war against iran': 'conflict',
  'iran retaliates': 'military',
  'iran strikes': 'military',
  'iran launches': 'military',
  'iran attacks': 'military',
  'pandemic declared': 'health',
  'health emergency': 'health',
  'nato article 5': 'military',
  'evacuation order': 'disaster',
  'meltdown': 'disaster',
  'nuclear meltdown': 'disaster',
  'major combat operations': 'military',
  'declared war': 'conflict',
  // Italian critical keywords
  'attacco nucleare': 'military',
  'guerra nucleare': 'military',
  'invasione': 'conflict',
  'dichiarazione di guerra': 'conflict',
  'dichiara guerra': 'conflict',
  'guerra totale': 'conflict',
  'legge marziale': 'military',
  'colpo di stato': 'military',
  'golpe': 'military',
  'genocidio': 'conflict',
  'pulizia etnica': 'conflict',
  'attacco chimico': 'terrorism',
  'attacco biologico': 'terrorism',
  'bomba sporca': 'terrorism',
  'strage': 'conflict',
  'emergenza sanitaria': 'health',
  'pandemia': 'health',
};

const HIGH_KEYWORDS: KeywordMap = {
  'war': 'conflict',
  'armed conflict': 'conflict',
  'airstrike': 'conflict',
  'airstrikes': 'conflict',
  'air strike': 'conflict',
  'air strikes': 'conflict',
  'drone strike': 'conflict',
  'drone strikes': 'conflict',
  'strikes': 'conflict',
  'missile': 'military',
  'missile launch': 'military',
  'missiles fired': 'military',
  'troops deployed': 'military',
  'military escalation': 'military',
  'military operation': 'military',
  'ground offensive': 'military',
  'bombing': 'conflict',
  'bombardment': 'conflict',
  'shelling': 'conflict',
  'casualties': 'conflict',
  'killed in': 'conflict',
  'hostage': 'terrorism',
  'terrorist': 'terrorism',
  'terror attack': 'terrorism',
  'assassination': 'crime',
  'cyber attack': 'cyber',
  'ransomware': 'cyber',
  'data breach': 'cyber',
  'sanctions': 'economic',
  'embargo': 'economic',
  'earthquake': 'disaster',
  'tsunami': 'disaster',
  'hurricane': 'disaster',
  'typhoon': 'disaster',
  'strike on': 'conflict',
  'strikes on': 'conflict',
  'attack on': 'conflict',
  'attack against': 'conflict',
  'attacks on': 'conflict',
  'launched attack': 'conflict',
  'launched attacks': 'conflict',
  'launches attack': 'conflict',
  'launches attacks': 'conflict',
  'explosions': 'conflict',
  'military operations': 'military',
  'combat operations': 'military',
  'retaliatory strike': 'military',
  'retaliatory attack': 'military',
  'retaliatory attacks': 'military',
  'preemptive strike': 'military',
  'preemptive attack': 'military',
  'preventive attack': 'military',
  'preventative attack': 'military',
  'military offensive': 'military',
  'ballistic missile': 'military',
  'cruise missile': 'military',
  'air defense intercepted': 'military',
  'forces struck': 'conflict',
  // Italian high keywords
  'guerra': 'conflict',
  'conflitto armato': 'conflict',
  'attacco aereo': 'conflict',
  'bombardamento': 'conflict',
  'raid aereo': 'conflict',
  'drone': 'conflict',
  'missili': 'military',
  'lancio di missili': 'military',
  'truppe schierate': 'military',
  'escalation militare': 'military',
  'operazione militare': 'military',
  'offensiva': 'military',
  'vittime': 'conflict',
  'morti': 'conflict',
  'ostaggio': 'terrorism',
  'terrorismo': 'terrorism',
  'attentato': 'terrorism',
  'attentato terroristico': 'terrorism',
  'attacco terroristico': 'terrorism',
  'assassinio': 'crime',
  'attacco informatico': 'cyber',
  'cyberattacco': 'cyber',
  'sanzioni': 'economic',
  'terremoto': 'disaster',
  'esplosione': 'conflict',
  'esplosioni': 'conflict',
};

const MEDIUM_KEYWORDS: KeywordMap = {
  'protest': 'protest',
  'protests': 'protest',
  'riot': 'protest',
  'riots': 'protest',
  'unrest': 'protest',
  'demonstration': 'protest',
  'strike action': 'protest',
  'military exercise': 'military',
  'naval exercise': 'military',
  'arms deal': 'military',
  'weapons sale': 'military',
  'diplomatic crisis': 'diplomatic',
  'ambassador recalled': 'diplomatic',
  'expel diplomats': 'diplomatic',
  'trade war': 'economic',
  'tariff': 'economic',
  'recession': 'economic',
  'inflation': 'economic',
  'market crash': 'economic',
  'flood': 'disaster',
  'flooding': 'disaster',
  'wildfire': 'disaster',
  'volcano': 'disaster',
  'eruption': 'disaster',
  'outbreak': 'health',
  'epidemic': 'health',
  'infection spread': 'health',
  'oil spill': 'environmental',
  'pipeline explosion': 'infrastructure',
  'blackout': 'infrastructure',
  'power outage': 'infrastructure',
  'internet outage': 'infrastructure',
  'derailment': 'infrastructure',
  // Italian medium keywords
  'protesta': 'protest',
  'proteste': 'protest',
  'rivolta': 'protest',
  'disordini': 'protest',
  'manifestazione': 'protest',
  'sciopero': 'protest',
  'esercitazione militare': 'military',
  'esercitazione navale': 'military',
  'vendita armi': 'military',
  'crisi diplomatica': 'diplomatic',
  'ambasciatore richiamato': 'diplomatic',
  'espulsione diplomatici': 'diplomatic',
  'guerra commerciale': 'economic',
  'dazi': 'economic',
  'recessione': 'economic',
  'inflazione': 'economic',
  'crollo mercati': 'economic',
  'alluvione': 'disaster',
  'incendio': 'disaster',
  'eruzione': 'disaster',
  'epidemia': 'health',
  'emergenza': 'disaster',
  'deragliamento': 'infrastructure',
  'mafia': 'crime',
  'ndrangheta': 'crime',
  'camorra': 'crime',
  'criminalità organizzata': 'crime',
  'arresto': 'crime',
  'sequestro': 'crime',
};

const LOW_KEYWORDS: KeywordMap = {
  'election': 'diplomatic',
  'vote': 'diplomatic',
  'referendum': 'diplomatic',
  'summit': 'diplomatic',
  'treaty': 'diplomatic',
  'agreement': 'diplomatic',
  'negotiation': 'diplomatic',
  'talks': 'diplomatic',
  'peacekeeping': 'diplomatic',
  'humanitarian aid': 'diplomatic',
  'ceasefire': 'diplomatic',
  'peace treaty': 'diplomatic',
  'climate change': 'environmental',
  'emissions': 'environmental',
  'pollution': 'environmental',
  'deforestation': 'environmental',
  'drought': 'environmental',
  'vaccine': 'health',
  'vaccination': 'health',
  'disease': 'health',
  'virus': 'health',
  'public health': 'health',
  'covid': 'health',
  'interest rate': 'economic',
  'gdp': 'economic',
  'unemployment': 'economic',
  'regulation': 'economic',
  // Italian low keywords
  'elezioni': 'diplomatic',
  'voto': 'diplomatic',
  'vertice': 'diplomatic',
  'trattato': 'diplomatic',
  'accordo': 'diplomatic',
  'negoziati': 'diplomatic',
  'colloqui': 'diplomatic',
  'cessate il fuoco': 'diplomatic',
  'trattato di pace': 'diplomatic',
  'cambiamento climatico': 'environmental',
  'inquinamento': 'environmental',
  'siccità': 'environmental',
  'vaccino': 'health',
  'vaccinazione': 'health',
  'tasso di interesse': 'economic',
  'disoccupazione': 'economic',
  'pil': 'economic',
};

const TECH_HIGH_KEYWORDS: KeywordMap = {
  'major outage': 'infrastructure',
  'service down': 'infrastructure',
  'global outage': 'infrastructure',
  'zero-day': 'cyber',
  'critical vulnerability': 'cyber',
  'supply chain attack': 'cyber',
  'mass layoff': 'economic',
};

const TECH_MEDIUM_KEYWORDS: KeywordMap = {
  'outage': 'infrastructure',
  'breach': 'cyber',
  'hack': 'cyber',
  'vulnerability': 'cyber',
  'layoff': 'economic',
  'layoffs': 'economic',
  'antitrust': 'economic',
  'monopoly': 'economic',
  'ban': 'economic',
  'shutdown': 'infrastructure',
};

const TECH_LOW_KEYWORDS: KeywordMap = {
  'ipo': 'economic',
  'funding': 'economic',
  'acquisition': 'economic',
  'merger': 'economic',
  'launch': 'tech',
  'release': 'tech',
  'update': 'tech',
  'partnership': 'economic',
  'startup': 'tech',
  'ai model': 'tech',
  'open source': 'tech',
};

const EXCLUSIONS = [
  'protein', 'couples', 'relationship', 'dating', 'diet', 'fitness',
  'recipe', 'cooking', 'shopping', 'fashion', 'celebrity', 'movie',
  'tv show', 'sports', 'game', 'concert', 'festival', 'wedding',
  'vacation', 'travel tips', 'life hack', 'self-care', 'wellness',
  'strikes deal', 'strikes agreement', 'strikes partnership',
];

const SHORT_KEYWORDS = new Set([
  'war', 'coup', 'ban', 'vote', 'riot', 'riots', 'hack', 'talks', 'ipo', 'gdp',
  'virus', 'disease', 'flood', 'strikes',
  'guerra', 'golpe', 'voto', 'morti', 'drone', 'mafia', 'dazi', 'pil',
]);

const TRAILING_BOUNDARY_KEYWORDS = new Set([
  'attack iran', 'attacked iran', 'attack on iran', 'attack against iran',
  'attacks on iran', 'launch attacks on iran', 'launch attack on iran',
  'bombing iran', 'bombed iran', 'strikes iran', 'attacks iran',
  'bombs iran', 'war on iran', 'war with iran', 'war against iran',
  'iran retaliates', 'iran strikes', 'iran launches', 'iran attacks',
]);

const keywordRegexCache = new Map<string, RegExp>();

function getKeywordRegex(kw: string): RegExp {
  let re = keywordRegexCache.get(kw);
  if (!re) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (SHORT_KEYWORDS.has(kw)) {
      re = new RegExp(`\\b${escaped}\\b`);
    } else if (TRAILING_BOUNDARY_KEYWORDS.has(kw)) {
      re = new RegExp(`${escaped}(?![\\w-])`);
    } else {
      re = new RegExp(escaped);
    }
    keywordRegexCache.set(kw, re);
  }
  return re;
}

function matchKeywords(
  titleLower: string,
  keywords: KeywordMap
): { keyword: string; category: EventCategory } | null {
  for (const [kw, cat] of Object.entries(keywords)) {
    if (getKeywordRegex(kw).test(titleLower)) {
      return { keyword: kw, category: cat };
    }
  }
  return null;
}

// Compound escalation: HIGH military/conflict + critical geopolitical target → CRITICAL
// Handles headlines like "strikes by US and Israel on Iran" where words aren't adjacent
const ESCALATION_ACTIONS = /\b(attack|attacks|attacked|strike|strikes|struck|bomb|bombs|bombed|bombing|shell|shelled|shelling|missile|missiles|intercept|intercepted|retaliates|retaliating|retaliation|killed|casualties|offensive|invaded|invades)\b/;
const ESCALATION_TARGETS = /\b(iran|tehran|isfahan|tabriz|russia|moscow|china|beijing|taiwan|taipei|north korea|pyongyang|nato|us base|us forces|american forces|us military)\b/;

function shouldEscalateToCritical(lower: string, matchCat: EventCategory): boolean {
  if (matchCat !== 'conflict' && matchCat !== 'military') return false;
  return ESCALATION_ACTIONS.test(lower) && ESCALATION_TARGETS.test(lower);
}

export function classifyByKeyword(title: string, variant = 'full'): ThreatClassification {
  const lower = title.toLowerCase();

  if (EXCLUSIONS.some(ex => lower.includes(ex))) {
    return { level: 'info', category: 'general', confidence: 0.3, source: 'keyword' };
  }

  const isTech = variant === 'tech';

  // Priority cascade: critical → high → medium → low → info
  let match = matchKeywords(lower, CRITICAL_KEYWORDS);
  if (match) return { level: 'critical', category: match.category, confidence: 0.9, source: 'keyword' };

  match = matchKeywords(lower, HIGH_KEYWORDS);
  if (match) {
    // Compound escalation: military action + critical geopolitical target → CRITICAL
    if (shouldEscalateToCritical(lower, match.category)) {
      return { level: 'critical', category: match.category, confidence: 0.85, source: 'keyword' };
    }
    return { level: 'high', category: match.category, confidence: 0.8, source: 'keyword' };
  }

  if (isTech) {
    match = matchKeywords(lower, TECH_HIGH_KEYWORDS);
    if (match) return { level: 'high', category: match.category, confidence: 0.75, source: 'keyword' };
  }

  match = matchKeywords(lower, MEDIUM_KEYWORDS);
  if (match) return { level: 'medium', category: match.category, confidence: 0.7, source: 'keyword' };

  if (isTech) {
    match = matchKeywords(lower, TECH_MEDIUM_KEYWORDS);
    if (match) return { level: 'medium', category: match.category, confidence: 0.65, source: 'keyword' };
  }

  match = matchKeywords(lower, LOW_KEYWORDS);
  if (match) return { level: 'low', category: match.category, confidence: 0.6, source: 'keyword' };

  if (isTech) {
    match = matchKeywords(lower, TECH_LOW_KEYWORDS);
    if (match) return { level: 'low', category: match.category, confidence: 0.55, source: 'keyword' };
  }

  return { level: 'info', category: 'general', confidence: 0.3, source: 'keyword' };
}

// Batched AI classification — collects headlines then fires parallel classifyEvent RPCs
import {
  IntelligenceServiceClient,
  ApiError,
  type ClassifyEventResponse,
} from '@/generated/client/worldmonitor/intelligence/v1/service_client';

const classifyClient = new IntelligenceServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });

const VALID_LEVELS: Record<string, ThreatLevel> = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info',
};

function toThreat(resp: ClassifyEventResponse): ThreatClassification | null {
  const c = resp.classification;
  if (!c) return null;
  // Raw level preserved in subcategory by the handler
  const level = VALID_LEVELS[c.subcategory] ?? VALID_LEVELS[c.category] ?? null;
  if (!level) return null;
  return {
    level,
    category: c.category as EventCategory,
    confidence: c.confidence || 0.9,
    source: 'llm',
  };
}

type BatchJob = {
  title: string;
  variant: string;
  resolve: (v: ThreatClassification | null) => void;
  attempts?: number;
};

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 500;
const STAGGER_BASE_MS = 2100;
const STAGGER_JITTER_MS = 200;
const MIN_GAP_MS = 2000;
const MAX_RETRIES = 2;
const MAX_QUEUE_LENGTH = 100;
let batchPaused = false;
let batchInFlight = false;
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let lastRequestAt = 0;
const batchQueue: BatchJob[] = [];

async function waitForGap(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_GAP_MS) {
    await new Promise<void>(r => setTimeout(r, MIN_GAP_MS - elapsed));
  }
  const jitter = Math.floor(Math.random() * STAGGER_JITTER_MS * 2) - STAGGER_JITTER_MS;
  const extra = Math.max(0, STAGGER_BASE_MS - MIN_GAP_MS + jitter);
  if (extra > 0) await new Promise<void>(r => setTimeout(r, extra));
  lastRequestAt = Date.now();
}

function flushBatch(): void {
  batchTimer = null;
  if (batchPaused || batchInFlight || batchQueue.length === 0) return;
  batchInFlight = true;

  const batch = batchQueue.splice(0, BATCH_SIZE);
  if (batch.length === 0) { batchInFlight = false; return; }

  (async () => {
    try {
      for (let i = 0; i < batch.length; i++) {
        const job = batch[i]!;
        if (batchPaused) { job.resolve(null); continue; }

        await waitForGap();

        try {
          const resp = await classifyClient.classifyEvent({
            title: job.title, description: '', source: '', country: '',
          });
          job.resolve(toThreat(resp));
        } catch (err) {
          if (err instanceof ApiError && (err.statusCode === 429 || err.statusCode >= 500)) {
            batchPaused = true;
            const delay = err.statusCode === 429 ? 60_000 : 30_000;
            console.warn(`[Classify] ${err.statusCode} — pausing AI classification for ${delay / 1000}s`);
            const remaining = batch.slice(i + 1);
            // Failed job: increment attempts, requeue if under limit
            if ((job.attempts ?? 0) < MAX_RETRIES) {
              job.attempts = (job.attempts ?? 0) + 1;
              batchQueue.unshift(job);
            } else {
              job.resolve(null);
            }
            // Remaining jobs never hit the API — requeue without burning attempts
            for (let j = remaining.length - 1; j >= 0; j--) {
              batchQueue.unshift(remaining[j]!);
            }
            batchInFlight = false;
            setTimeout(() => { batchPaused = false; scheduleBatch(); }, delay);
            return;
          }
          job.resolve(null);
        }
      }
    } finally {
      if (batchInFlight) {
        batchInFlight = false;
        scheduleBatch();
      }
    }
  })();
}

function scheduleBatch(): void {
  if (batchTimer || batchPaused || batchInFlight || batchQueue.length === 0) return;
  if (batchQueue.length >= BATCH_SIZE) {
    flushBatch();
  } else {
    batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
  }
}

export function classifyWithAI(
  title: string,
  variant: string
): Promise<ThreatClassification | null> {
  return new Promise((resolve) => {
    if (batchQueue.length >= MAX_QUEUE_LENGTH) {
      console.warn(`[Classify] Queue full (${MAX_QUEUE_LENGTH}), dropping classification for: ${title.slice(0, 60)}`);
      resolve(null);
      return;
    }
    batchQueue.push({ title, variant, resolve });
    scheduleBatch();
  });
}

export function aggregateThreats(
  items: Array<{ threat?: ThreatClassification; tier?: number }>
): ThreatClassification {
  const withThreat = items.filter(i => i.threat);
  if (withThreat.length === 0) {
    return { level: 'info', category: 'general', confidence: 0.3, source: 'keyword' };
  }

  // Level = max across items
  let maxLevel: ThreatLevel = 'info';
  let maxPriority = 0;
  for (const item of withThreat) {
    const p = THREAT_PRIORITY[item.threat!.level];
    if (p > maxPriority) {
      maxPriority = p;
      maxLevel = item.threat!.level;
    }
  }

  // Category = most frequent
  const catCounts = new Map<EventCategory, number>();
  for (const item of withThreat) {
    const cat = item.threat!.category;
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  let topCat: EventCategory = 'general';
  let topCount = 0;
  for (const [cat, count] of catCounts) {
    if (count > topCount) {
      topCount = count;
      topCat = cat;
    }
  }

  // Confidence = weighted avg by source tier (lower tier = higher weight)
  let weightedSum = 0;
  let weightTotal = 0;
  for (const item of withThreat) {
    const weight = item.tier ? (6 - Math.min(item.tier, 5)) : 1;
    weightedSum += item.threat!.confidence * weight;
    weightTotal += weight;
  }

  return {
    level: maxLevel,
    category: topCat,
    confidence: weightTotal > 0 ? weightedSum / weightTotal : 0.5,
    source: 'keyword',
  };
}
