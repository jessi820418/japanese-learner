/**
 * Pre-generated audio lookup.
 *
 * The build-time script `scripts/gen-audio.cjs` synthesizes an mp3 for every
 * unique Japanese sentence/word and writes them to `public/audio/<hash>.mp3`
 * alongside a `manifest.json` listing the hashes it produced. At runtime
 * `SpeakButton` calls `getAudioUrl()` to prefer that natural-voice mp3, and
 * only falls back to the browser's Web Speech API when no file exists.
 *
 * The hash MUST stay byte-for-byte identical between this module and the build
 * script (`audioHash` is mirrored in `scripts/gen-audio.cjs`), otherwise lookups
 * miss. It is a plain FNV-1a over the UTF-16 code units of the speakable text.
 */

/** FNV-1a (32-bit) hash → lowercase hex. Mirrored in scripts/gen-audio.cjs. */
export function audioHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in integer range.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

interface AudioManifest {
  /** Set of hashes that have a generated mp3. */
  hashes: string[];
}

const BASE = import.meta.env.BASE_URL; // e.g. "/japanese-learner/"
const AUDIO_DIR = `${BASE}audio/`;

let manifestPromise: Promise<Set<string>> | null = null;

/** Load (and cache) the set of available audio hashes. Empty set if absent. */
function loadManifest(): Promise<Set<string>> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(`${AUDIO_DIR}manifest.json`)
    .then((res) => (res.ok ? res.json() : { hashes: [] }))
    .then((data: AudioManifest) => new Set(data.hashes ?? []))
    .catch(() => new Set<string>());
  return manifestPromise;
}

/**
 * Resolve the URL of the pre-generated mp3 for `speakable` text, or null when
 * no file was generated (caller should fall back to Web Speech).
 */
export async function getAudioUrl(speakable: string): Promise<string | null> {
  if (!speakable) return null;
  const hash = audioHash(speakable);
  const hashes = await loadManifest();
  return hashes.has(hash) ? `${AUDIO_DIR}${hash}.mp3` : null;
}

/** Test seam: reset the cached manifest promise. */
export function __resetAudioManifestCache(): void {
  manifestPromise = null;
}
