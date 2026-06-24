import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type {
  DataItem,
  VocabItem,
  GrammarItem,
  TestMode,
  Rating,
  FlashcardContent,
  SessionResult,
  SessionType,
  VocabTestMode,
  GrammarTestMode,
  ActiveSession,
  ActiveSessionCardRef,
} from "../types";
import { isVocabItem, VOCAB_MODE_VALUES, GRAMMAR_MODE_VALUES } from "../types";
import type { LoadedDataset } from "./useDatasets";
import { useProgress } from "./useProgress";
import { isDue } from "../lib/sm2";
import { shuffle } from "../lib/shuffle";
import { buildVocabCard, buildGrammarCard } from "../lib/flashcard";
import {
  makeProgressKey,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
} from "../lib/storage";

interface StudyCard {
  item: DataItem;
  flashcard: FlashcardContent;
  exampleIndex?: number;
  mode?: string; // The concrete mode used for this presentation
}

/** Stable identity for a session config, used to match a persisted snapshot. */
function sessionIdentity(
  datasetId: string,
  modes: string | string[],
  sessionType: SessionType,
  specificCardIds?: string[],
): string {
  return JSON.stringify({ datasetId, modes, sessionType, specificCardIds: specificCardIds ?? null });
}

export function useStudySession(
  dataset: LoadedDataset | undefined,
  modes: string | string[],
  sessionSize: number,
  sessionType: SessionType = "due",
  specificCardIds?: string[],
) {
  const { progress, rateCard } = useProgress();

  // Determine if this is a multi-mode session
  const isMultiMode = Array.isArray(modes) && modes.length > 1;
  const modeArray = Array.isArray(modes) ? modes : [modes];

  // Try to restore a persisted snapshot whose config matches this session.
  // Captured once on mount so a re-render (e.g. progress change) can't re-trigger
  // a restore after the user has moved on.
  const restored = useMemo<ActiveSession | null>(() => {
    if (!dataset) return null;
    const saved = loadActiveSession();
    if (!saved) return null;
    const want = sessionIdentity(dataset.id, modes, sessionType, specificCardIds);
    const have = sessionIdentity(saved.datasetId, saved.modes, saved.sessionType, saved.specificCardIds);
    return want === have ? saved : null;
    // Match only on mount; deps mirror the original queue-build deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id, modes, sessionType]);

  // Build the initial card queue.
  //
  // Single-mode: each item produces one StudyCard.
  // Multi-mode (綜合模式): each item produces N StudyCards (one per mode).
  //   Cards are grouped by mode in canonical order so the user practices
  //   one skill at a time — e.g. all 漢字→中文 first, then 假名→中文,
  //   then 中文→日文. Items are shuffled within each mode group.
  //   Only the specific failed (card, mode) pair is requeued on "again".
  //
  // When a matching snapshot was persisted, the queue is rebuilt deterministically
  // from the saved card refs instead of being reshuffled.
  const initialCards: StudyCard[] = useMemo(() => {
    if (!dataset) return [];

    if (restored) {
      return rebuildCards(restored.queue, dataset);
    }

    const resolvedModes = Array.isArray(modes) ? modes : [modes];

    if (specificCardIds) {
      // Specific card IDs — filter and preserve order
      const idToOrder = new Map(specificCardIds.map((id, i) => [id, i]));
      const filtered = dataset.data
        .filter((item) => idToOrder.has(item.id))
        .sort((a, b) => (idToOrder.get(a.id) ?? 0) - (idToOrder.get(b.id) ?? 0));

      if (resolvedModes.length > 1) {
        // Multi-mode: group by mode in canonical order, items shuffled within each group
        const shuffledFiltered = shuffle(filtered);
        const cards: StudyCard[] = [];
        for (const m of resolvedModes) {
          for (const item of shuffledFiltered) {
            // For mix: skip inapplicable (item, mode) pairs
            const applicable = getApplicableModes(item, [m], dataset.category);
            if (applicable.length === 0) continue;
            cards.push(makeCard(item, dataset.category, m as TestMode, m));
          }
        }
        return cards;
      }

      // Single mode: for mix, only include items matching the mode type
      const singleFiltered = dataset.category === "mix"
        ? filtered.filter((item) => getApplicableModes(item, [resolvedModes[0]], dataset.category).length > 0)
        : filtered;
      return singleFiltered.map((item) => makeCard(item, dataset.category, resolvedModes[0] as TestMode, resolvedModes[0]));
    }

    // Filter cards based on session type
    let items: DataItem[];
    if (sessionType === "random") {
      items = dataset.data;
    } else if (resolvedModes.length > 1) {
      // Multi-mode due: card is due if ANY applicable mode's composite key is due
      items = dataset.data.filter((item) => {
        const applicable = getApplicableModes(item, resolvedModes, dataset.category);
        return applicable.some((m) => isDue(progress[makeProgressKey(item.id, m)]));
      });
    } else {
      items = dataset.data.filter((item) => isDue(progress[item.id]));
    }

    // For mix single-mode: only include items matching the mode type
    if (dataset.category === "mix" && resolvedModes.length === 1) {
      items = items.filter((item) => getApplicableModes(item, resolvedModes, dataset.category).length > 0);
    }

    const shuffled = shuffle(items);
    const selected = shuffled.slice(0, sessionSize);

    if (resolvedModes.length > 1) {
      // Multi-mode: group by mode in canonical order, items shuffled within each group
      const cards: StudyCard[] = [];
      for (const m of resolvedModes) {
        for (const item of selected) {
          // For mix: skip inapplicable (item, mode) pairs
          const applicable = getApplicableModes(item, [m], dataset.category);
          if (applicable.length === 0) continue;
          cards.push(makeCard(item, dataset.category, m as TestMode, m));
        }
      }
      return cards; // selected is already shuffled above
    }

    return selected.map((item) => makeCard(item, dataset.category, resolvedModes[0] as TestMode, resolvedModes[0]));
  // Only compute once on mount (deps intentionally exclude progress to avoid re-shuffle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id, modes, sessionSize, sessionType, restored]);

  // State — seeded from the restored snapshot when present.
  const [currentIndex, setCurrentIndex] = useState(() => restored?.currentIndex ?? 0);
  const [isFlipped, setIsFlipped] = useState(() => restored?.isFlipped ?? false);
  const [results, setResults] = useState<{ cardId: string; rating: Rating; mode?: string }[]>(
    () => restored?.results ?? [],
  );
  const [requeue, setRequeue] = useState<StudyCard[]>(() =>
    restored && dataset ? rebuildCards(restored.requeue, dataset) : [],
  );
  const [isComplete, setIsComplete] = useState(false);

  // Combined queue: initial cards + requeued cards
  const allCards = useMemo(() => [...initialCards, ...requeue], [initialCards, requeue]);

  const currentCard = allCards[currentIndex] as StudyCard | undefined;
  const totalCards = allCards.length;

  // Unique card count (for multi-mode summary)
  const uniqueCardCount = useMemo(() => {
    const ids = new Set(initialCards.map((c) => c.item.id));
    return ids.size;
  }, [initialCards]);

  const isSessionComplete = isComplete || (currentIndex >= allCards.length && allCards.length > 0);

  // Persist a snapshot of the live session so a reload / backgrounding resumes
  // the exact queue + position + flip. Cleared once the session completes.
  // Refs let the persistence effect read current queue state without widening
  // its dependency list (which would re-run it on every render).
  const initialCardsRef = useRef(initialCards);
  initialCardsRef.current = initialCards;
  const requeueRef = useRef(requeue);
  requeueRef.current = requeue;

  const persist = useCallback(
    (next: { currentIndex: number; isFlipped: boolean; results: typeof results; requeue: StudyCard[] }) => {
      if (!dataset) return;
      const snapshot: ActiveSession = {
        datasetId: dataset.id,
        modes,
        sessionType,
        specificCardIds,
        queue: initialCardsRef.current.map(toCardRef),
        requeue: next.requeue.map(toCardRef),
        currentIndex: next.currentIndex,
        isFlipped: next.isFlipped,
        results: next.results,
        updatedAt: new Date().toISOString(),
      };
      saveActiveSession(snapshot);
    },
    [dataset, modes, sessionType, specificCardIds],
  );

  // Persist the freshly-built queue on mount (so a reload before any interaction
  // still restores the same shuffle). Skips empty queues and already-complete ones.
  const didInitialPersist = useRef(false);
  useEffect(() => {
    if (didInitialPersist.current) return;
    if (!dataset || initialCards.length === 0) return;
    didInitialPersist.current = true;
    if (!isSessionComplete) {
      persist({ currentIndex, isFlipped, results, requeue });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, initialCards.length]);

  // Clear the snapshot when the session completes.
  useEffect(() => {
    if (isSessionComplete && didInitialPersist.current) {
      clearActiveSession();
    }
  }, [isSessionComplete]);

  const flip = useCallback(() => {
    setIsFlipped((prev) => {
      const nextFlip = !prev;
      persist({ currentIndex, isFlipped: nextFlip, results, requeue });
      return nextFlip;
    });
  }, [persist, currentIndex, results, requeue]);

  const rate = useCallback(
    (rating: Rating) => {
      if (!currentCard || !dataset) return;

      const cardId = currentCard.item.id;
      const cardMode = currentCard.mode;

      // Use composite key for multi-mode, plain cardId for single-mode
      const progressKey = isMultiMode && cardMode ? makeProgressKey(cardId, cardMode) : cardId;
      rateCard(progressKey, dataset.id, rating);

      const nextResults = [...results, { cardId, rating, mode: cardMode }];
      setResults(nextResults);

      // Re-queue "again" cards — only the failed (card, mode) presentation
      const nextRequeue = rating === "again" ? [...requeue, currentCard] : requeue;
      if (rating === "again") {
        setRequeue(nextRequeue);
      }

      // Move to next card
      const nextIndex = currentIndex + 1;
      if (nextIndex >= allCards.length + (rating === "again" ? 1 : 0)) {
        if (nextIndex >= totalCards + (rating === "again" ? 1 : 0)) {
          setIsComplete(true);
        }
      }

      setCurrentIndex(nextIndex);
      setIsFlipped(false);

      // Persist the post-rating state. When the session just completed, the
      // completion effect clears the snapshot, so skip writing a stale one.
      const willComplete = nextIndex >= nextRequeue.length + initialCardsRef.current.length;
      if (willComplete) {
        clearActiveSession();
      } else {
        persist({ currentIndex: nextIndex, isFlipped: false, results: nextResults, requeue: nextRequeue });
      }
    },
    [currentCard, dataset, currentIndex, allCards.length, totalCards, rateCard, isMultiMode, results, requeue, persist],
  );

  // Current mode label for display
  const currentModeLabel = currentCard?.mode;

  const sessionResult: SessionResult = useMemo(() => {
    const good = results.filter((r) => r.rating === "good").length;
    const hard = results.filter((r) => r.rating === "hard").length;
    const again = results.filter((r) => r.rating === "again").length;
    return { total: results.length, good, hard, again, cards: results };
  }, [results]);

  return {
    currentCard,
    currentIndex,
    totalCards,
    isFlipped,
    isSessionComplete,
    sessionResult,
    flip,
    rate,
    isMultiMode,
    currentModeLabel,
    uniqueCardCount,
    modesCount: modeArray.length,
    /** True when this session was resumed from a persisted snapshot. */
    wasRestored: restored !== null,
  };
}

/** Serialize a live StudyCard down to its persistable reference. */
function toCardRef(card: StudyCard): ActiveSessionCardRef {
  return { itemId: card.item.id, mode: card.mode, exampleIndex: card.exampleIndex };
}

/** Rebuild live StudyCards from persisted refs, dropping any whose item vanished. */
function rebuildCards(refs: ActiveSessionCardRef[], dataset: LoadedDataset): StudyCard[] {
  const byId = new Map(dataset.data.map((it) => [it.id, it]));
  const cards: StudyCard[] = [];
  for (const ref of refs) {
    const item = byId.get(ref.itemId);
    if (!item) continue;
    cards.push(makeCard(item, dataset.category, ref.mode as TestMode, ref.mode, ref.exampleIndex));
  }
  return cards;
}

/** For mix datasets, return only modes applicable to the given item type */
function getApplicableModes(item: DataItem, modes: string[], category: string): string[] {
  if (category !== "mix") return modes;
  const isVocab = isVocabItem(item);
  return modes.filter((m) => isVocab ? VOCAB_MODE_VALUES.has(m) : GRAMMAR_MODE_VALUES.has(m));
}

/**
 * Build a StudyCard, recording the concrete `mode` and (for grammar) the chosen
 * `exampleIndex` so the presentation can be restored verbatim. When
 * `exampleIndex` is omitted a random example is picked (fresh build); when
 * provided it is reused (restore).
 */
function makeCard(
  item: DataItem,
  category: string,
  mode: TestMode,
  modeLabel?: string,
  exampleIndex?: number,
): StudyCard {
  const isVocab = category === "mix" ? isVocabItem(item) : category === "vocabulary";

  if (isVocab) {
    return {
      item,
      flashcard: buildVocabCard(item as VocabItem, mode as VocabTestMode),
      mode: modeLabel,
    };
  }

  const grammarItem = item as GrammarItem;
  const resolvedIndex =
    exampleIndex ??
    (grammarItem.examples?.length > 0 ? Math.floor(Math.random() * grammarItem.examples.length) : 0);
  return {
    item,
    flashcard: buildGrammarCard(grammarItem, mode as GrammarTestMode, resolvedIndex),
    mode: modeLabel,
    exampleIndex: resolvedIndex,
  };
}
