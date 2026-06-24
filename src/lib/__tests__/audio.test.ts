import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { audioHash, getAudioUrl, __resetAudioManifestCache } from "../audio";

describe("audioHash", () => {
  it("is deterministic", () => {
    expect(audioHash("勉強する")).toBe(audioHash("勉強する"));
  });

  it("differs for different inputs", () => {
    expect(audioHash("勉強")).not.toBe(audioHash("天気"));
  });

  it("returns 8-char lowercase hex", () => {
    expect(audioHash("食べる")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("matches the build script implementation (scripts/gen-audio.cjs)", () => {
    // The runtime hash and the generator hash MUST agree or lookups miss.
    // Drive the CJS script's --list output and compare a few known strings.
    const scriptPath = path.join(process.cwd(), "scripts", "gen-audio.cjs");
    const out = execFileSync("node", [scriptPath, "--list"], { encoding: "utf8" });
    const map = new Map<string, string>();
    for (const line of out.split("\n")) {
      const m = line.match(/^([0-9a-f]{8})\s{2}(.+)$/);
      if (m) map.set(m[2], m[1]);
    }
    // Spot-check: every emitted (text → hash) must equal the runtime hash.
    let checked = 0;
    for (const [text, hash] of map) {
      expect(audioHash(text)).toBe(hash);
      if (++checked >= 50) break;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("getAudioUrl", () => {
  beforeEach(() => {
    __resetAudioManifestCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    __resetAudioManifestCache();
  });

  it("returns a URL when the hash is in the manifest", async () => {
    const hash = audioHash("勉強する");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hashes: [hash] }),
      }),
    );
    const url = await getAudioUrl("勉強する");
    expect(url).toContain(`audio/${hash}.mp3`);
  });

  it("returns null when the hash is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hashes: [] }) }),
    );
    expect(await getAudioUrl("勉強する")).toBeNull();
  });

  it("returns null when the manifest is missing (fetch not ok)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await getAudioUrl("勉強する")).toBeNull();
  });

  it("returns null for empty text without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getAudioUrl("")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
