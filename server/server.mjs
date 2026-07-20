// ur-storybook 後端（零相依：只用 Node 內建 http/fs）
// 職責：(1) 提供 public/ 靜態前端  (2) 代理 OpenAI 生成請求（金鑰只在後端）
// 啟動：node server/server.mjs   （可直接在 GDrive 跑，不需 npm install）

import http from 'node:http';
import { promises as fsPromises, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage, editImage, moderate } from './lib/openai.mjs';
import { describeCharacter, generateOutline, buildImagePrompt } from './lib/story.mjs';
import { buildCharacterPrompt, CHARACTER_STYLE_TAGS } from './lib/character.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const { readFile, stat } = fsPromises;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://jong-liu.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// ── 極簡 .env 載入 ──────────────────────────────────────────
async function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of (await readFile(p, 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function getAllowedOrigins() {
  const raw = process.env.CORS_ALLOW_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(',');
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  const allowed = getAllowedOrigins();
  if (!allowed.has(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Password');
  if (req.headers['access-control-request-private-network'] === 'true') {
    // Allow browser preflight from HTTPS pages to localhost backend.
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function requireApiPassword(req, res, url) {
  const expected = (process.env.APP_PASSWORD || '').trim();
  if (!expected) return true;
  if (url === '/api/health') return true;

  const got = String(req.headers['x-app-password'] || '').trim();
  if (got === expected) return true;

  sendJSON(res, 401, { error: '需要課堂密碼才能使用這個服務', auth: true });
  return false;
}

function sendJSON(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length });
  res.end(b);
}

async function readBody(req, limitBytes = 30 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limitBytes) throw new Error('請求內容過大');
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error('not file');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    applyCors(req, res);

    if (req.method === 'OPTIONS' && url.startsWith('/api/')) {
      res.writeHead(204);
      return res.end();
    }

    if (url.startsWith('/api/') && !requireApiPassword(req, res, url)) {
      return;
    }

    // ── API：生成大綱 ─────────────────────────────────────
    if (req.method === 'POST' && url === '/api/outline') {
      const { idea = '', title = '', characterImage = '', numPages = 5, style } = await readBody(req);
      if (!idea.trim() && !characterImage) return sendJSON(res, 400, { error: '請提供故事描述或角色圖片' });
      // 內容安全 · 第三層（後端防線，擋掉繞過前端的請求）：書名 + 點子一起驗
      const toModerate = `${title} ${idea}`.trim();
      if (toModerate) {
        const mod = await moderate(toModerate);
        if (mod.flagged) {
          return sendJSON(res, 400, { error: '這個內容不太適合放進兒童繪本 😊 換個更溫暖、友善的說法再試一次吧！', safety: true });
        }
      }
      let characterDesc = '';
      if (characterImage) {
        try { characterDesc = await describeCharacter(characterImage); } catch (e) { console.error('describeCharacter:', e.message); }
      }
      const seed = idea.trim() || `一個以這個角色為主角的溫暖小故事：${characterDesc}`;
      const outline = await generateOutline({ idea: seed, characterDesc, numPages, style, title });
      return sendJSON(res, 200, outline);
    }

    // ── API：生成單頁插圖 ─────────────────────────────────
    if (req.method === 'POST' && url === '/api/image') {
      const { illustration_prompt = '', character = '', style, characterImage = '' } = await readBody(req);
      if (!illustration_prompt.trim()) return sendJSON(res, 400, { error: '缺少插圖描述' });
      const prompt = buildImagePrompt({ illustration_prompt, character, style });
      const b64 = characterImage
        ? await editImage(prompt, [characterImage])
        : await generateImage(prompt);
      if (!b64) return sendJSON(res, 502, { error: '圖像模型沒有回傳圖片' });
      return sendJSON(res, 200, { image: `data:image/png;base64,${b64}` });
    }

    // ── API：生成角色圖案（固定日系插畫風，高品質）──────────
    if (req.method === 'POST' && url === '/api/character') {
      const { name = '', features = '', mood = '', pose = '', clothing = '' } = await readBody(req);
      const combined = [name, features, mood, pose, clothing].join(' ').trim();
      if (!combined) return sendJSON(res, 400, { error: '請描述你想要的角色' });
      const mod = await moderate(combined);
      if (mod.flagged) return sendJSON(res, 400, { error: '這個角色描述不太適合 😊 換個更溫暖、友善的說法再試一次吧！', safety: true });
      const prompt = buildCharacterPrompt({ name, features, mood, pose, clothing });
      const b64 = await generateImage(prompt, { quality: process.env.OPENAI_CHARACTER_QUALITY || 'high' });
      if (!b64) return sendJSON(res, 502, { error: '沒有生成出角色圖片' });
      return sendJSON(res, 200, { image: `data:image/png;base64,${b64}` });
    }

    // ── 健康檢查 + 角色風格標籤 ───────────────────────────
    if (url === '/api/health') {
      return sendJSON(res, 200, {
        ok: true,
        hasKey: !!process.env.OPENAI_API_KEY,
        needsPassword: !!(process.env.APP_PASSWORD || '').trim(),
        characterStyleTags: CHARACTER_STYLE_TAGS,
      });
    }

    // ── 其餘走靜態檔 ─────────────────────────────────────
    return serveStatic(req, res);
  } catch (e) {
    console.error('API error:', e.message);
    return sendJSON(res, 500, { error: e.message });
  }
});

async function main() {
  await loadEnv();
  server.listen(PORT, () => {
    console.log(`\n📖 ur-storybook 後端啟動：http://localhost:${PORT}`);
    console.log(`   金鑰狀態：${process.env.OPENAI_API_KEY ? '✅ 已載入' : '❌ 未設定（請在 .env 填 OPENAI_API_KEY）'}`);
    console.log(`   API 密碼：${(process.env.APP_PASSWORD || '').trim() ? '✅ 已啟用' : '⚪ 未啟用'}`);
    console.log(`   靜態目錄：${PUBLIC}\n`);
  });
}

main().catch((e) => {
  console.error('啟動失敗：', e.message);
  process.exit(1);
});
