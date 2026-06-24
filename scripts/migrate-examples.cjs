#!/usr/bin/env node
/**
 * One-time migration: lift the inline "例：…" sentence out of each vocab item's
 * `full_explanation` string into a structured `examples` array.
 *
 * Vocabulary items historically stored their example sentence inside
 * `full_explanation` as plain Japanese with no Chinese translation, e.g.:
 *
 *   "アイスクリーム（あいすくりーむ）：冰淇淋。例：昼、公園でアイスクリームを食べました。"
 *
 * After migration the item gains:
 *
 *   "examples": [{ "sentence": "昼、公園でアイスクリームを食べました。", "chinese": "" }]
 *
 * The `chinese` field is intentionally left EMPTY — translations are filled in
 * a separate pass (LLM batch + human review, see docs/example-format-spec.md).
 * Run `validate-examples.cjs` afterwards to find the still-empty translations.
 *
 * Usage:
 *   node scripts/migrate-examples.cjs            # migrate data/*_vocab.json in place
 *   node scripts/migrate-examples.cjs --dry-run  # print what would change, write nothing
 *   node scripts/migrate-examples.cjs --keep-explanation
 *                                                # keep the "例：…" tail in full_explanation
 *
 * Safe to re-run: an item that already has a non-empty `examples` array is
 * skipped, so translations added later are never clobbered.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const keepExplanation = args.includes("--keep-explanation");

// Split on the first 例： / 例: marker. Everything after it (up to end) is the
// example sentence; trailing whitespace is trimmed. Both full-width and
// half-width colons are accepted because the source data mixes them.
const EXAMPLE_RE = /例[：:]\s*(.+?)\s*$/s;

/** Extract { sentence, remainder } from a full_explanation, or null if no 例. */
function extractExample(explanation) {
  if (typeof explanation !== "string") return null;
  const idx = explanation.search(/例[：:]/);
  if (idx === -1) return null;
  const m = explanation.slice(idx).match(EXAMPLE_RE);
  if (!m || !m[1].trim()) return null;
  return {
    sentence: m[1].trim(),
    remainder: explanation.slice(0, idx).trim(),
  };
}

function migrateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const dataset = JSON.parse(raw);
  if (!Array.isArray(dataset.data)) return { file: path.basename(filePath), changed: 0, skipped: 0 };

  let changed = 0;
  let skipped = 0;

  for (const item of dataset.data) {
    // Only migrate vocab items (they carry `hiragana`); grammar already has examples.
    const isVocab = "hiragana" in item;
    if (!isVocab) continue;

    // Already migrated — don't overwrite translations added later.
    if (Array.isArray(item.examples) && item.examples.length > 0) {
      skipped++;
      continue;
    }

    const extracted = extractExample(item.full_explanation);
    if (!extracted) {
      skipped++;
      continue;
    }

    item.examples = [{ sentence: extracted.sentence, chinese: "" }];
    if (!keepExplanation) {
      item.full_explanation = extracted.remainder;
    }
    changed++;
  }

  if (!dryRun && changed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2) + "\n", "utf8");
  }
  return { file: path.basename(filePath), changed, skipped };
}

function main() {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith("_vocab.json"))
    .map((f) => path.join(dataDir, f));

  if (files.length === 0) {
    console.log("[migrate-examples] no *_vocab.json files found in data/");
    return;
  }

  console.log(`[migrate-examples] ${dryRun ? "DRY RUN — " : ""}processing ${files.length} vocab file(s)`);
  let totalChanged = 0;
  for (const file of files) {
    const r = migrateFile(file);
    totalChanged += r.changed;
    console.log(`  ${r.file}: migrated ${r.changed}, skipped ${r.skipped}`);
  }
  console.log(`[migrate-examples] done — ${totalChanged} item(s) gained structured examples.`);
  if (totalChanged > 0) {
    console.log("[migrate-examples] NOTE: `chinese` fields are empty — fill translations, then run validate-examples.cjs");
  }
}

main();
