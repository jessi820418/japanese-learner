import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDatasets } from "../hooks/useDatasets";
import { useFavorites } from "../hooks/useFavorites";
import { isVocabItem } from "../types";
import type { DataItem } from "../types";
import {
  VOCAB_TEST_MODES,
  GRAMMAR_TEST_MODES,
  MIX_TEST_MODES,
} from "../types";
import FavoriteButton from "../components/FavoriteButton";
import SpeakButton from "../components/SpeakButton";
import { toSpeechText } from "../lib/grammar";

interface ResolvedFavorite {
  cardId: string;
  datasetId: string;
  datasetName: string;
  level: string;
  item: DataItem;
}

/** Default review mode for a dataset category (first concrete mode). */
function defaultModeFor(category: string): string {
  if (category === "vocabulary") return VOCAB_TEST_MODES[0].value;
  if (category === "grammar") return GRAMMAR_TEST_MODES[0].value;
  return MIX_TEST_MODES[0].value;
}

export default function FavoritesPage() {
  const navigate = useNavigate();
  const datasets = useDatasets();
  const { list } = useFavorites();

  // Resolve each favorite cardId to its live item, dropping favorites whose
  // dataset or card no longer exists (deleted item / dataset).
  const { resolved, byDataset } = useMemo(() => {
    const dsById = new Map(datasets.map((d) => [d.id, d]));
    const resolved: ResolvedFavorite[] = [];
    for (const fav of list()) {
      const ds = dsById.get(fav.datasetId);
      if (!ds) continue;
      const item = ds.data.find((it) => it.id === fav.cardId);
      if (!item) continue;
      resolved.push({
        cardId: fav.cardId,
        datasetId: fav.datasetId,
        datasetName: ds.name,
        level: ds.level,
        item,
      });
    }
    // Group cardIds by dataset for the "review these" action.
    const byDataset = new Map<string, string[]>();
    for (const r of resolved) {
      const arr = byDataset.get(r.datasetId) ?? [];
      arr.push(r.cardId);
      byDataset.set(r.datasetId, arr);
    }
    return { resolved, byDataset };
  }, [datasets, list]);

  // Review favorites: if all from one dataset, start a specific-card session.
  // With multiple datasets we can't mix in one session (sessions are per
  // dataset), so we send the user to the dataset with the most favorites.
  const reviewFavorites = () => {
    if (byDataset.size === 0) return;
    let targetId = "";
    let max = -1;
    for (const [id, ids] of byDataset) {
      if (ids.length > max) {
        max = ids.length;
        targetId = id;
      }
    }
    const ds = datasets.find((d) => d.id === targetId);
    if (!ds) return;
    const cardIds = byDataset.get(targetId)!;
    navigate(`/study/${targetId}/session`, {
      state: {
        modes: defaultModeFor(ds.category),
        sessionSize: cardIds.length,
        sessionType: "specific",
        specificCardIds: cardIds,
      },
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">我的收藏</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{resolved.length} 張收藏卡片</p>
        </div>
      </div>

      {resolved.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-3">⭐</div>
          <p>還沒有收藏任何卡片</p>
          <p className="text-sm mt-1">在學習或測驗時點右上角的星號即可收藏</p>
        </div>
      ) : (
        <>
          {byDataset.size > 0 && (
            <button
              onClick={reviewFavorites}
              className="w-full mb-4 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors tap-active"
            >
              {byDataset.size === 1
                ? `只複習收藏卡（${resolved.length} 張）`
                : `複習收藏最多的學習集（共 ${byDataset.size} 個學習集）`}
            </button>
          )}

          <div className="space-y-3">
            {resolved.map((fav) => {
              const isVocab = isVocabItem(fav.item);
              const speakable = toSpeechText(fav.item.japanese);
              return (
                <div
                  key={fav.cardId}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-50 truncate">
                        {fav.item.japanese}
                      </span>
                      {speakable && <SpeakButton text={speakable} size="sm" label={speakable} />}
                    </div>
                    {isVocab && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{(fav.item as { hiragana: string }).hiragana}</div>
                    )}
                    <div className="text-sm text-blue-700 dark:text-blue-400 truncate">{fav.item.simple_chinese}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {fav.level} · {fav.datasetName}
                    </div>
                  </div>
                  <FavoriteButton cardId={fav.cardId} datasetId={fav.datasetId} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
