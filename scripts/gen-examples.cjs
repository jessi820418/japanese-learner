#!/usr/bin/env node
"use strict";
/**
 * Generate natural, everyday Japanese example sentences + Traditional Chinese
 * translations for every vocabulary item in data/*_vocab.json, using the
 * MediaTek GAISF gateway (Claude). Replaces the raw migrated examples (which
 * had no translation and a textbook tone) with sentences a Japanese speaker
 * would actually use day-to-day.
 *
 * Each generated example follows docs/example-format-spec.md:
 *   - one sentence, <= 20 core chars, ends with 。/？/！
 *   - target word wrapped in 【...】
 *   - kanji words annotated as {漢字|よみ}
 *   - per-level vocabulary scope (N5/N4/N3)
 *   - chinese = Traditional-Chinese translation
 *
 * Resumable & safe:
 *   - by default only fills items whose example lacks a `chinese` translation
 *     (so re-running continues where it left off; --force redoes everything)
 *   - writes back to the SAME file after each batch, so a crash keeps progress
 *
 * Usage:
 *   node scripts/gen-examples.cjs                  # all vocab files, missing only
 *   node scripts/gen-examples.cjs --force          # regenerate every item
 *   node scripts/gen-examples.cjs --file n5_vocab  # one file
 *   node scripts/gen-examples.cjs --limit 30       # cap items (smoke test)
 *   node scripts/gen-examples.cjs --batch 20       # items per LLM call (default 20)
 *   node scripts/gen-examples.cjs --model <id>     # override model
 */
const fs = require("fs");
const path = require("path");
const { MtkGateway } = require("./lib/mtk-gateway.cjs");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const flagVal = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const FORCE = hasFlag("--force");
const ONLY_FILE = flagVal("--file", null);
const LIMIT = parseInt(flagVal("--limit", "0"), 10);
const BATCH = parseInt(flagVal("--batch", "20"), 10);
const MODEL = flagVal("--model", "aws/anthropic.claude-opus-4-8");
const MAX_RETRY = 3;

const LEVEL_RULES = {
  N5: "N5。只用最基礎詞彙與文法（は／が／を／に／で 等基本助詞、です・ます、基本動詞變化）。句子要極簡短、極日常。",
  N4: "N4（含 N5）。可用 て形連接、普通形、意向形、可能形、たら／ば／と／なら 等。仍以日常口語為主。",
  N3: "N3（含 N4、N5）。可用敬語、使役受身、較進階的接續詞，但仍須是日常會話會出現的句子。",
};

/** Infer JLPT level from filename (n5_vocab.json → N5). */
function levelFromFile(fileName) {
  const m = fileName.match(/n([345])/i);
  return m ? `N${m[1]}` : "N4";
}

function buildPrompt(level, items) {
  const list = items.map((it) => ({
    id: it.id,
    word: it.japanese,
    reading: it.hiragana,
    meaning: it.simple_chinese,
  }));
  return `你是專業日語教材編輯，母語等級。請為每個目標單字寫「日本人在日常生活中真的會說、會用」的自然例句，並附繁體中文翻譯。

【等級規範】${LEVEL_RULES[level]}

【嚴格規則】
1. 例句要自然、日常、像真人會講的話。嚴禁為了塞單字而硬湊的不自然句子或教科書腔。情境要具體（生活、工作、購物、家庭、天氣、心情等）。
2. 每個單字只給「一句」。去掉標注符號後的純日文長度 ≤ 20 字，並以「。」「？」「！」其中之一結尾。
3. 例句必須包含目標單字（可用其自然活用形），並用【】把目標單字本體包起來。例：食べる → 「ご{飯|はん}を【{食|た}べる】。」
4. 句中每個含漢字的詞，用 {漢字|讀音} 標注其平假名讀音；純假名的詞不要標注。讀音必須正確。
5. chinese 欄位：該句的繁體中文翻譯（自然、通順）。
6. 用字與文法不可超過該等級範圍。

【輸出格式】只輸出一個 JSON 陣列，每個元素為 {"id": "...", "sentence": "...", "chinese": "..."}。不要輸出任何解釋、不要 markdown 程式碼框、不要多餘文字。

【目標單字】
${JSON.stringify(list, null, 0)}`;
}

/** Pull a JSON array out of a model response that may be fenced or chatty. */
function parseJsonArray(text) {
  let t = text.trim();
  // strip ```json ... ``` fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // else slice from first [ to last ]
  if (t[0] !== "[") {
    const s = t.indexOf("[");
    const e = t.lastIndexOf("]");
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
  }
  return JSON.parse(t);
}

/** Validate one generated example against the hard rules; returns error or null. */
function checkExample(sentence) {
  if (typeof sentence !== "string" || !sentence.trim()) return "empty";
  // markup balance
  if ((sentence.match(/【/g) || []).length !== (sentence.match(/】/g) || []).length) return "【】 unbalanced";
  if ((sentence.match(/\{/g) || []).length !== (sentence.match(/\}/g) || []).length) return "{} unbalanced";
  for (const g of sentence.match(/\{[^{}]*\}/g) || []) {
    if ((g.match(/\|/g) || []).length !== 1) return `furigana ${g}`;
  }
  const core = sentence.replace(/\{([^|{}]+)\|[^}]+\}/g, "$1").replace(/[【】]/g, "").trim();
  if (core.length > 20) return `too long (${core.length})`;
  if (!/[。？！]$/.test(core)) return "bad ending";
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateBatch(gw, level, items) {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const content = await gw.chat({
        model: MODEL,
        messages: [{ role: "user", content: buildPrompt(level, items) }],
        maxTokens: Math.min(400 * items.length + 500, 16000),
      });
      const arr = parseJsonArray(content);
      const byId = new Map(arr.map((e) => [e.id, e]));
      const result = new Map();
      for (const it of items) {
        const e = byId.get(it.id);
        if (!e) continue;
        const err = checkExample(e.sentence);
        if (err) continue; // leave for a retry / later pass
        if (typeof e.chinese !== "string" || !e.chinese.trim()) continue;
        result.set(it.id, { sentence: e.sentence.trim(), chinese: e.chinese.trim() });
      }
      return result;
    } catch (err) {
      console.warn(`    batch attempt ${attempt}/${MAX_RETRY} failed: ${err.message}`);
      if (attempt < MAX_RETRY) await sleep(1500 * attempt);
    }
  }
  return new Map();
}

async function processFile(gw, fileName) {
  const filePath = path.join(dataDir, fileName);
  const dataset = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const level = levelFromFile(fileName);
  if (!Array.isArray(dataset.data)) return;

  // Which items need work?
  let todo = dataset.data.filter((it) => {
    if (!("hiragana" in it)) return false; // vocab only
    if (FORCE) return true;
    const ex = it.examples?.[0];
    return !ex || !ex.chinese || !ex.chinese.trim();
  });
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  console.log(`[${fileName}] ${level} — ${todo.length} item(s) to generate (batch ${BATCH})`);
  if (todo.length === 0) return;

  let done = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const res = await generateBatch(gw, level, batch);
    for (const it of batch) {
      const gen = res.get(it.id);
      if (gen) {
        it.examples = [gen];
        done++;
      } else {
        failed++;
      }
    }
    // Persist after each batch for crash safety.
    fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2) + "\n", "utf8");
    process.stdout.write(`  progress ${Math.min(i + BATCH, todo.length)}/${todo.length} (ok ${done}, miss ${failed})\r`);
  }
  console.log(`\n[${fileName}] done — generated ${done}, still missing ${failed}.`);
}

async function main() {
  const gw = new MtkGateway();
  if (!gw.isConfigured()) {
    console.error("[gen-examples] gateway not configured (need MAMBA_API_KEY + MAMBA_USER_ID).");
    process.exit(1);
  }
  console.log(`[gen-examples] model=${MODEL} user=${gw.cfg.userId}`);

  let files = fs.readdirSync(dataDir).filter((f) => f.endsWith("_vocab.json"));
  if (ONLY_FILE) {
    const want = ONLY_FILE.endsWith(".json") ? ONLY_FILE : `${ONLY_FILE}.json`;
    files = files.filter((f) => f === want);
  }
  for (const f of files) {
    await processFile(gw, f);
  }
  console.log("[gen-examples] all files processed. Run `npm run validate:examples -- --strict` to verify.");
}

main().catch((err) => {
  console.error("[gen-examples] fatal:", err);
  process.exit(1);
});
