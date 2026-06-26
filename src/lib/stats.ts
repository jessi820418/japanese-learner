import type { DataItem, ProgressStore, CardProgress, ConcreteTestMode, Category } from "../types";
import { isVocabItem, VOCAB_MODE_VALUES, GRAMMAR_MODE_VALUES } from "../types";
import { isDue } from "./sm2";
import { makeProgressKey, parseProgressKey } from "./storage";

/**
 * Group all progress entries by their base cardId, so a card studied in
 * multi-mode (stored under composite keys `cardId::mode`) is found alongside
 * one studied in single-mode (stored under the plain `cardId`).
 */
function groupProgressByCardId(progress: ProgressStore): Map<string, CardProgress[]> {
  const byCard = new Map<string, CardProgress[]>();
  for (const [key, p] of Object.entries(progress)) {
    const { cardId } = parseProgressKey(key);
    const list = byCard.get(cardId);
    if (list) list.push(p);
    else byCard.set(cardId, [p]);
  }
  return byCard;
}

export interface DatasetStats {
  totalCards: number;
  learnedCards: number;   // cards with at least one review
  dueCards: number;       // cards currently due for review
  masteredCards: number;  // cards with repetitions >= 3
  masteryPercent: number; // percentage of mastered cards (0–100)
}

/**
 * Compute statistics for a dataset based on progress data.
 *
 * Mode-agnostic: a card is counted whether its progress was stored under the
 * plain `cardId` (single-mode study) OR any composite `cardId::mode` key
 * (multi-mode study). Without this, a card studied only in multi-mode shows as
 * "已學 0" on the home page because that view doesn't know which modes were
 * used. Aggregation rules mirror getMultiModeDatasetStats:
 *   - learned: any entry exists for the card
 *   - due:     any entry is due (or no entry at all → a brand-new card is due)
 *   - mastered: every existing entry has repetitions >= 3
 */
export function getDatasetStats(
  data: DataItem[],
  progress: ProgressStore,
): DatasetStats {
  const totalCards = data.length;
  let learnedCards = 0;
  let dueCards = 0;
  let masteredCards = 0;

  const byCard = groupProgressByCardId(progress);

  for (const item of data) {
    const entries = byCard.get(item.id);

    if (!entries || entries.length === 0) {
      // No progress under any key → brand-new card, counts as due.
      if (isDue(undefined)) dueCards++;
      continue;
    }

    learnedCards++;
    if (entries.every((p) => p.repetitions >= 3)) masteredCards++;
    if (entries.some((p) => isDue(p))) dueCards++;
  }

  const masteryPercent = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

  return { totalCards, learnedCards, dueCards, masteredCards, masteryPercent };
}

/**
 * Compute statistics for a dataset using composite keys for multiple test modes.
 * - learned: any mode has progress for this card
 * - due: any mode's composite key is due
 * - mastered: ALL modes' composite keys have repetitions >= 3
 */
export function getMultiModeDatasetStats(
  data: DataItem[],
  progress: ProgressStore,
  modes: ConcreteTestMode[],
  category?: Category,
): DatasetStats {
  const totalCards = data.length;
  let learnedCards = 0;
  let dueCards = 0;
  let masteredCards = 0;

  for (const item of data) {
    // For mix datasets, only check modes applicable to this item's type
    const applicableModes = category === "mix"
      ? modes.filter((m) => isVocabItem(item) ? VOCAB_MODE_VALUES.has(m) : GRAMMAR_MODE_VALUES.has(m))
      : modes;

    if (applicableModes.length === 0) continue;

    let anyLearned = false;
    let anyDue = false;
    let allMastered = true;

    for (const mode of applicableModes) {
      const key = makeProgressKey(item.id, mode);
      const p: CardProgress | undefined = progress[key];
      if (p) {
        anyLearned = true;
        if (p.repetitions < 3) allMastered = false;
      } else {
        allMastered = false;
      }
      if (isDue(p)) {
        anyDue = true;
      }
    }

    if (anyLearned) learnedCards++;
    if (anyDue) dueCards++;
    if (allMastered) masteredCards++;
  }

  const masteryPercent = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

  return { totalCards, learnedCards, dueCards, masteredCards, masteryPercent };
}
