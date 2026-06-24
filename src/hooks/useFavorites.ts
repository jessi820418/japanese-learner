import { useCallback, useSyncExternalStore } from "react";
import type { FavoritesStore } from "../types";
import {
  loadFavorites,
  saveFavorites,
  subscribeFavorites,
  getFavoritesSnapshot,
} from "../lib/storage";

export interface FavoriteListItem {
  cardId: string;
  datasetId: string;
  addedAt: string;
}

/**
 * Favorites CRUD backed by localStorage (`jp-learner:favorites`).
 *
 * Reactive across components via `useSyncExternalStore` — toggling a favorite
 * on a flashcard immediately updates the "我的收藏" list elsewhere. Favorites
 * are keyed by raw `cardId` (NOT the multi-mode `cardId::mode` progress key),
 * so a card is favorited once regardless of which test mode surfaced it.
 */
export function useFavorites() {
  // Re-render whenever favorites change.
  useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getFavoritesSnapshot);
  const favorites: FavoritesStore = loadFavorites();

  const isFavorite = useCallback(
    (cardId: string): boolean => cardId in loadFavorites(),
    [],
  );

  const add = useCallback((cardId: string, datasetId: string): void => {
    const store = loadFavorites();
    if (store[cardId]) return; // already favorited — preserve original addedAt
    store[cardId] = { datasetId, addedAt: new Date().toISOString() };
    saveFavorites(store);
  }, []);

  const remove = useCallback((cardId: string): void => {
    const store = loadFavorites();
    if (!store[cardId]) return;
    delete store[cardId];
    saveFavorites(store);
  }, []);

  const toggle = useCallback((cardId: string, datasetId: string): boolean => {
    const store = loadFavorites();
    if (store[cardId]) {
      delete store[cardId];
      saveFavorites(store);
      return false;
    }
    store[cardId] = { datasetId, addedAt: new Date().toISOString() };
    saveFavorites(store);
    return true;
  }, []);

  /** All favorites, newest first. */
  const list = useCallback((): FavoriteListItem[] => {
    const store = loadFavorites();
    return Object.entries(store)
      .map(([cardId, entry]) => ({ cardId, datasetId: entry.datasetId, addedAt: entry.addedAt }))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }, []);

  return { favorites, isFavorite, add, remove, toggle, list, count: Object.keys(favorites).length };
}
