import type { Example } from "../types";
import { toSpeechText } from "../lib/grammar";
import GrammarHighlight from "./GrammarHighlight";
import SpeakButton from "./SpeakButton";

interface ExampleListProps {
  examples: Example[];
  /** Visual density: "card" for compact flashcard backs, "learn" for the browse view. */
  variant?: "card" | "learn";
}

/**
 * Render a list of example sentences (日文 + 中譯). Each sentence reuses the
 * `【...】` grammar highlight + `{kanji|reading}` furigana rendering and gets a
 * SpeakButton fed the de-annotated plain Japanese.
 */
export default function ExampleList({ examples, variant = "card" }: ExampleListProps) {
  if (examples.length === 0) return null;
  const textSize = variant === "learn" ? "text-base" : "text-sm";

  return (
    <div className="space-y-2 w-full">
      <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-left">
        例句
      </div>
      {examples.map((ex, i) => {
        const speakable = toSpeechText(ex.sentence);
        return (
          <div key={i} className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3 text-left">
            <div className="flex items-center gap-1.5">
              <div className={`${textSize} text-gray-900 dark:text-gray-50 leading-relaxed flex-1 min-w-0`}>
                <GrammarHighlight sentence={ex.sentence} mode="highlight" />
              </div>
              {speakable && <SpeakButton text={speakable} size="sm" label={speakable} />}
            </div>
            {ex.chinese && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ex.chinese}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
