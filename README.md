<p align="center">
  <img src="header/header.png" alt="Visual Anomaly Comparison Lab banner" width="100%" />
</p>

<h1 align="center">Visual Anomaly Comparison Lab</h1>

<p align="center">
  Reconstruction-based anomaly inspection dashboard for bottle defect analysis using a denoising convolutional autoencoder, heatmaps, masks, anomaly scores, and approximate suspicious-region overlays.
</p>

<p align="center">
  <a href="https://visual-anomaly-comparison-lab.vercel.app/"><strong>Live Demo</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/sidnei-almeida/visual-anomaly-comparison-lab"><strong>GitHub</strong></a>
  &nbsp;·&nbsp;
  <a href="https://salmeida-bottle-anomaly-detection.hf.space"><strong>API</strong></a>
  &nbsp;·&nbsp;
  <a href="https://salmeida-bottle-anomaly-detection.hf.space/health">API health</a>
</p>

<p align="center">
  <strong>Next.js 15 · React 19 · TypeScript · Tailwind · Zustand · Recharts</strong><br />
  <em>Terra & cream inspection UI for MVTec AD bottle anomaly detection.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Zustand-5-764ABC?logo=redux&logoColor=white" alt="Zustand" />
  <img src="https://img.shields.io/badge/Recharts-2-E6522C?logo=apache&logoColor=white" alt="Recharts" />
  <img src="https://img.shields.io/badge/Model-DAE-95573E" alt="Denoising Autoencoder" />
  <img src="https://img.shields.io/badge/Dataset-MVTec_AD-7aaa5e" alt="MVTec AD" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white" alt="Vercel" />
</p>

---

## What this is

A **full-screen visual comparison lab** for industrial anomaly inspection. Analysts select MVTec AD bottle samples (or upload their own), run `POST /predict` against a **multi-product denoising convolutional autoencoder** hosted on Hugging Face Spaces, and compare four synchronized views: **original**, **reconstruction**, **heatmap**, and **mask** — with **client-drawn reticle bounding boxes** on the original panel.

The dashboard does **not** train models. It orchestrates inference, caches session results, visualizes localization artifacts, and surfaces scores against category-specific thresholds shipped as JSON in the repository.

> **Live demo:** [visual-anomaly-comparison-lab.vercel.app](https://visual-anomaly-comparison-lab.vercel.app/)  
> **GitHub:** [github.com/sidnei-almeida/visual-anomaly-comparison-lab](https://github.com/sidnei-almeida/visual-anomaly-comparison-lab)  
> **Production API:** [salmeida-bottle-anomaly-detection.hf.space](https://salmeida-bottle-anomaly-detection.hf.space)  
> **V1 demo scope:** curated **bottle** catalog only (`category=bottle` on every predict call).

### Interpretation note

Bounding boxes are **approximate visual hints** derived from reconstruction error maps — not supervised object-detection ground truth. The **heatmap** and **reconstruction** views are the primary interpretation outputs; use boxes as quick localization cues only.

---

## Application layout & workflow

Single-page lab (`/`) wrapped by an **API health gate** that blocks the UI until `GET /health` returns HTTP 200 (important for cold-started Hugging Face Spaces).

| Zone | Component | Purpose |
|------|-----------|---------|
| **Top bar** | `Topbar` | Brand, session clock, API live badge, utility actions |
| **Left sidebar** | `SampleNavigator` | Category pill, 44 curated samples, upload batch, run count |
| **Center** | `ComparisonLab` | 2×2 image grid (ORIGINAL · RECONSTRUCTION · HEATMAP · MASK) |
| **Right sidebar** | `InferenceSummary` | Scores, status gauge, timeline, model/localization cards |
| **Bottom bar** | `SidebarBatchActions` | Pending batch · Reprocess all · Stop · Ready chip |

```mermaid
flowchart TB
  subgraph boot [Startup]
    GATE[ApiGate]
    HEALTH[GET /health poll 3s]
    SPLASH[LoadingScreen]
    GATE --> HEALTH
    HEALTH -->|not 200| SPLASH
    HEALTH -->|200 + 600ms| DASH
  end

  subgraph dash [Dashboard]
    NAV[SampleNavigator]
    LAB[ComparisonLab]
    SUM[InferenceSummary]
    STORE[(Zustand store)]
  end

  subgraph api [Hugging Face Space]
    PREDICT[POST /predict]
    META[GET / metadata]
  end

  DASH --> NAV
  DASH --> LAB
  DASH --> SUM
  NAV -->|select sample| STORE
  STORE --> PREDICT
  PREDICT --> STORE
  STORE --> LAB
  STORE --> SUM
```

**Typical session**

1. Splash screen waits for API wake-up (retries every 3s, 5s request timeout).
2. Bootstrap loads catalog, metadata, and optional default inspection.
3. Click a sample → `POST /predict` with `include_images=true`.
4. Review four panels; primary/secondary **corner-bracket boxes** on ORIGINAL (highest z-score = terra reticle).
5. Inspect **Status gauge** (score ÷ threshold ratio), timeline entries, session aggregates.
6. Run **Pending** or **Reprocess all** from the bottom bar for batch workflows.

---

## Main features

### Four-panel comparison grid

| Panel | API field | Background | Notes |
|-------|-----------|------------|-------|
| **ORIGINAL** | `images.original` or catalog fallback | `#0d0906` | Client-side bbox overlays in model `image_size` space |
| **RECONSTRUCTION** | `images.reconstruction` | `#0d0906` | Autoencoder output — primary comparison target |
| **HEATMAP** | `images.heatmap` | `#000000` | Category-normalized error map; one-shot scanline on load |
| **MASK** | `images.mask` | `#000000` | Binary suspicious region; scanline delayed 100ms |

Panels use `object-fit: contain`, staggered **fade + slide-in** on new results, and a brief **opacity crossfade** when switching samples.

### Client-side bounding boxes (reticle style)

Boxes are **not** burned into API images (`include_overlay=false`). The browser:

- Converts API coordinates using `image_size` (256×256) and `object-fit: contain` layout math (`src/lib/bbox-layout.ts`).
- Draws **L-shaped corner brackets** (not full rectangles) with primary `#e07a5f` / secondary `#95573E` styling.
- Labels show compact `z {score}` tags above the top-left corner.
- Animates the **primary** reticle with a subtle lock-on pulse.

> Boxes are **approximate suspicious regions** from connected components on the z-map — not supervised object-detection ground truth.

### Inspection summary (right sidebar)

- **Scores** — category, anomaly score, threshold, z-map max, latency, error mean (animated count-up on change).
- **Status gauge** — semicircular dial for score/threshold ratio; severity band; OK / ANOMALY badge with flash on change.
- **Timeline** — latest 5 runs + “View full timeline” modal.
- **Model** — type label (Multi-product DAE).
- **Localization** — method, visible box count, disclaimer when boxes hidden.
- **Session aggregate** — processed count, anomaly rate, avg score, avg latency after batch runs.

### Sample navigator & batch line

- **44 curated bottle images** in `data/catalog/` (7 pass · 37 anomaly).
- Seven pass samples excluded from the navigator when prone to false positives (`scripts/excluded-pass-samples.ts`).
- **Upload batch** — PNG/JPEG via `react-dropzone`; manual category for uploads.
- **Pending** — inspect only samples without cached results (skips unsupported).
- **Reprocess all** — force re-inference on every catalog sample.
- **Stop** — abort in-flight batch with `AbortController`.

### API health gate (`ApiGate`)

| State | User message |
|-------|----------------|
| `checking` | Connecting to API… |
| `waiting` | API is waking up, please wait… |
| `waiting` (attempt > 3) | Still waking up, this may take up to 30 seconds… |
| `ready` | ✓ API ready. Loading dashboard… |

Polling pauses when the browser tab is hidden; CORS/network errors retry silently.

### Polish & accessibility

- Terra/cream **design tokens** in `globals.css` (Syne + JetBrains Mono).
- Micro-interactions: button transitions, timeline hover, batch `:active` scale, panel load stagger.
- `prefers-reduced-motion` disables animations globally.
- Favicon + Apple touch icon + `site.webmanifest` for Vercel/PWA metadata.

### Optional demo fallback

When `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=true`, failed inferences can record **synthetic local results** (clearly labeled). Sessions mixing demo and live data prompt reset before new real runs.

---

## Design system

Built for long inspection sessions: warm dark base, terra accents, monospace metrics.

| Element | Implementation |
|---------|----------------|
| **Typography** | [Syne](https://fonts.google.com/specimen/Syne) (UI) + [JetBrains Mono](https://www.jetbrains.com/plex/mono/) (scores, labels, tables) via `next/font` |
| **Background** | `--bg-0` `#060503` through `--bg-3` `#241810` |
| **Accent** | `--terra` `#95573E`, `--anomaly` `#e07a5f`, `--cream` `#FBE4C5` |
| **Sidebars** | Left 168px · Right 200px · Top 36px · Bottom action 32px |
| **Panels** | Grid borders `0.5px`, headers on `--bg-2`, image stages per panel type |
| **Status** | OK green `#7aaa5e` · Anomaly terra · Pending warm gray |
| **Logo** | `LabLogoMark` SVG — dual-pane + eye + anomaly dot + reticle corners |

Tokens live in `src/app/globals.css`. Brand mark: `src/components/brand/LabLogoMark.tsx`.

---

## Model & scoring (backend)

| Property | Value |
|----------|--------|
| **Experiment** | `mvtec_structured_objects_dae_v1` |
| **Architecture** | Denoising ConvAutoencoder (~1.38M parameters) |
| **Input** | 256×256 RGB, `[0, 1]` after ToTensor |
| **Training loss** | L1 · Adam · noise factor 0.04 |
| **Recommended score** | `top_1_z_score` (top 1% of category-normalized error map) |
| **Threshold (bottle)** | **3.911** (validation p95, category-specific) |
| **Localization** | Connected components on z-map (max 2 boxes, conservative percentiles) |

Multi-product thresholds for capsule, hazelnut, metal_nut, pill, screw, and zipper remain in `src/data/model-artifacts/thresholds.json` for reference; the **V1 UI sends `bottle` only**.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, Turbopack dev) |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 3 + CSS variables (`@layer components`) |
| State | Zustand 5 |
| Charts | Recharts 2 (session charts modal) |
| Icons | Lucide React |
| Dates | date-fns 4 |
| Images | sharp (build) · local catalog via `/api/samples/[filename]` |
| Validation scripts | tsx |

---

## Environment

Copy `.env.example` to `.env.local`:

```env
# Hugging Face Space — POST /predict (no trailing slash)
NEXT_PUBLIC_ANOMALY_API_URL=https://salmeida-bottle-anomaly-detection.hf.space

# Optional aliases (same purpose)
# NEXT_PUBLIC_API_BASE_URL=
# NEXT_PUBLIC_VITE_API_BASE_URL=

# Optional: synthetic results when prediction fails
# NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false

# Optional: bbox coordinate debug logs in browser console
# NEXT_PUBLIC_DEBUG_BBOX=true
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ANOMALY_API_URL` | API base URL for `/health`, `/predict`, metadata |
| `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK` | Enable labeled demo fallback results |
| `NEXT_PUBLIC_DEBUG_BBOX` | Verbose bbox layout logging |

Supported API categories in artifacts: `bottle`, `capsule`, `hazelnut`, `metal_nut`, `pill`, `screw`, `zipper` — **UI V1 locks to `bottle`** (`src/config/api-categories.ts`).

---

## Quick start

```bash
git clone https://github.com/sidnei-almeida/visual-anomaly-comparison-lab.git
cd visual-anomaly-comparison-lab

npm install
cp .env.example .env.local   # optional — defaults to HF Space URL

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** If the Hugging Face Space has slept, the **splash screen** may poll for 30–60+ seconds until `/health` returns 200. Status text updates with attempt count.

### Production build

```bash
npm run build
npm start
```

### Validation scripts

```bash
npm run test:api          # smoke test GET /health + POST /predict
npm run test:selection    # sample selection flow
npm run test:categories   # category resolution rules
npm run test:bbox         # bbox coordinate math
npm run catalog:rebuild   # regenerate data/catalog/manifest.json
```

---

## Deploy on Vercel

1. Import [visual-anomaly-comparison-lab](https://github.com/sidnei-almeida/visual-anomaly-comparison-lab) on [Vercel](https://vercel.com).
2. Framework preset: **Next.js**
3. Environment variable:
   - `NEXT_PUBLIC_ANOMALY_API_URL` = `https://salmeida-bottle-anomaly-detection.hf.space`
4. Deploy — live app: [visual-anomaly-comparison-lab.vercel.app](https://visual-anomaly-comparison-lab.vercel.app/)

Static assets (`public/icon.svg`, `site.webmanifest`) and App Router metadata (`src/app/icon.svg`, `apple-icon.svg`) provide favicons and theme color `#060503`.

---

## Repository structure

```
visual-anomaly-comparison-lab/
├── header/
│   └── header.png               # README banner
├── public/
│   ├── icon.svg                 # Favicon + README hero
│   ├── apple-icon.svg           # Apple touch icon
│   └── site.webmanifest         # PWA manifest
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Fonts, metadata, viewport theme
│   │   ├── page.tsx             # ApiGate → AppShell
│   │   ├── icon.svg             # Next.js auto favicon
│   │   ├── apple-icon.svg
│   │   ├── globals.css          # Design tokens + animations
│   │   └── api/samples/[filename]/  # Serve catalog images
│   ├── components/
│   │   ├── brand/               # LabLogoMark
│   │   ├── gate/                # ApiGate, LoadingScreen
│   │   ├── inspection/          # Provider, navigator, sample rows
│   │   ├── viewer/              # ComparisonLab, InspectionImagePanel
│   │   ├── results/             # Summary, gauge, technical details
│   │   ├── timeline/            # Sidebar timeline + batch actions
│   │   ├── dashboard/           # Session charts modal
│   │   └── layout/              # Topbar, AppShell export
│   ├── config/
│   │   ├── api-categories.ts    # Bottle-only V1 rules
│   │   ├── health-check.ts      # Splash polling config
│   │   └── mvtec-dae-artifacts.ts
│   ├── data/
│   │   ├── model-artifacts/     # thresholds, bbox, config, manifest JSON
│   │   └── inspection-catalog.ts
│   ├── hooks/                   # useCountUp
│   ├── lib/                     # anomaly-api, bbox-layout, predict-mapper
│   ├── services/                # inspectionService, api facade
│   └── store/                   # inspection-store (Zustand)
├── data/catalog/                # inspect-bottle-*.png + manifest.json
├── scripts/                     # tests, catalog generators, smoke tests
├── readme_model.md              # README style reference
├── .env.example
└── next.config.ts
```

---

## API surface

### `GET /health`

Used by **ApiGate** (HTTP 200 required) and periodic health polling in the lab (model loaded / loading / offline).

### `POST /predict`

`multipart/form-data`:

| Field | V1 demo value |
|-------|----------------|
| `file` | Image bytes (catalog file or upload) |
| `category` | `bottle` |
| `include_images` | `true` |
| `include_debug` | `false` |
| `include_overlay` | `false` (boxes drawn in browser) |

**Example**

```bash
curl -X POST "https://salmeida-bottle-anomaly-detection.hf.space/predict" \
  -F "category=bottle" \
  -F "include_images=true" \
  -F "include_debug=false" \
  -F "include_overlay=false" \
  -F "file=@data/catalog/inspect-bottle-broken-large.png"
```

**Response highlights**

```json
{
  "status": "anomaly",
  "is_anomaly": true,
  "category": "bottle",
  "scores": {
    "anomaly_score": 9.775,
    "threshold": 3.911,
    "error_mean": 0.01195,
    "z_map_max": 32.932
  },
  "image_size": { "width": 256, "height": 256 },
  "boxes": [{ "x": 120, "y": 80, "w": 40, "h": 35, "max_z": 32.9 }],
  "images": {
    "original": "data:image/png;base64,...",
    "reconstruction": "...",
    "heatmap": "...",
    "mask": "..."
  }
}
```

### Client-side coordinate scaling

```
scaleX = renderedWidth  / image_size.width
scaleY = renderedHeight / image_size.height
left   = box.x * scaleX
top    = box.y * scaleY
```

Implemented in `modelBoxToRenderedRect()` with `object-fit: contain` letterboxing.

---

## Curated sample catalog

| Defect type | Navigator count |
|-------------|-----------------|
| Pass (good) | 7 |
| Large break | 12 |
| Small break | 13 |
| Contamination | 12 |
| **Total** | **44** |

Files live under `data/catalog/inspect-bottle-*.png`. Metadata is regenerated with:

```bash
npm run catalog:rebuild
```

---

## Model artifacts in-repo

JSON exports from training run `mvtec_structured_objects_dae_v1`:

| File | Contents |
|------|----------|
| `config.json` | Architecture, dataset splits, preprocessing |
| `thresholds.json` | Per-category p95 z-score thresholds |
| `bbox-visualization.json` | Box method, score map formula, UI guidance |
| `manifest.json` | Recommended inference pipeline steps |

Loaded by `src/config/mvtec-dae-artifacts.ts` for sidebar reference and bbox UI constants.

---

## Disclaimer

Reconstruction error, heatmaps, masks, and approximate bounding boxes are for **visual inspection demos and research comparison only**. They are not certified for production quality control, regulatory compliance, or safety-critical manufacturing decisions. Always validate against domain experts and ground-truth protocols.

Demo fallback results (when enabled) are synthetic and must not be treated as live model output.

---

## License & author

**Sidnei Alves de Almeida** — [@sidnei-almeida](https://github.com/sidnei-almeida)

**Repository:** [github.com/sidnei-almeida/visual-anomaly-comparison-lab](https://github.com/sidnei-almeida/visual-anomaly-comparison-lab)

---

<p align="center">
  <sub>Style reference: <code>readme_model.md</code> · MVTec AD bottle inspection · DAE V1</sub>
</p>
