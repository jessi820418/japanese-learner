"use strict";
/**
 * Minimal client for MediaTek's internal GAISF / MAMBA AI gateway.
 *
 * The gateway is OpenAI/Azure-compatible and serves both LLM chat and TTS
 * audio. It uses a self-signed cert (so TLS verification is disabled) and
 * authenticates with a shared service JWT plus an `x-user-id` header.
 *
 * Credentials are read from the environment, falling back to the patent-drafting
 * app's `.env` if present (so this works on a dev box without re-exporting):
 *   MAMBA_API_KEY   — bearer service token (JWT)
 *   MAMBA_USER_ID   — mtkid for per-user quota attribution
 *   MAMBA_BASE_URL  — default https://mlop-azure-gateway.mediatek.inc
 *
 * Verified routes (see memory: mtk-gaisf-gateway):
 *   chat  POST /v1/chat/completions                 model e.g. aws/anthropic.claude-opus-4-8
 *   tts   POST /openai/deployments/<dep>/audio/speech?api-version=<ver>
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_BASE = "https://mlop-azure-gateway.mediatek.inc";
const FALLBACK_ENV = path.join(
  "D:/AI_server/patent_claude/AI4SEP/patent-drafting-app/backend/.env",
);

/** Parse a dotenv file into a plain object (best effort; ignores comments). */
function parseDotenv(file) {
  const out = {};
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith("#")) out[m[1]] = m[2];
    }
  } catch {
    /* no file */
  }
  return out;
}

function resolveConfig() {
  const fileEnv = (!process.env.MAMBA_API_KEY && fs.existsSync(FALLBACK_ENV))
    ? parseDotenv(FALLBACK_ENV)
    : {};
  const apiKey = process.env.MAMBA_API_KEY || fileEnv.MAMBA_API_KEY || "";
  const userId = process.env.MAMBA_USER_ID || fileEnv.MAMBA_USER_ID || "";
  const baseUrl = process.env.MAMBA_BASE_URL || fileEnv.MAMBA_BASE_URL || DEFAULT_BASE;
  return { apiKey, userId, baseUrl };
}

const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 8 });

/** Low-level request returning { status, buffer, headers }. */
function request(method, fullUrl, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(fullUrl);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        agent,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, buffer: Buffer.concat(chunks), headers: res.headers }),
        );
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

class MtkGateway {
  constructor(cfg) {
    this.cfg = cfg || resolveConfig();
  }

  isConfigured() {
    return Boolean(this.cfg.apiKey && this.cfg.userId);
  }

  authHeaders(extra) {
    return {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      "x-user-id": this.cfg.userId,
      ...extra,
    };
  }

  /**
   * Chat completion. Returns the assistant message string.
   * @param {object} opts { model, messages, maxTokens, temperature, timeoutMs }
   */
  async chat(opts) {
    const body = JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    });
    const res = await request(
      "POST",
      `${this.cfg.baseUrl}/v1/chat/completions`,
      this.authHeaders({ "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }),
      body,
    );
    const text = res.buffer.toString("utf8");
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`gateway chat ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = JSON.parse(text);
    return json.choices?.[0]?.message?.content ?? "";
  }

  /**
   * Text-to-speech. Returns an mp3 Buffer.
   * @param {object} opts { text, model, voice, deployment, apiVersion, timeoutMs }
   */
  async tts(opts) {
    const deployment = opts.deployment || opts.model || "gpt-4o-mini-tts";
    const apiVersion = opts.apiVersion || "2025-03-01-preview";
    const body = JSON.stringify({
      model: deployment,
      input: opts.text,
      voice: opts.voice || "nova",
      response_format: "mp3",
    });
    const res = await request(
      "POST",
      `${this.cfg.baseUrl}/openai/deployments/${deployment}/audio/speech?api-version=${apiVersion}`,
      this.authHeaders({ "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }),
      body,
    );
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`gateway tts ${res.status}: ${res.buffer.toString("utf8").slice(0, 300)}`);
    }
    return res.buffer;
  }
}

module.exports = { MtkGateway, resolveConfig };
