import type { VocabItem, GrammarItem, DataItem, Category } from "../types";
import { isVocabItem } from "../types";
import SpeakButton from "./SpeakButton";
import ExampleList from "./ExampleList";
import FavoriteButton from "./FavoriteButton";

interface LearnCardProps {
  item: DataItem;
  category: Category;
  /** When provided, a favorite (star) toggle is shown in the card corner. */
  datasetId?: string;
}

function VocabLearnCard({ item, datasetId }: { item: VocabItem; datasetId?: string }) {
  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
      {datasetId && (
        <div className="absolute top-3 right-3">
          <FavoriteButton cardId={item.id} datasetId={datasetId} />
        </div>
      )}
      {/* Japanese */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <div className="text-4xl font-bold text-gray-900 dark:text-gray-50">{item.japanese}</div>
          <SpeakButton text={item.japanese} label={item.japanese} />
        </div>
        <div className="text-lg text-gray-500 dark:text-gray-400 mt-1">{item.hiragana}</div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700" />

      {/* Chinese meaning */}
      <div className="text-center">
        <div className="text-xl font-semibold text-blue-700 dark:text-blue-400">{item.simple_chinese}</div>
      </div>

      {/* Full explanation */}
      {item.full_explanation && (
        <>
          <div className="border-t border-gray-100 dark:border-gray-700" />
          <div className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.full_explanation}</div>
        </>
      )}

      {/* Examples */}
      {item.examples && item.examples.length > 0 && (
        <>
          <div className="border-t border-gray-100 dark:border-gray-700" />
          <ExampleList examples={item.examples} variant="learn" />
        </>
      )}
    </div>
  );
}

function GrammarLearnCard({ item, datasetId }: { item: GrammarItem; datasetId?: string }) {
  const hasExamples = item.examples && item.examples.length > 0;
  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
      {datasetId && (
        <div className="absolute top-3 right-3">
          <FavoriteButton cardId={item.id} datasetId={datasetId} />
        </div>
      )}
      {/* Grammar pattern */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-50">{item.japanese}</div>
          <SpeakButton text={item.japanese} label={item.japanese} />
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700" />

      {/* Chinese meaning */}
      <div className="text-center">
        <div className="text-xl font-semibold text-blue-700 dark:text-blue-400">{item.simple_chinese}</div>
      </div>

      {/* Full explanation */}
      {item.full_explanation && (
        <>
          <div className="border-t border-gray-100 dark:border-gray-700" />
          <div className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.full_explanation}</div>
        </>
      )}

      {/* Examples */}
      <div className="border-t border-gray-100 dark:border-gray-700" />
      {hasExamples ? (
        <ExampleList examples={item.examples} variant="learn" />
      ) : (
        <div className="text-sm text-gray-400 dark:text-gray-500 italic text-center">尚無例句</div>
      )}
    </div>
  );
}

export default function LearnCard({ item, category, datasetId }: LearnCardProps) {
  if (category === "vocabulary" || (category === "mix" && isVocabItem(item))) {
    return <VocabLearnCard item={item as VocabItem} datasetId={datasetId} />;
  }
  return <GrammarLearnCard item={item as GrammarItem} datasetId={datasetId} />;
}
