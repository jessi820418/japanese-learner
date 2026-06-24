import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFavorites } from "../useFavorites";

describe("useFavorites", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.count).toBe(0);
    expect(result.current.list()).toEqual([]);
    expect(result.current.isFavorite("card-1")).toBe(false);
  });

  it("adds a favorite and persists to localStorage", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.add("card-1", "ds-a"));

    expect(result.current.isFavorite("card-1")).toBe(true);
    expect(result.current.count).toBe(1);
    const stored = JSON.parse(localStorage.getItem("jp-learner:favorites")!);
    expect(stored["card-1"].datasetId).toBe("ds-a");
    expect(typeof stored["card-1"].addedAt).toBe("string");
  });

  it("add is idempotent and preserves the original addedAt", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.add("card-1", "ds-a"));
    const first = JSON.parse(localStorage.getItem("jp-learner:favorites")!)["card-1"].addedAt;
    act(() => result.current.add("card-1", "ds-a"));
    const second = JSON.parse(localStorage.getItem("jp-learner:favorites")!)["card-1"].addedAt;
    expect(second).toBe(first);
    expect(result.current.count).toBe(1);
  });

  it("removes a favorite", () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.add("card-1", "ds-a"));
    act(() => result.current.remove("card-1"));
    expect(result.current.isFavorite("card-1")).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("toggle flips state and returns the new state", () => {
    const { result } = renderHook(() => useFavorites());
    let now = false;
    act(() => { now = result.current.toggle("card-1", "ds-a"); });
    expect(now).toBe(true);
    expect(result.current.isFavorite("card-1")).toBe(true);
    act(() => { now = result.current.toggle("card-1", "ds-a"); });
    expect(now).toBe(false);
    expect(result.current.isFavorite("card-1")).toBe(false);
  });

  it("lists favorites across datasets, newest first", () => {
    const { result } = renderHook(() => useFavorites());
    // Seed with explicit timestamps to make ordering deterministic.
    localStorage.setItem(
      "jp-learner:favorites",
      JSON.stringify({
        "card-a": { datasetId: "ds-a", addedAt: "2026-01-01T00:00:00.000Z" },
        "card-b": { datasetId: "ds-b", addedAt: "2026-02-01T00:00:00.000Z" },
      }),
    );
    const { result: r2 } = renderHook(() => useFavorites());
    const list = r2.current.list();
    expect(list.map((f) => f.cardId)).toEqual(["card-b", "card-a"]);
    expect(list.map((f) => f.datasetId)).toEqual(["ds-b", "ds-a"]);
    // result unused beyond render; reference to satisfy lint
    expect(result.current.count).toBeGreaterThanOrEqual(0);
  });
});
