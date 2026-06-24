// ========== Dataset Types ==========

export type Category = "vocabulary" | "grammar" | "mix";

/**
 * A shared example sentence with its Chinese translation.
 *
 * `sentence` may use `{kanji|reading}` furigana annotations and `【bracket】`
 * grammar markers. The same shape is used by both vocabulary and grammar items
 * so example rendering, validation, and TTS pre-generation stay uniform.
 */
export interface Example {
  sentence: string; // Uses {kanji|reading} furigana and 【bracket】 grammar notation
  chinese: string;  // Traditional Chinese translation
}

/**
 * @deprecated Use `Example`. Kept as an alias for backward compatibility with
 * existing imports; identical shape.
 */
export type GrammarExample = Example;

export interface VocabItem {
  id: string;
  japanese: string;
  hiragana: string;
  simple_chinese: string;
  full_explanation: string;
  examples?: Example[];
}

export interface GrammarItem {
  id: string;
  japanese: string;
  simple_chinese: string;
  full_explanation: string;
  examples: Example[];
}

export type DataItem = VocabItem | GrammarItem;

/** Type guard: VocabItem has `hiragana`, GrammarItem does not */
export function isVocabItem(item: DataItem): item is VocabItem {
  return "hiragana" in item;
}

export interface Dataset<T extends DataItem = DataItem> {
  name: string;
  category: Category;
  level: string;
  data: T[];
}

export type VocabDataset = Dataset<VocabItem>;
export type GrammarDataset = Dataset<GrammarItem>;

// ========== Test Mode Types ==========

export type VocabTestMode = "kanji-to-chinese" | "hiragana-to-chinese" | "chinese-to-japanese" | "random";

export type GrammarTestMode =
  | "grammar-to-chinese"
  | "example-to-chinese"
  | "chinese-to-grammar"
  | "fill-in-grammar"
  | "random";

export type TestMode = VocabTestMode | GrammarTestMode;

export type ConcreteVocabTestMode = Exclude<VocabTestMode, "random">;
export type ConcreteGrammarTestMode = Exclude<GrammarTestMode, "random">;
export type ConcreteTestMode = ConcreteVocabTestMode | ConcreteGrammarTestMode;

export const CONCRETE_VOCAB_MODES: ConcreteVocabTestMode[] = [
  "kanji-to-chinese",
  "hiragana-to-chinese",
  "chinese-to-japanese",
];

export const CONCRETE_GRAMMAR_MODES: ConcreteGrammarTestMode[] = [
  "grammar-to-chinese",
  "example-to-chinese",
  "chinese-to-grammar",
  "fill-in-grammar",
];

export const VOCAB_TEST_MODES: { value: VocabTestMode; label: string; description: string }[] = [
  { value: "kanji-to-chinese", label: "漢字 → 中文", description: "看漢字，回想中文意思" },
  { value: "hiragana-to-chinese", label: "假名 → 中文", description: "看假名，回想中文意思" },
  { value: "chinese-to-japanese", label: "中文 → 日文", description: "看中文，回想日文寫法" },
  { value: "random", label: "隨機", description: "每張卡片隨機選擇模式" },
];

export const GRAMMAR_TEST_MODES: { value: GrammarTestMode; label: string; description: string }[] = [
  { value: "grammar-to-chinese", label: "文法 → 中文", description: "看文法句型，回想中文意思" },
  { value: "example-to-chinese", label: "例句 → 中文", description: "看例句（標記文法），回想中文意思" },
  { value: "chinese-to-grammar", label: "中文 → 文法", description: "看中文意思，回想日文文法" },
  { value: "fill-in-grammar", label: "填空 → 文法", description: "看挖空例句和中文翻譯，回想文法" },
  { value: "random", label: "隨機", description: "每張卡片隨機選擇模式" },
];

// ========== Mix Mode Types ==========

/** All 7 concrete modes + random, for mix datasets */
export const MIX_TEST_MODES: { value: string; label: string; description: string; group: "vocab" | "grammar" }[] = [
  { value: "kanji-to-chinese", label: "漢字 → 中文", description: "看漢字，回想中文意思", group: "vocab" },
  { value: "hiragana-to-chinese", label: "假名 → 中文", description: "看假名，回想中文意思", group: "vocab" },
  { value: "chinese-to-japanese", label: "中文 → 日文", description: "看中文，回想日文寫法", group: "vocab" },
  { value: "grammar-to-chinese", label: "文法 → 中文", description: "看文法句型，回想中文意思", group: "grammar" },
  { value: "example-to-chinese", label: "例句 → 中文", description: "看例句（標記文法），回想中文意思", group: "grammar" },
  { value: "chinese-to-grammar", label: "中文 → 文法", description: "看中文意思，回想日文文法", group: "grammar" },
  { value: "fill-in-grammar", label: "填空 → 文法", description: "看挖空例句和中文翻譯，回想文法", group: "grammar" },
];

export const MIX_DEFAULT_MODES: string[] = ["kanji-to-chinese", "grammar-to-chinese"];

export const VOCAB_MODE_VALUES = new Set<string>(["kanji-to-chinese", "hiragana-to-chinese", "chinese-to-japanese"]);
export const GRAMMAR_MODE_VALUES = new Set<string>(["grammar-to-chinese", "example-to-chinese", "chinese-to-grammar", "fill-in-grammar"]);

// ========== Flashcard Types ==========

export interface FlashcardContent {
  front: {
    primary: string;
    secondary?: string;
  };
  back: {
    primary: string;
    secondary?: string;
    detail?: string;
    /** Japanese text to display and speak on the back face */
    pronunciation?: string;
    /** When true, render a speak button next to back.secondary (treats secondary as Japanese) */
    secondaryIsJapanese?: boolean;
    /**
     * Example sentences (日文 + 中譯) shown on the back face regardless of test
     * mode. Sentences may carry `{kanji|reading}` and `【...】` annotations and
     * are rendered with GrammarHighlight + a SpeakButton.
     */
    examples?: Example[];
  };
}

// ========== SM-2 Progress Types ==========

export type Rating = "again" | "hard" | "good";

export const RATING_CONFIG: Record<Rating, { label: string; quality: number; color: string }> = {
  again: { label: "不會", quality: 1, color: "bg-red-500 hover:bg-red-600" },
  hard: { label: "還好", quality: 3, color: "bg-amber-500 hover:bg-amber-600" },
  good: { label: "記住了", quality: 5, color: "bg-emerald-500 hover:bg-emerald-600" },
};

export interface CardProgress {
  cardId: string;
  datasetId: string;
  easeFactor: number;    // default 2.5, min 1.3
  interval: number;      // days until next review
  repetitions: number;   // consecutive correct count
  nextReview: string;    // ISO date string
  lastRating: Rating;
}

export interface ProgressStore {
  [cardId: string]: CardProgress;
}

export interface SessionResult {
  total: number;
  good: number;
  hard: number;
  again: number;
  cards: { cardId: string; rating: Rating; mode?: string }[];
}

// ========== Study Plan Types ==========

export interface StudyPlan {
  datasetId: string;
  totalDays: number;     // 0 = "all at once"
  cardIds: string[][];   // [day0cardIds, day1cardIds, ...]
  createdAt: string;     // ISO date
}

// ========== Active Study Session (persistence) ==========

/**
 * A lightweight, serializable reference to one presentation in a study queue.
 * The full flashcard content is rebuilt from the dataset on restore, so only
 * the identifying fields are persisted.
 */
export interface ActiveSessionCardRef {
  itemId: string;
  mode?: string;
  /** Which example a grammar card used (so the same sentence reappears). */
  exampleIndex?: number;
}

/**
 * Snapshot of an in-progress study session, persisted to localStorage so a
 * reload / backgrounding / "繼續上次複習" resumes the exact same queue, position,
 * and flip state. Only ONE session is tracked at a time.
 *
 * SM-2 progress is NOT stored here — ratings are committed to the progress
 * store as they happen; this snapshot only restores UI + queue state.
 */
export interface ActiveSession {
  datasetId: string;
  modes: string | string[];
  sessionType: SessionType;
  specificCardIds?: string[];
  /** Deterministic initial queue (already shuffled at creation time). */
  queue: ActiveSessionCardRef[];
  /** Cards requeued after an "again" rating. */
  requeue: ActiveSessionCardRef[];
  currentIndex: number;
  isFlipped: boolean;
  results: { cardId: string; rating: Rating; mode?: string }[];
  updatedAt: string;
}

export interface LearnPosition {
  datasetId: string;
  planType: "all" | "daily";
  dayIndex: number;      // 0 for "all" mode
  cardIndex: number;
  updatedAt: string;     // ISO date
}

// ========== Favorites ==========

export interface FavoriteEntry {
  /** Dataset the card belongs to, so favorites can be listed cross-dataset. */
  datasetId: string;
  /** ISO timestamp when the card was favorited. */
  addedAt: string;
}

/** Map of cardId → favorite metadata. */
export interface FavoritesStore {
  [cardId: string]: FavoriteEntry;
}

// ========== Custom Data Store ==========

export interface CustomDataStore {
  /** All user-managed datasets (both user-created and copied-from-builtin) */
  datasets: Record<string, Dataset>;
}

// ========== Dataset Metadata (for listing) ==========

export type SessionType = "due" | "random" | "specific";

export interface DatasetMeta {
  id: string;             // filename-derived identifier
  name: string;
  category: Category;
  level: string;
  totalCards: number;
  dueCards: number;
  learnedCards: number;   // cards reviewed at least once
  masteredCards: number;  // cards with repetitions >= 3
}
