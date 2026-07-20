// ur-storybook · 最小可行鏈路（feasibility spike）
// 一句描述 → 一頁大綱（文字模型） → 一張插圖（影像模型）
//
// 零相依：只用 Node 18+ 原生 fetch，不需 npm install，可直接在 GDrive 資料夾跑。
// 用法：
//   node spike/generate.mjs "一隻愛冒險的小鯨魚在深海遇見會發光的水母"
//   （沒給參數就用預設句子）
//
// 設定讀自專案根目錄 .env（見 .env.example）。金鑰只放 .env，永不進 repo。

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 極簡 .env 載入（不引 dotenv）───────────────────────────────
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

// ── Gemini generateContent 呼叫（相容 Google / 代理商上游）──────
async function generateContent(model, body) {
  const base = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const useBearer = process.env.GEMINI_USE_BEARER === 'true';
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) throw new Error('缺少 GEMINI_API_KEY——請在 .env 填入你的金鑰（見 .env.example）。');

  const url = `${base}/v1beta/models/${model}:generateContent`;
  const headers = { 'Content-Type': 'application/json' };
  if (useBearer) headers['Authorization'] = `Bearer ${key}`;
  else headers['X-Goog-Api-Key'] = key;

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (!res.ok) {
    const msg = data?.error?.message || raw.slice(0, 300);
    throw new Error(`[${model}] HTTP ${res.status}: ${msg}`);
  }
  return data;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text).filter(Boolean).join('\n').trim();
}

function extractInlineImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data;
    if (inline?.data) return { mime: inline.mimeType || inline.mime_type || 'image/png', b64: inline.data };
  }
  return null;
}

// 從雜訊文字裡挖出「第一個完整、括號平衡的 JSON 物件」
// （本代理商的 gemini-3.5-flash 會在合法 JSON 後面附加 ``` 或重複物件，
//  所以不能用 lastIndexOf('}')——要抓第一個平衡的物件。）
function parseJsonLoose(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('文字模型回傳中找不到 JSON。原始回傳：\n' + text.slice(0, 400));
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('找不到括號平衡的 JSON 物件。原始回傳：\n' + text.slice(0, 400));
}

// ── 主流程 ────────────────────────────────────────────────────
async function main() {
  await loadEnv();

  const idea = process.argv.slice(2).join(' ').trim()
    || '一隻愛冒險的小鯨魚在深海遇見會發光的水母';

  const TEXT_MODEL = process.env.TEXT_MODEL || 'gemini-3.1-pro-preview';
  const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview';

  console.log('🐳 ur-storybook 最小鏈路');
  console.log('   上游  :', process.env.GEMINI_BASE_URL || 'Google 官方');
  console.log('   文字  :', TEXT_MODEL);
  console.log('   影像  :', IMAGE_MODEL);
  console.log('   點子  :', idea);
  console.log('');

  // ── 步驟 1+2：一句描述 → 一頁大綱 ───────────────────────────
  console.log('① 生成一頁大綱（文字模型）…');
  const outlinePrompt = `你是兒童繪本作者。根據這個點子：「${idea}」，
設計「一本繪本的第一頁」。只回傳 JSON，格式如下（不要多餘文字）：
{
  "title": "繪本標題",
  "character": "主角外觀的簡短描述（給畫師看的，含顏色、特徵）",
  "page_text": "這一頁給小朋友讀的故事文字（1-2 句、溫暖易懂）",
  "illustration_prompt": "這一頁插圖的英文描述（給影像模型，含場景、角色、畫風：children's storybook illustration, soft colors）"
}`;

  const textData = await generateContent(TEXT_MODEL, {
    contents: [{ role: 'user', parts: [{ text: outlinePrompt }] }],
    generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
  });
  const rawText = extractText(textData);
  const page = parseJsonLoose(rawText);

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
  console.log('② 生成一張插圖（影像模型）…');
  try {
    const imgData = await generateContent(IMAGE_MODEL, {
      contents: [{ role: 'user', parts: [{ text: page.illustration_prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });
    const img = extractInlineImage(imgData);
    if (!img) {
      console.log('   ⚠️ 影像模型有回應，但回傳裡沒有圖片資料。原始回傳片段：');
      console.log('   ', JSON.stringify(imgData).slice(0, 400));
    } else {
      const ext = img.mime.includes('jpeg') ? 'jpg' : 'png';
      const imgPath = path.join(outDir, `page-${stamp}.${ext}`);
      await writeFile(imgPath, Buffer.from(img.b64, 'base64'));
      console.log('   ✅ 插圖已存：', path.relative(ROOT, imgPath));
    }
  } catch (e) {
    console.log('   ❌ 插圖生成失敗：', e.message);
    if (/pricing/i.test(e.message)) {
      console.log('   → 這正是已知卡點：代理商沒替影像模型設定計費（"No pricing info"）。');
      console.log('     文字鏈路已驗證可行；影像需換官方付費金鑰或請代理商開通。');
    }
  }

  console.log('');
  console.log('🎉 最小鏈路跑完，產物在 generated/');
}

main().catch(err => { console.error('\n💥 失敗：', err.message); process.exit(1); });
