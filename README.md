# Japanese Learner (日語學習卡)

A flashcard web app for learning Japanese vocabulary and grammar, built for Traditional Chinese speakers. It features spaced repetition (SM-2 algorithm), multiple test modes, swipe gestures, and offline-capable progress tracking via localStorage.

**Live demo:** [https://tigercosmos.github.io/japanese-learner/](https://tigercosmos.github.io/japanese-learner/)

## Features

- **Spaced Repetition** - SM-2 algorithm (Anki-style) schedules cards based on your performance, surfacing difficult cards more often
- **Multiple Test Modes** - Vocabulary: Kanji-to-Chinese, Hiragana-to-Chinese, Chinese-to-Japanese. Grammar: Pattern-to-Chinese, Example-to-Chinese, Chinese-to-Grammar, Fill-in-the-blank
- **Mix (綜合) Datasets** - Combine vocabulary and grammar items in a single dataset; each item is automatically tested with its applicable modes
- **Learning Mode** - Browse cards sequentially with full content visible (no flipping, no rating) for initial study; supports daily plans (分天計畫)
- **Example Sentences (例句)** - Both vocabulary and grammar cards show 1–2 example sentences with Traditional Chinese translations on the back face and in learning mode, with furigana, grammar highlighting, and per-sentence pronunciation
- **Favorites (收藏)** - Star any card to save it; the "我的收藏" page lists favorites across all datasets and can launch a review session of only favorited cards
- **Resume Session (繼續上次複習)** - In-progress study sessions are saved automatically; reloading, backgrounding the PWA, or returning later resumes the exact card, position, and flip state
- **Dataset Management** - Create, edit, and delete custom datasets and items; modify built-in datasets with reset-to-default option
- **Swipe Gestures** - Swipe left (don't know), down (hard), right (got it) as an alternative to tapping rating buttons; optional color overlay + text assist (toggleable in settings)
- **Keyboard Shortcuts** - Navigate and rate cards with keyboard for efficient desktop use
- **Settings Page** - Configure dark mode, swipe assist, and furigana display
- **Furigana (假名標註)** - Optional hiragana ruby above kanji in example sentences (toggle in Settings). Datasets may carry hand-curated readings inline as `{漢字|かんじ}`; for unannotated kanji it falls back to kuroshiro + kuromoji, lazy-loaded on first use
- **Grammar Highlighting** - Bracket notation (e.g., `【grammar】`) renders grammar parts with colored highlights or blanks for fill-in mode
- **Dataset Filtering** - Filter datasets by category (vocabulary/grammar/mix) and JLPT level
- **Progress Statistics** - Track learned, due, and mastered cards per dataset with visual progress bars
- **Random Review** - Review all cards in a shuffled order even when no cards are due
- **Pronunciation** - Natural-voice text-to-speech. Plays pre-generated mp3 clips (`npm run gen:audio` with a cloud TTS key) when available, falling back to the browser Web Speech API otherwise; heard clips are cached for offline use
- **Google Drive Sync** - Sync progress, settings, and custom datasets across devices via Google Drive (optional, requires Google account)
- **Offline-First** - All progress stored in browser localStorage; no backend required
- **Installable (PWA)** - Install to your iPhone/Android/desktop home screen with offline support via service worker
- **Dark Mode** - Toggle between light and dark themes via header or settings page
- **Responsive Design** - Mobile-friendly with centered layout on desktop

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** for styling
- **React Router v7** for client-side routing
- **Vitest** for unit tests
- **Playwright** for end-to-end tests

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/tigercosmos/japanese-learner.git
cd japanese-learner
npm install
```

`npm install` runs `scripts/copy-dict.cjs` to copy the kuromoji dictionary
files into `public/dict/` (used by the furigana feature). The dictionary is
not committed; if `public/dict/` ever goes missing, run `node scripts/copy-dict.cjs`.

### Development

```bash
npm run dev
```

Opens the app at `http://127.0.0.1:5173/japanese-learner/`.

### Build

```bash
npm run build
```

Outputs to `dist/`. Includes a `404.html` copy for GitHub Pages SPA support.

### Testing

```bash
npm run test          # Unit tests (Vitest)
npm run test:watch    # Unit tests in watch mode
npm run test:e2e      # End-to-end tests (Playwright)
npm run test:e2e:ui   # Playwright interactive UI mode
```

### Linting

```bash
npm run lint
```

### Data & Audio Scripts

```bash
npm run migrate:examples    # Lift inline "例：…" from vocab full_explanation into structured examples
                            #   (use --dry-run to preview; translations left empty for a content pass)
npm run gen:examples        # Generate natural everyday vocab example sentences + ZH translations
npm run validate:examples   # Lint every example's format (中譯, 字數, 標記, 句尾); add -- --strict for CI
npm run gen:audio           # Pre-generate natural-voice TTS mp3s into public/audio/
```

`gen:examples` and `gen:audio` call an AI gateway through the shared client in
`scripts/lib/mtk-gateway.cjs`:

- **MediaTek GAISF gateway** (default on a corp machine) — reads `MAMBA_API_KEY`
  + `MAMBA_USER_ID` (`MAMBA_BASE_URL` optional). `gen:examples` uses a Claude
  model for the sentences; `gen:audio` uses the gateway's Azure TTS
  (`gpt-4o-mini-tts` / `aide-tts`), voice via `MTK_TTS_VOICE` (default `nova`).
- **`gen:audio` external fallback** — Google Cloud (`GOOGLE_TTS_API_KEY`,
  optional `GOOGLE_TTS_VOICE`) or Azure Speech (`AZURE_TTS_KEY` +
  `AZURE_TTS_REGION`). With no provider it runs in "plan mode" (reports counts,
  writes nothing) and the app falls back to the Web Speech API at runtime.

`gen:examples` is resumable (only fills items missing a translation; `--force`
redoes all) and supports `--file n5_vocab`, `--limit N`, `--batch N`.
`gen:audio --list` prints every unique speakable string.

Example format and the per-level word-usage rules are documented in
[`docs/example-format-spec.md`](docs/example-format-spec.md).

### Install to Home Screen (PWA)

The app is a Progressive Web App. After visiting the live demo:

- **iPhone / iPad (Safari):** Share button → "Add to Home Screen" (加入主畫面). Launches full-screen like a native app.
- **Android (Chrome):** menu → "Install app" / "Add to Home screen".
- **Desktop (Chrome/Edge):** click the install icon in the address bar.

Once installed, the app works offline. Progress is kept in localStorage — use Google Drive Sync (below) as an off-device backup, since iOS Safari may evict site data after ~7 days of no use.

Icons are generated from `scripts/icons/icon.svg` (and `icon-maskable.svg`). Run `scripts/icons/generate.sh` after editing them to regenerate the PNGs in `public/` (macOS `sips` required).

### Google Drive Sync (Optional)

To enable Google Drive sync, set up a Google Cloud project with OAuth2 credentials:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Drive API
3. Create an OAuth 2.0 Client ID (Web application type)
4. Add your app URL to authorized JavaScript origins
5. Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID`

## Project Structure

```
data/                   JSON datasets (n5_vocab.json, grammar-n5.json, grammar-n4.json, grammar-n3.json, etc.)
src/
  components/           Reusable UI components (Flashcard, RatingButtons, ModeSelector, etc.)
  hooks/                Custom React hooks (useStudySession, useProgress, useDatasetCrud, useGoogleSync, etc.)
  lib/                  Core logic (SM-2 algorithm, grammar parser, storage, category, stats)
    google/             Google Drive sync (GIS auth, Drive API wrapper, sync engine)
  pages/                Route-level page components
  types/                TypeScript type definitions
e2e/                    Playwright end-to-end tests
  fixtures/             Test fixture data (test-vocab.json, test-grammar.json, test-mix.json)
scripts/                Build/data scripts (copy-dict, migrate-examples, validate-examples, gen-audio)
docs/                   example-format-spec.md (例句 format + per-level word-usage rules)
public/audio/           Pre-generated TTS mp3s + manifest.json (created by gen:audio; not committed)
```

## Data Format

Datasets are JSON files in the `data/` directory. Three categories are supported:

**Vocabulary (`category: "vocabulary"`):**
```json
{
  "name": "N3 Vocabulary",
  "category": "vocabulary",
  "level": "N3",
  "data": [
    {
      "id": "vocab-n3-001",
      "japanese": "株式",
      "hiragana": "かぶしき",
      "simple_chinese": "股份",
      "full_explanation": "株式会社（かぶしきがいしゃ）：股份有限公司",
      "examples": [
        { "sentence": "【株式】を買う。", "chinese": "購買股票。" }
      ]
    }
  ]
}
```

Vocabulary `examples` are optional and share the same `Example` shape as grammar
(`sentence` + `chinese`), supporting `{漢字|かな}` furigana and `【...】` markers.

**Grammar (`category: "grammar"`):**
```json
{
  "name": "N3 Grammar",
  "category": "grammar",
  "level": "N3",
  "data": [
    {
      "id": "grammar-n3-001",
      "japanese": "うちに",
      "simple_chinese": "在～過程中／趁～",
      "full_explanation": "表示在某狀態持續期間做某事...",
      "examples": [
        {
          "sentence": "勉強している【うちに】眠くなった",
          "chinese": "讀書讀著讀著就睏了"
        }
      ]
    }
  ]
}
```

**Mix (`category: "mix"`):**
```json
{
  "name": "N3 綜合",
  "category": "mix",
  "level": "N3",
  "data": [
    { "id": "v1", "japanese": "勉強", "hiragana": "べんきょう", "simple_chinese": "學習", "full_explanation": "..." },
    { "id": "g1", "japanese": "ている", "simple_chinese": "正在～", "full_explanation": "...", "examples": [...] }
  ]
}
```

Mix datasets contain both vocabulary and grammar items. Item type is detected at runtime by checking for the `hiragana` field (present only on vocabulary items). Each item is tested only with its applicable modes.

Grammar examples use `【bracket】` notation to mark grammar points, supporting multiple brackets per sentence for multi-part patterns.

## SM-2 Algorithm

Cards are rated on a 3-point scale after each review:

| Button | Label | Effect |
|--------|-------|--------|
| Again  | 不會  | Reset repetitions, review again soon |
| Hard   | 還好  | Increase interval conservatively |
| Good   | 記住了 | Increase interval normally |

The algorithm adjusts ease factor and review intervals to optimize long-term retention. Cards rated "Again" are re-queued within the current session.

## License

MIT
