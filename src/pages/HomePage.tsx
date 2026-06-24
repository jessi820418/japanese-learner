import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDatasetMetas, useDatasets } from "../hooks/useDatasets";
import { useFavorites } from "../hooks/useFavorites";
import { loadActiveSession } from "../lib/storage";
import DatasetCard from "../components/DatasetCard";
import FilterBar from "../components/FilterBar";

export default function HomePage() {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const datasets = useDatasets();
  const metas = useDatasetMetas(categoryFilter || undefined, levelFilter || undefined);
  const { count: favoriteCount } = useFavorites();
  const navigate = useNavigate();

  // Surface an unfinished study session so the user can jump straight back in.
  const active = loadActiveSession();
  const resumeDataset = active
    ? datasets.find((d) => d.id === active.datasetId)
    : undefined;
  const canResume =
    !!active &&
    !!resumeDataset &&
    active.currentIndex < active.queue.length + active.requeue.length;

  // Extract unique categories and levels for filter bar
  const categories = useMemo(
    () => [...new Set(datasets.map((d) => d.category))],
    [datasets],
  );
  const levels = useMemo(
    () => [...new Set(datasets.map((d) => d.level))].sort(),
    [datasets],
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">學習集</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">選擇一個學習集開始複習</p>
      </div>

      {/* Resume unfinished session */}
      {canResume && (
        <button
          onClick={() =>
            navigate(`/study/${active!.datasetId}/session`, {
              state: {
                modes: active!.modes,
                sessionSize: active!.queue.length,
                sessionType: active!.sessionType,
                specificCardIds: active!.specificCardIds,
              },
            })
          }
          className="w-full mb-3 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors tap-active flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 2.25-4.5 2.25v-4.5z" />
          </svg>
          繼續上次複習 · {resumeDataset!.name}
        </button>
      )}

      {/* My favorites entry */}
      <button
        onClick={() => navigate("/favorites")}
        className="w-full mb-3 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors tap-active flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        我的收藏{favoriteCount > 0 && `（${favoriteCount}）`}
      </button>

      {/* Create new dataset button */}
      <button
        onClick={() => navigate("/manage/new")}
        className="w-full mb-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 font-semibold hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors tap-active"
      >
        + 新增學習集
      </button>

      <FilterBar
        categories={categories}
        levels={levels}
        selectedCategory={categoryFilter}
        selectedLevel={levelFilter}
        onCategoryChange={setCategoryFilter}
        onLevelChange={setLevelFilter}
      />

      {metas.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-3">📚</div>
          <p>沒有找到符合條件的學習集</p>
        </div>
      ) : (
        <div className="space-y-3">
          {metas.map((meta) => (
            <DatasetCard key={meta.id} dataset={meta} />
          ))}
        </div>
      )}
    </div>
  );
}
