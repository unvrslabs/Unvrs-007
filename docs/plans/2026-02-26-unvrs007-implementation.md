# UNVRS 007 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trasformare il fork di worldmonitor in UNVRS 007 — stessa funzionalità, brand completamente nuovo, design liquid glass, API key indipendenti, deploy su `007.unvrslabs.dev`.

**Architecture:** Variante `007` aggiunta al sistema di varianti esistente. Ogni modifica è isolata (nuovi file CSS/TS, entry nel vite.config, CORS aggiornato). Il codice core rimane intatto — la variante sovrascrive solo tema, brand e config.

**Tech Stack:** Vite + React + TypeScript, CSS @layer cascade, CORS in Vercel Edge Functions

---

### Task 1: Aggiungere scripts `dev:007` e `build:007` a package.json

**Files:**
- Modify: `package.json`

**Step 1: Aggiungere gli script**

Aprire `package.json`. Nella sezione `scripts`, dopo `"dev:happy"`, aggiungere:

```json
"dev:007": "VITE_VARIANT=007 vite",
"build:007": "VITE_VARIANT=007 tsc && VITE_VARIANT=007 vite build",
```

**Step 2: Verificare**

```bash
cd "/Users/emanuelemaccari/unvrs claude/worldmonitor"
npm run dev:007 -- --help
```
Expected: Vite help output (conferma che lo script è valido).

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat(007): add dev:007 and build:007 scripts"
```

---

### Task 2: Aggiungere metadati variante `007` a vite.config.ts

**Files:**
- Modify: `vite.config.ts`

**Step 1: Leggere la struttura VARIANT_META esistente**

In `vite.config.ts` trovare l'oggetto `VARIANT_META`. Contiene le chiavi `full`, `tech`, `happy`, `finance`.

**Step 2: Aggiungere la chiave `007`**

Dopo la chiave `finance`, aggiungere:

```typescript
'007': {
  title: 'UNVRS 007 — Global Intelligence Dashboard',
  description: 'Real-time global intelligence dashboard. Live news, markets, military tracking, geopolitical data and AI insights — all in one view.',
  keywords: 'global intelligence, geopolitical dashboard, OSINT, real-time monitoring, world news, market data, military tracking, conflict zones, situation awareness, UNVRS',
  url: 'https://007.unvrslabs.dev/',
  siteName: 'UNVRS 007',
  shortName: 'UNVRS007',
  subject: 'Real-Time Global Intelligence and Situation Awareness',
  classification: 'Intelligence Dashboard, OSINT Tool, News Aggregator',
  categories: ['news', 'productivity'],
  features: [
    'Real-time news aggregation',
    'Stock market tracking',
    'Military flight monitoring',
    'Ship AIS tracking',
    'Earthquake alerts',
    'Protest tracking',
    'Power outage monitoring',
    'Oil price analytics',
    'Government spending data',
    'Prediction markets',
    'Infrastructure monitoring',
    'Geopolitical intelligence',
  ],
},
```

**Step 3: Trovare dove vite.config usa VARIANT_META per generare index.html**

Cercare nel file dove si usa `VARIANT_META[variant]` o simile. Assicurarsi che `007` sia trattato come fallback (se non trovato, usa `full`). In genere c'è una riga tipo:
```typescript
const meta = VARIANT_META[variant] ?? VARIANT_META['full'];
```
Se non c'è il fallback, aggiungerlo.

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat(007): add UNVRS007 variant metadata to vite.config"
```

---

### Task 3: Creare la config TypeScript della variante 007

**Files:**
- Create: `src/config/variants/007.ts`

**Step 1: Creare il file**

```typescript
// UNVRS 007 variant — full geopolitical intelligence, UNVRS brand
// Basato su full.ts con tutte le feature abilitate
import type { PanelConfig, MapLayers } from '@/types';
import type { VariantConfig } from './base';

// Re-export base config
export * from './base';

// Same data sources as full variant
export * from '../feeds';
export * from '../geo';
export * from '../irradiators';
export * from '../pipelines';
export * from '../ports';
export * from '../military';
export * from '../airports';
export * from '../entities';

// Tutti i pannelli abilitati (copia da full.ts — modificare a piacere in futuro)
export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  map: { name: 'Global Map', enabled: true, priority: 1 },
  'live-news': { name: 'Live News', enabled: true, priority: 1 },
  intel: { name: 'Intel Feed', enabled: true, priority: 1 },
  'gdelt-intel': { name: 'Live Intelligence', enabled: true, priority: 1 },
  cii: { name: 'Country Instability', enabled: true, priority: 1 },
  cascade: { name: 'Infrastructure Cascade', enabled: true, priority: 1 },
  'strategic-risk': { name: 'Strategic Risk Overview', enabled: true, priority: 1 },
  politics: { name: 'World News', enabled: true, priority: 1 },
  us: { name: 'United States', enabled: true, priority: 1 },
  europe: { name: 'Europe', enabled: true, priority: 1 },
  middleeast: { name: 'Middle East', enabled: true, priority: 1 },
  africa: { name: 'Africa', enabled: true, priority: 1 },
  latam: { name: 'Latin America', enabled: true, priority: 1 },
  asia: { name: 'Asia-Pacific', enabled: true, priority: 1 },
  energy: { name: 'Energy & Resources', enabled: true, priority: 1 },
  gov: { name: 'Government', enabled: true, priority: 1 },
  thinktanks: { name: 'Think Tanks', enabled: true, priority: 1 },
  polymarket: { name: 'Predictions', enabled: true, priority: 1 },
  commodities: { name: 'Commodities', enabled: true, priority: 1 },
  markets: { name: 'Markets', enabled: true, priority: 1 },
  economic: { name: 'Economic Indicators', enabled: true, priority: 1 },
  finance: { name: 'Financial', enabled: true, priority: 1 },
  tech: { name: 'Technology', enabled: true, priority: 2 },
  crypto: { name: 'Crypto', enabled: true, priority: 2 },
  heatmap: { name: 'Sector Heatmap', enabled: true, priority: 2 },
  ai: { name: 'AI/ML', enabled: true, priority: 2 },
  layoffs: { name: 'Layoffs Tracker', enabled: false, priority: 2 },
  'macro-signals': { name: 'Market Radar', enabled: true, priority: 2 },
  'etf-flows': { name: 'BTC ETF Tracker', enabled: true, priority: 2 },
  stablecoins: { name: 'Stablecoins', enabled: true, priority: 2 },
  monitors: { name: 'My Monitors', enabled: true, priority: 2 },
};

// Stesse layer default del variant full
export const DEFAULT_MAP_LAYERS: MapLayers = {
  conflicts: true,
  bases: true,
  cables: false,
  pipelines: false,
  hotspots: true,
  ais: false,
  nuclear: true,
  irradiators: false,
  sanctions: true,
  weather: true,
  economic: true,
  waterways: true,
  outages: true,
  cyberThreats: false,
  datacenters: false,
  protests: false,
  flights: false,
  military: false,
  natural: true,
  spaceports: false,
  minerals: false,
  fires: false,
  ucdpEvents: false,
  displacement: false,
  climate: false,
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: false,
  gulfInvestments: false,
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: false,
};

export const MOBILE_DEFAULT_MAP_LAYERS: MapLayers = {
  ...DEFAULT_MAP_LAYERS,
  bases: false,
  nuclear: false,
  economic: false,
  waterways: false,
};

export const VARIANT_CONFIG: VariantConfig = {
  name: '007',
  description: 'UNVRS 007 — Global Intelligence Dashboard',
  panels: DEFAULT_PANELS,
  mapLayers: DEFAULT_MAP_LAYERS,
  mobileMapLayers: MOBILE_DEFAULT_MAP_LAYERS,
};
```

**Step 2: Commit**

```bash
git add src/config/variants/007.ts
git commit -m "feat(007): add 007 variant config"
```

---

### Task 4: Aggiornare variant.ts per riconoscere `007`

**Files:**
- Modify: `src/config/variant.ts`

**Step 1: Leggere il file corrente**

Il file contiene:
```typescript
const stored = localStorage.getItem('worldmonitor-variant');
if (stored === 'tech' || stored === 'full' || stored === 'finance' || stored === 'happy') return stored;
```

**Step 2: Aggiungere `007` alla lista valida**

Modificare la riga dell'if per includere `'007'`:

```typescript
if (stored === 'tech' || stored === 'full' || stored === 'finance' || stored === 'happy' || stored === '007') return stored;
```

**Step 3: Commit**

```bash
git add src/config/variant.ts
git commit -m "feat(007): register 007 as valid variant in variant.ts"
```

---

### Task 5: Aggiornare App.ts per trattare `007` come `full`

**Files:**
- Modify: `src/App.ts`

**Step 1: Trovare tutti i check su SITE_VARIANT**

Cercare le righe:
```
if (SITE_VARIANT === 'full' || SITE_VARIANT === 'finance')
if (SITE_VARIANT === 'full')
if (SITE_VARIANT !== 'happy')
```

**Step 2: Aggiungere `007` ai check rilevanti**

- Dove c'è `SITE_VARIANT === 'full'` → aggiungere `|| SITE_VARIANT === '007'`
- Dove c'è `SITE_VARIANT !== 'happy'` → lasciare invariato (007 non è happy, passa già)
- Dove c'è `SITE_VARIANT === 'full' || SITE_VARIANT === 'finance'` → aggiungere `|| SITE_VARIANT === '007'`

Esempio:
```typescript
// PRIMA
if (SITE_VARIANT === 'full') {
// DOPO
if (SITE_VARIANT === 'full' || SITE_VARIANT === '007') {
```

**Step 3: Trovare e aggiornare il localStorage variant key**

Cercare:
```typescript
const storedVariant = localStorage.getItem('worldmonitor-variant');
```
Lasciare invariato per ora (compatibilità).

**Step 4: Commit**

```bash
git add src/App.ts
git commit -m "feat(007): treat 007 variant like full in App.ts"
```

---

### Task 6: Creare il tema CSS liquid glass per 007

**Files:**
- Create: `src/styles/007-theme.css`
- Modify: `src/styles/base-layer.css`

**Step 1: Creare il file del tema**

```css
/* ============================================================
   UNVRS 007 Theme — Liquid Glass on Deep Space
   Silver/white glass over #04080f. No teal, no military green.
   Unlayered CSS — wins over main.css via @layer base.
   ============================================================ */

:root[data-variant="007"] {
  /* --- Core backgrounds --- */
  --bg: #04080f;
  --bg-secondary: #060c16;
  --surface: rgba(255, 255, 255, 0.04);
  --surface-hover: rgba(255, 255, 255, 0.07);
  --surface-active: rgba(255, 255, 255, 0.10);

  /* --- Glass borders --- */
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.15);
  --border-subtle: rgba(255, 255, 255, 0.04);

  /* --- Accent (silver-white cold) --- */
  --accent: #e8e8f0;
  --accent-dim: rgba(232, 232, 240, 0.4);
  --accent-glow: rgba(180, 180, 255, 0.6);
  --accent-subtle: rgba(232, 232, 240, 0.08);

  /* --- Text --- */
  --text: #e8e8f0;
  --text-secondary: rgba(232, 232, 240, 0.7);
  --text-dim: rgba(232, 232, 240, 0.5);
  --text-muted: rgba(232, 232, 240, 0.35);
  --text-faint: rgba(232, 232, 240, 0.2);
  --text-ghost: rgba(232, 232, 240, 0.1);

  /* --- Overlays --- */
  --overlay-subtle: rgba(232, 232, 240, 0.02);
  --overlay-light: rgba(232, 232, 240, 0.04);
  --overlay-medium: rgba(232, 232, 240, 0.07);
  --overlay-heavy: rgba(232, 232, 240, 0.12);
  --shadow-color: rgba(0, 0, 0, 0.6);

  /* --- Glass blur --- */
  --glass-blur: blur(24px);
  --glass-blur-sm: blur(12px);
  --glass-blur-lg: blur(40px);

  /* --- Typography --- */
  --font-body: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', ui-monospace, monospace;
  --font-display: 'Cormorant Garamond', Georgia, serif;

  /* --- Status colors (muted for glass aesthetic) --- */
  --color-danger: rgba(255, 80, 80, 0.9);
  --color-warning: rgba(255, 180, 60, 0.9);
  --color-success: rgba(80, 220, 140, 0.9);
  --color-info: rgba(100, 160, 255, 0.9);

  /* --- Panels --- */
  --panel-bg: rgba(255, 255, 255, 0.04);
  --panel-border: rgba(255, 255, 255, 0.08);
  --panel-header-bg: rgba(255, 255, 255, 0.06);

  /* --- Scrollbar --- */
  --scrollbar-thumb: rgba(255, 255, 255, 0.12);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.22);

  /* --- Input --- */
  --input-bg: rgba(255, 255, 255, 0.05);
}

/* ---- Glass panel utility ---- */
:root[data-variant="007"] .panel,
:root[data-variant="007"] [class*="panel"],
:root[data-variant="007"] [class*="card"] {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

:root[data-variant="007"] .panel:hover,
:root[data-variant="007"] [class*="panel"]:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

/* ---- Header / Toolbar ---- */
:root[data-variant="007"] header,
:root[data-variant="007"] .toolbar,
:root[data-variant="007"] nav {
  background: rgba(4, 8, 15, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

/* ---- Accent color overrides (replaces teal #00d4c8) ---- */
:root[data-variant="007"] .accent,
:root[data-variant="007"] [class*="accent"],
:root[data-variant="007"] a {
  color: var(--accent);
}

/* ---- Active/selected states ---- */
:root[data-variant="007"] .active,
:root[data-variant="007"] [aria-selected="true"],
:root[data-variant="007"] [class*="active"] {
  background: rgba(232, 232, 240, 0.08);
  border-color: rgba(232, 232, 240, 0.2);
  box-shadow: 0 0 12px rgba(180, 180, 255, 0.15);
}

/* ---- App title / brand in header ---- */
:root[data-variant="007"] .app-title::before {
  content: "UNVRS ◆ 007";
}
:root[data-variant="007"] .app-title {
  font-family: var(--font-display);
  font-weight: 300;
  letter-spacing: 0.12em;
  color: var(--accent);
}

/* ---- DEFCON / status badge --- */
:root[data-variant="007"] .defcon-badge,
:root[data-variant="007"] [class*="defcon"] {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
}

/* ---- Map overlays (pannelli sulla mappa) ---- */
:root[data-variant="007"] .map-overlay,
:root[data-variant="007"] [class*="map-panel"],
:root[data-variant="007"] [class*="map-control"] {
  background: rgba(4, 8, 15, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ---- Scrollbar styling ---- */
:root[data-variant="007"] ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}
:root[data-variant="007"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.22);
}

/* ---- Buttons ---- */
:root[data-variant="007"] button,
:root[data-variant="007"] .btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text);
  backdrop-filter: blur(8px);
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}
:root[data-variant="007"] button:hover,
:root[data-variant="007"] .btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 16px rgba(180, 180, 255, 0.1);
}

/* ---- News/feed items ---- */
:root[data-variant="007"] .news-item,
:root[data-variant="007"] [class*="feed-item"],
:root[data-variant="007"] [class*="news-item"] {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
:root[data-variant="007"] .news-item:hover,
:root[data-variant="007"] [class*="feed-item"]:hover {
  background: rgba(255, 255, 255, 0.03);
}
```

**Step 2: Importare il tema in base-layer.css**

Aprire `src/styles/base-layer.css` e aggiungere alla fine:

```css
/* UNVRS 007 theme — unlayered, wins over base */
@import url('./007-theme.css');
```

**Step 3: Avviare il dev server e verificare visivamente**

```bash
cd "/Users/emanuelemaccari/unvrs claude/worldmonitor"
VITE_VARIANT=007 npm run dev
```

Aprire `http://localhost:3000`. Verificare che i pannelli abbiano il glass effect e che l'accento sia bianco/argentato invece di teal.

**Step 4: Commit**

```bash
git add src/styles/007-theme.css src/styles/base-layer.css
git commit -m "feat(007): add liquid glass CSS theme for 007 variant"
```

---

### Task 7: Aggiornare main.ts per applicare data-variant="007"

**Files:**
- Modify: `src/main.ts`

**Step 1: Trovare il blocco esistente**

Nel file cercare:
```typescript
if (SITE_VARIANT && SITE_VARIANT !== 'full') {
  document.documentElement.dataset.variant = SITE_VARIANT;
}
```

**Step 2: Verificare che `007` sia già gestito**

Questo blocco già funziona per `007` (non è `full`, quindi setta `data-variant="007"`). Nessuna modifica necessaria.

**Step 3: Trovare il riferimento Sentry/analytics**

Cercare la riga:
```typescript
environment: location.hostname === 'worldmonitor.app' ? 'production'
```

Aggiornare:
```typescript
environment: (location.hostname === 'worldmonitor.app' || location.hostname === '007.unvrslabs.dev') ? 'production'
```

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(007): update production hostname check for unvrslabs.dev"
```

---

### Task 8: Aggiornare CORS per il dominio UNVRS

**Files:**
- Modify: `api/_cors.js`

**Step 1: Trovare ALLOWED_ORIGIN_PATTERNS**

Il file inizia con:
```javascript
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(.*\.)?worldmonitor\.app$/,
  /^https:\/\/worldmonitor-[a-z0-9-]+-elie-[a-z0-9]+\.vercel\.app$/,
  ...
```

**Step 2: Aggiungere i pattern per unvrslabs.dev**

Aggiungere dopo la prima riga:
```javascript
/^https:\/\/(.*\.)?unvrslabs\.dev$/,
/^https:\/\/unvrs[a-z0-9-]+-[a-z0-9]+\.vercel\.app$/,
```

**Step 3: Aggiornare il default origin nel fallback**

Trovare:
```javascript
const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://worldmonitor.app';
```
Lasciare invariato (il fallback è per le risposte ai non-browser, non critico).

**Step 4: Commit**

```bash
git add api/_cors.js
git commit -m "feat(007): add unvrslabs.dev to CORS allowed origins"
```

---

### Task 9: Aggiornare index.html con brand UNVRS 007

**Files:**
- Modify: `index.html`

**Step 1: Sostituire tutti i riferimenti worldmonitor nell'head**

Trovare e sostituire:

| Vecchio | Nuovo |
|---|---|
| `World Monitor - Global Situation with AI Insights` | `UNVRS 007 — Global Intelligence Dashboard` |
| `content="World Monitor"` | `content="UNVRS 007"` |
| `https://worldmonitor.app/` | `https://007.unvrslabs.dev/` |
| `worldmonitor.app/favico/og-image.png` | `https://007.unvrslabs.dev/favico/og-image.png` |
| `@worldmonitorapp` | `@unvrslabs` |
| `"name": "World Monitor"` | `"name": "UNVRS 007"` |

**Step 2: Aggiornare il CSP frame-src**

Trovare nel CSP:
```
frame-src 'self' https://worldmonitor.app https://tech.worldmonitor.app https://happy.worldmonitor.app
```
Aggiungere:
```
https://007.unvrslabs.dev
```

**Step 3: Aggiornare lo script inline di rilevamento variante**

Trovare nello script inline:
```javascript
if(h.startsWith('happy.'))v='happy';
else if(h.startsWith('tech.'))v='tech';
else if(h.startsWith('finance.'))v='finance';
```
Aggiungere:
```javascript
else if(h.startsWith('007.'))v='007';
```

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat(007): rebrand index.html to UNVRS 007"
```

---

### Task 10: Creare .env.local con le API key

**Files:**
- Create: `.env.local` (NON committato — già in .gitignore)

**Step 1: Verificare che .env.local sia in .gitignore**

```bash
grep ".env.local" "/Users/emanuelemaccari/unvrs claude/worldmonitor/.gitignore"
```
Expected: trovata la riga `.env.local` o `.env*.local`.

**Step 2: Creare il file**

```bash
cp "/Users/emanuelemaccari/unvrs claude/worldmonitor/.env.example" \
   "/Users/emanuelemaccari/unvrs claude/worldmonitor/.env.local"
```

**Step 3: Impostare la variante**

Nel file `.env.local`, impostare:
```
VITE_VARIANT=007
```

**Step 4: Nota API key da ottenere**

Aprire `.env.local` e inserire le chiavi che si hanno. Le priorità:
1. `GROQ_API_KEY` — AI summaries (gratuito su https://console.groq.com)
2. `AISSTREAM_API_KEY` — vessel tracking (gratuito su https://aisstream.io)
3. `FINNHUB_API_KEY` — mercati (gratuito su https://finnhub.io)
4. `EIA_API_KEY` — energia (gratuito su https://www.eia.gov/opendata)
5. `ACLED_ACCESS_TOKEN` — conflitti (gratuito per ricercatori su https://acleddata.com)

**Step 5: Non committare**

```bash
# Verificare che .env.local NON sia tracciato
git status | grep ".env.local"
```
Expected: nessun output (il file è ignorato).

---

### Task 11: Test locale completo della variante 007

**Step 1: Avviare il dev server**

```bash
cd "/Users/emanuelemaccari/unvrs claude/worldmonitor"
npm run dev:007
```

**Step 2: Aprire il browser su http://localhost:3000**

Verificare visivamente:
- [ ] Titolo della tab: "UNVRS 007 — Global Intelligence Dashboard"
- [ ] Pannelli con glass effect (blur + border semi-trasparente)
- [ ] Accenti bianchi/argentati invece di teal
- [ ] Mappa funzionante
- [ ] News feed funzionante
- [ ] Nessun riferimento a "World Monitor" nell'UI visibile

**Step 3: Test DevTools**

Aprire DevTools → Elements → `<html>`. Verificare:
- `data-variant="007"` presente sull'elemento `<html>`

**Step 4: Commit di verifica**

```bash
git add -A
git status  # non deve mostrare .env.local
git commit -m "feat(007): UNVRS 007 variant complete — liquid glass, rebrand, CORS"
```

---

### Task 12: Push su GitHub

**Step 1: Push**

```bash
cd "/Users/emanuelemaccari/unvrs claude/worldmonitor"
git push origin main
```

**Step 2: Verificare su GitHub**

Andare su https://github.com/emanueleunvrslabs/worldmonitor e verificare che i commit siano arrivati.

---

## Note per il Deploy su Vercel (dopo il push)

1. Andare su https://vercel.com/new
2. Importare `emanueleunvrslabs/worldmonitor`
3. **Framework Preset:** Vite
4. **Build Command:** `npm run build:007`
5. **Output Directory:** `dist`
6. **Environment Variables:** aggiungere tutte le chiavi da `.env.local`
7. **Custom Domain:** aggiungere `007.unvrslabs.dev` nelle impostazioni del progetto
8. Su Cloudflare/DNS provider: aggiungere CNAME `007` → `cname.vercel-dns.com`
