// ur-storybook · 最小可行鏈路（OpenAI 版）
// 一句描述 →（Chat 模型）一頁大綱 →（圖像模型）一張插圖
//
// 零相依：只用 Node 18+ 原生 fetch。設定讀自專案根目錄 .env。
// 用法：
//   node spike/generate-openai.mjs "一隻愛冒險的小鯨魚在深海遇見會發光的水母"
//
// OpenAI API 形狀與 Gemini 不同：
//   Chat  : POST {base}/chat/completions   { model, messages }
//   Image : POST {base}/images/generations { model, prompt, size }
// 官方 base = https://api.openai.com/v1；myai168 相容端點 = https://www.myai168.com/nthu/api/openai/v1
// 兩者都用 Authorization: Bearer <key>。

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function cfg() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('缺少 OPENAI_API_KEY——請在 .env 填入你的 OpenAI 金鑰（見 .env.example）。');
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return { key, base };
}

async function openai(pathname, body) {
  const { key, base } = cfg();
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch { data = null; }
  if (!res.ok) {
    const msg = data?.error?.message || raw.slice(0, 300);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return data;
}

function parseJsonLoose(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('Chat 回傳中找不到 JSON。原始回傳：\n' + text.slice(0, 400));
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('找不到括號平衡的 JSON。原始回傳：\n' + text.slice(0, 400));
}

async function main() {
  await loadEnv();

  const idea = process.argv.slice(2).join(' ').trim()
    || '一隻愛冒險的小鯨魚在深海遇見會發光的水母';

  const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';
  const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
  const { base, key } = cfg();

  console.log('🐳 ur-storybook 最小鏈路（OpenAI）');
  console.log('   端點  :', base);
  console.log('   Chat  :', CHAT_MODEL);
  console.log('   Image :', IMAGE_MODEL, `(${IMAGE_SIZE})`);
  console.log('   金鑰  :', key.startsWith('sk-') ? 'sk-…（OpenAI 官方格式）' : '非 sk- 開頭（可能是代理商金鑰，記得對應 OPENAI_BASE_URL）');
  console.log('   點子  :', idea);
  console.log('');

  // ── 步驟 1+2：一句描述 → 一頁大綱 ───────────────────────────
  console.log('① 生成一頁大綱（Chat 模型）…');
  const sys = '你是兒童繪本作者。只回傳 JSON，不要多餘文字。';
  const user = `根據點子：「${idea}」，設計「一本繪本的第一頁」。回傳 JSON（json）：
{
  "title": "繪本標題",
  "character": "主角外觀的簡短描述（給畫師，含顏色、特徵）",
  "page_text": "這一頁給小朋友讀的故事文字（1-2 句、溫暖易懂）",
  "illustration_prompt": "這一頁插圖的英文描述（含場景、角色、畫風：children's storybook illustration, soft colors）"
}`;

  const chat = await openai('/chat/completions', {
    model: CHAT_MODEL,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    temperature: 0.9,
    response_format: { type: 'json_object' },
  });
  const content = chat?.choices?.[0]?.message?.content || '';
  const page = parseJsonLoose(content);

  console.log('   ✅ 標題 :', page.title);
  console.log('   ✅ 角色 :', page.character);
  console.log('   ✅ 頁文 :', page.page_text);
  console.log('   ✅ 插圖prompt :', page.illustration_prompt);
  console.log('');

  const outDir = path.join(ROOT, 'generated');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-'); // 避免檔名含 ':'
  await writeFile(path.join(outDir, `page-${stamp}.json`), JSON.stringify(page, null, 2), 'utf8');

  // ── 步驟 3：插圖 prompt → 一張插圖 ─────────────────────────
  console.log('② 生成一張插圖（圖像模型）…');
  try {
    const body = { model: IMAGE_MODEL, prompt: page.illustration_prompt, size: IMAGE_SIZE, n: 1 };
    // dall-e-* 才吃 response_format；gpt-image-1 一律回 b64_json，不要送這個參數。
    if (/^dall-e/i.test(IMAGE_MODEL)) body.response_format = 'b64_json';

    const img = await openai('/images/generations', body);
    const item = img?.data?.[0];
    let buf = null, ext = 'png';
    if (item?.b64_json) {
      buf = Buffer.from(item.b64_json, 'base64');
    } else if (item?.url) {
      const r = await fetch(item.url);
      buf = Buffer.from(await r.arrayBuffer());
      if (/\.jpe?g/i.test(item.url)) ext = 'jpg';
    }
    if (!buf) {
      console.log('   ⚠️ 圖像 API 有回應，但沒有圖片資料。回傳片段：', JSON.stringify(img).slice(0, 300));
    } else {
      const imgPath = path.join(outDir, `page-${stamp}.${ext}`);
      await writeFile(imgPath, buf);
      console.log('   ✅ 插圖已存：', path.relative(ROOT, imgPath), `(${(buf.length / 1024).toFixed(0)} KB)`);
    }
  } catch (e) {
    console.log('   ❌ 插圖生成失敗：', e.message);
    if (/verif|organization|access/i.test(e.message)) {
      console.log('   → OpenAI 影像模型（gpt-image-1）可能需要組織驗證；可改用 OPENAI_IMAGE_MODEL=dall-e-3 再試。');
    }
  }

  console.log('');
  console.log('🎉 最小鏈路跑完，產物在 generated/');
}

main().catch(err => { console.error('\n💥 失敗：', err.message); process.exit(1); });
