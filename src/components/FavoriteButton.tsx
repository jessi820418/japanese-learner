import { useFavorites } from "../hooks/useFavorites";

interface FavoriteButtonProps {
  cardId: string;
  datasetId: string;
  size?: "sm" | "md";
}

/**
 * Star toggle for favoriting a card. Stops click propagation so tapping the
 * star never flips the flashcard underneath.
 */
export default function FavoriteButton({ cardId, datasetId, size = "md" }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(cardId);

  const padding = size === "sm" ? "p-1" : "p-1.5";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // never flip the card
        toggle(cardId, datasetId);
      }}
      className={`${padding} rounded-full transition-colors tap-active flex-shrink-0 ${
        active
          ? "text-amber-400 hover:text-amber-500"
          : "text-gray-300 dark:text-gray-600 hover:text-amber-400 dark:hover:text-amber-400"
      }`}
      aria-label={active ? "取消收藏" : "加入收藏"}
      aria-pressed={active}
    >
      <svg
        className={iconSize}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  );
}
