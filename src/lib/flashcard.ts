import type {
  VocabItem,
  GrammarItem,
  VocabTestMode,
  GrammarTestMode,
  FlashcardContent,
  Example,
} from "../types";
import { stripGrammarBrackets } from "./grammar";

/** Max example sentences pinned to a card back (spec: 1~2). */
const MAX_BACK_EXAMPLES = 2;

/** Pick the example sentences to pin on a card back (only those with content). */
function backExamples(examples: Example[] | undefined): Example[] | undefined {
  if (!examples || examples.length === 0) return undefined;
  const picked = examples.filter((ex) => ex.sentence?.trim()).slice(0, MAX_BACK_EXAMPLES);
  return picked.length > 0 ? picked : undefined;
}

/**
 * Return all examples EXCEPT the one already shown on the front (by index), so
 * example-driven modes (example-to-chinese, fill-in-grammar) don't repeat the
 * question sentence on the back. With a single example this yields an empty
 * list (nothing new to pin) rather than re-showing the front sentence.
 */
function otherExamples(examples: Example[] | undefined, usedIndex: number): Example[] | undefined {
  if (!examples) return undefined;
  return examples.filter((_, i) => i !== usedIndex);
}

/**
 * Build flashcard content for a vocabulary item based on the test mode.
 */
export function buildVocabCard(item: VocabItem, mode: VocabTestMode): FlashcardContent {
  if (mode === "random") {
    const concreteModes: VocabTestMode[] = ["kanji-to-chinese", "hiragana-to-chinese", "chinese-to-japanese"];
    return buildVocabCard(item, concreteModes[Math.floor(Math.random() * concreteModes.length)]);
  }
  const examples = backExamples(item.examples);

  switch (mode) {
    case "kanji-to-chinese":
      return {
        front: { primary: item.japanese },
        back: {
          primary: item.simple_chinese,
          pronunciation: item.japanese,
          secondary: item.hiragana,
          detail: item.full_explanation || undefined,
          examples,
        },
      };
    case "hiragana-to-chinese":
      return {
        front: { primary: item.hiragana },
        back: {
          primary: item.simple_chinese,
          pronunciation: item.japanese,
          detail: item.full_explanation || undefined,
          examples,
        },
      };
    case "chinese-to-japanese":
      return {
        front: { primary: item.simple_chinese },
        back: {
          primary: item.japanese,
          pronunciation: item.japanese,
          secondary: item.hiragana,
          detail: item.full_explanation || undefined,
          examples,
        },
      };
    default:
      // Fallback for safety
      return {
        front: { primary: item.japanese },
        back: { primary: item.simple_chinese },
      };
  }
}

/**
 * Build flashcard content for a grammar item based on the test mode.
 * For example-based modes, picks a random example.
 */
export function buildGrammarCard(
  item: GrammarItem,
  mode: GrammarTestMode,
  exampleIndex?: number,
): FlashcardContent {
  if (mode === "random") {
    const concreteModes: GrammarTestMode[] = ["grammar-to-chinese", "example-to-chinese", "chinese-to-grammar", "fill-in-grammar"];
    return buildGrammarCard(item, concreteModes[Math.floor(Math.random() * concreteModes.length)], exampleIndex);
  }
  const example = item.examples?.[exampleIndex ?? 0];

  switch (mode) {
    case "grammar-to-chinese":
      return {
        front: { primary: item.japanese },
        back: {
          primary: item.simple_chinese,
          detail: item.full_explanation || undefined,
          examples: backExamples(item.examples),
        },
      };

    case "example-to-chinese":
      // The example shown on the front is already the question; on the back we
      // pin the OTHER examples (if any) so the learner sees fresh sentences.
      return {
        front: {
          primary: example ? `__GRAMMAR_HIGHLIGHT__${example.sentence}` : item.japanese,
        },
        back: {
          primary: example?.chinese ?? item.simple_chinese,
          secondary: item.japanese + "：" + item.simple_chinese,
          detail: item.full_explanation || undefined,
          examples: backExamples(otherExamples(item.examples, exampleIndex ?? 0)),
        },
      };

    case "chinese-to-grammar":
      return {
        front: { primary: item.simple_chinese },
        back: {
          primary: item.japanese,
          pronunciation: item.japanese,
          detail: item.full_explanation || undefined,
          examples: backExamples(item.examples),
        },
      };

    case "fill-in-grammar":
      // Front shows the blanked sentence; back reveals the answer. Pin the
      // remaining examples so the back still carries extra reinforcement.
      return {
        front: {
          primary: example ? `__GRAMMAR_BLANK__${example.sentence}` : item.simple_chinese,
          secondary: example?.chinese,
        },
        back: {
          primary: item.japanese,
          secondary: example ? stripGrammarBrackets(example.sentence) : undefined,
          secondaryIsJapanese: example !== undefined,
          detail: item.full_explanation || undefined,
          examples: backExamples(otherExamples(item.examples, exampleIndex ?? 0)),
        },
      };
    default:
      // Fallback for safety
      return {
        front: { primary: item.japanese },
        back: { primary: item.simple_chinese },
      };
  }
}
