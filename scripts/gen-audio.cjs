#!/usr/bin/env node
/**
 * Pre-generate natural-voice TTS audio for every Japanese word / example
 * sentence in data/*.json (Section 6, plan B — static pre-generation).
 *
 * For each unique speakable string it synthesizes an mp3 via a cloud neural TTS
 * provider and writes:
 *   public/audio/<hash>.mp3        — one file per unique sentence
 *   public/audio/manifest.json     — { hashes: [...] } consumed by src/lib/audio.ts
 *
 * The runtime (SpeakButton) prefers these files and falls back to the browser
 * Web Speech API when a hash is missing, so a partial run still works.
 *
 * ── Providers (auto-detected, in priority order) ────────────────────────────
 *   MediaTek GAISF gateway (default on a corp box): uses MAMBA_API_KEY +
 *     MAMBA_USER_ID (or the patent-app .env fallback). Voice via MTK_TTS_VOICE
 *     (default "nova"), model via MTK_TTS_MODEL (default "gpt-4o-mini-tts";
 *     "aide-tts"/"aide-tts-hd" also work).
 *   Google Cloud TTS:   GOOGLE_TTS_API_KEY=...   [GOOGLE_TTS_VOICE=ja-JP-Neural2-B]
 *   Azure Speech:       AZURE_TTS_KEY=...  AZURE_TTS_REGION=japaneast
 *                                            [AZURE_TTS_VOICE=ja-JP-NanamiNeural]
 *
 * With NO provider configured the script runs in --dry-run-like "plan" mode:
 * it reports how many clips WOULD be generated and exits 0 without writing
 * audio, so CI / first-time clones don't fail. Provide a key to actually
 * synthesize.
 *
 * Usage:
 *   node scripts/gen-audio.cjs               # uses MTK gateway if available
 *   GOOGLE_TTS_API_KEY=xxx node scripts/gen-audio.cjs
 *   node scripts/gen-audio.cjs --list        # print every unique speakable string
 *   node scripts/gen-audio.cjs --force       # re-generate even if mp3 already exists
 *   node scripts/gen-audio.cjs --concurrency 8   # parallel synth requests (default 6)
 *
 * The hash MUST match src/lib/audio.ts `audioHash` exactly.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const { MtkGateway } = require("./lib/mtk-gateway.cjs");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const audioDir = path.join(root, "public", "audio");

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const force = args.includes("--force");
const concArg = args.indexOf("--concurrency");
const CONCURRENCY = concArg >= 0 && args[concArg + 1] ? Math.max(1, parseInt(args[concArg + 1], 10)) : 6;

// ── Text extraction (mirrors src/lib/grammar.ts toSpeechText) ───────────────

/** Strip {kanji|reading} → kanji and remove 【】 markers → plain Japanese. */
function toSpeechText(sentence) {
  return sentence
    .replace(/\{([^|{}]+)\|[^}]+\}/g, "$1")
    .replace(/[【】]/g, "")
    .trim();
}

/** FNV-1a (32-bit) → hex. MUST match src/lib/audio.ts `audioHash`. */
function audioHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Collect every unique speakable Japanese string across all datasets. */
function collectSpeakables() {
  const set = new Set();
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    let ds;
    try {
      ds = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(ds.data)) continue;
    for (const item of ds.data) {
      if (item.japanese) set.add(toSpeechText(item.japanese));
      if (Array.isArray(item.examples)) {
        for (const ex of item.examples) {
          if (ex.sentence) set.add(toSpeechText(ex.sentence));
        }
      }
    }
  }
  set.delete("");
  return [...set];
}

// ── TTS providers ───────────────────────────────────────────────────────────

function httpsPostJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf);
        else reject(new Error(`HTTP ${res.statusCode}: ${buf.toString("utf8").slice(0, 200)}`));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/** Google Cloud Text-to-Speech → Buffer(mp3). */
async function googleTts(text, apiKey, voice) {
  const payload = JSON.stringify({
    input: { text },
    voice: { languageCode: "ja-JP", name: voice || "ja-JP-Neural2-B" },
    audioConfig: { audioEncoding: "MP3" },
  });
  const buf = await httpsPostJson(
    {
      hostname: "texttospeech.googleapis.com",
      path: `/v1/text:synthesize?key=${apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    },
    payload,
  );
  const { audioContent } = JSON.parse(buf.toString("utf8"));
  return Buffer.from(audioContent, "base64");
}

/** Azure Speech → Buffer(mp3). */
async function azureTts(text, key, region, voice) {
  const v = voice || "ja-JP-NanamiNeural";
  const ssml =
    `<speak version='1.0' xml:lang='ja-JP'>` +
    `<voice xml:lang='ja-JP' name='${v}'>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</voice>` +
    `</speak>`;
  return httpsPostJson(
    {
      hostname: `${region}.tts.speech.microsoft.com`,
      path: "/cognitiveservices/v1",
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "Content-Length": Buffer.byteLength(ssml),
      },
    },
    ssml,
  );
}

/** Resolve the configured provider, or null when none is set. */
function resolveProvider() {
  // Prefer the MediaTek GAISF gateway when its credentials are available.
  const gw = new MtkGateway();
  if (gw.isConfigured()) {
    const voice = process.env.MTK_TTS_VOICE || "nova";
    const model = process.env.MTK_TTS_MODEL || "gpt-4o-mini-tts";
    return {
      name: `MTK gateway (${model}/${voice})`,
      synth: (t) => gw.tts({ text: t, deployment: model, voice }),
    };
  }
  if (process.env.GOOGLE_TTS_API_KEY) {
    const key = process.env.GOOGLE_TTS_API_KEY;
    const voice = process.env.GOOGLE_TTS_VOICE;
    return { name: "Google Cloud TTS", synth: (t) => googleTts(t, key, voice) };
  }
  if (process.env.AZURE_TTS_KEY && process.env.AZURE_TTS_REGION) {
    const key = process.env.AZURE_TTS_KEY;
    const region = process.env.AZURE_TTS_REGION;
    const voice = process.env.AZURE_TTS_VOICE;
    return { name: "Azure Speech", synth: (t) => azureTts(t, key, region, voice) };
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const speakables = collectSpeakables();

  if (listOnly) {
    speakables.forEach((s) => console.log(`${audioHash(s)}  ${s}`));
    console.log(`\n[gen-audio] ${speakables.length} unique speakable string(s).`);
    return;
  }

  const provider = resolveProvider();
  if (!provider) {
    console.log(`[gen-audio] No TTS provider configured (set GOOGLE_TTS_API_KEY or AZURE_TTS_KEY+AZURE_TTS_REGION).`);
    console.log(`[gen-audio] Plan mode: ${speakables.length} clip(s) WOULD be generated into public/audio/.`);
    console.log(`[gen-audio] Runtime falls back to Web Speech until audio is generated. Exiting 0.`);
    return;
  }

  fs.mkdirSync(audioDir, { recursive: true });
  console.log(`[gen-audio] Provider: ${provider.name} — ${speakables.length} unique clip(s), concurrency ${CONCURRENCY}.`);

  const hashes = speakables.map((text) => ({ text, hash: audioHash(text) }));
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  // Worker-pool over the clip list: CONCURRENCY synth requests in flight at once.
  // Each clip is independent and written to its own file, so order doesn't matter
  // and a single failure never blocks the rest.
  let cursor = 0;
  async function worker() {
    while (cursor < hashes.length) {
      const { text, hash } = hashes[cursor++];
      const outPath = path.join(audioDir, `${hash}.mp3`);
      if (!force && fs.existsSync(outPath)) {
        skipped++;
        continue;
      }
      try {
        const mp3 = await provider.synth(text);
        fs.writeFileSync(outPath, mp3);
        generated++;
        if (generated % 50 === 0) console.log(`  …${generated} generated (${skipped} reused, ${failed} failed)`);
      } catch (err) {
        failed++;
        console.warn(`  [fail] ${hash} "${text.slice(0, 24)}…": ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Manifest lists every hash that has (or already had) a file on disk.
  const present = hashes
    .map((h) => h.hash)
    .filter((h) => fs.existsSync(path.join(audioDir, `${h}.mp3`)));
  fs.writeFileSync(
    path.join(audioDir, "manifest.json"),
    JSON.stringify({ hashes: [...new Set(present)] }, null, 0) + "\n",
    "utf8",
  );

  console.log(
    `[gen-audio] done — ${generated} generated, ${skipped} reused, ${failed} failed; ` +
      `manifest lists ${present.length} clip(s).`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[gen-audio] fatal:", err);
  process.exit(1);
});
