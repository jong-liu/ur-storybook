// OpenAI 呼叫封裝（零相依：Node 18+ 原生 fetch / FormData / Blob）
// 金鑰只在後端使用，前端永遠拿不到。

function cfg() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('缺少 OPENAI_API_KEY（請在 .env 設定）');
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return { key, base };
}

export const CHAT_MODEL = () => process.env.OPENAI_CHAT_MODEL || 'gpt-4o';
export const IMAGE_MODEL = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
export const IMAGE_SIZE = () => process.env.OPENAI_IMAGE_SIZE || '1024x1024';
// gpt-image-1 品質：low（最快最便宜）/ medium / high / auto。給學生用預設 low 求速度。
export const IMAGE_QUALITY = () => process.env.OPENAI_IMAGE_QUALITY || 'low';

// 從雜訊文字挖出第一個括號平衡的 JSON 物件（防模型在合法 JSON 後附加垃圾）
export function parseJsonLoose(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('回傳中找不到 JSON：\n' + text.slice(0, 300));
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('找不到括號平衡的 JSON：\n' + text.slice(0, 300));
}

// 內容安全 · 第三層：OpenAI Moderation API（免費，等同 Gemini safetySettings）
// 對兒童情境採嚴格門檻——任何 flagged 類別即擋。回傳 { flagged, categories:[] }。
export async function moderate(text) {
  if (!text || !text.trim()) return { flagged: false, categories: [] };
  const { key, base } = cfg();
  try {
    const res = await fetch(`${base}/moderations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!res.ok) throw new Error(`moderation HTTP ${res.status}`);
    const data = await res.json();
    const r = data?.results?.[0];
    const categories = r?.categories ? Object.keys(r.categories).filter((k) => r.categories[k]) : [];
    return { flagged: !!r?.flagged, categories };
  } catch (e) {
    // Moderation 失敗不應讓整個 app 掛掉——記錄後放行（前端關鍵字 + system 指令仍是防線）
    console.error('moderate error (fail-open):', e.message);
    return { flagged: false, categories: [], error: e.message };
  }
}

// 對話 / 視覺：messages 走 OpenAI chat/completions；要 JSON 就開 json_object
export async function chat(messages, { json = false, temperature = 0.8 } = {}) {
  const { key, base } = cfg();
  const body = { model: CHAT_MODEL(), messages, temperature };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch { data = null; }
  if (!res.ok) throw new Error(`chat HTTP ${res.status}: ${data?.error?.message || raw.slice(0, 200)}`);
  return data?.choices?.[0]?.message?.content || '';
}

// dataURL → { buffer, mime }
function dataUrlToBuffer(dataUrl) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return null;
  return { buffer: Buffer.from(m[2], 'base64'), mime: m[1] };
}

// 文字生圖：/images/generations（可用 quality 覆寫預設品質）
export async function generateImage(prompt, { quality } = {}) {
  const { key, base } = cfg();
  const body = { model: IMAGE_MODEL(), prompt, size: IMAGE_SIZE(), n: 1 };
  if (/^gpt-image/i.test(IMAGE_MODEL())) body.quality = quality || IMAGE_QUALITY();
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch { data = null; }
  if (!res.ok) throw new Error(`image HTTP ${res.status}: ${data?.error?.message || raw.slice(0, 200)}`);
  return data?.data?.[0]?.b64_json || null;
}

// 參考圖生圖（角色一致性）：/images/edits，用 FormData 帶入參考圖
export async function editImage(prompt, refDataUrls = []) {
  const { key, base } = cfg();
  const refs = refDataUrls.map(dataUrlToBuffer).filter(Boolean);
  if (refs.length === 0) return generateImage(prompt); // 沒參考圖就退回純生成

  const form = new FormData();
  form.append('model', IMAGE_MODEL());
  form.append('prompt', prompt);
  form.append('size', IMAGE_SIZE());
  form.append('n', '1');
  if (/^gpt-image/i.test(IMAGE_MODEL())) form.append('quality', IMAGE_QUALITY());
  refs.forEach((r, i) => {
    const ext = r.mime.split('/')[1] || 'png';
    form.append('image[]', new Blob([r.buffer], { type: r.mime }), `ref-${i}.${ext}`);
  });

  const res = await fetch(`${base}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` }, // 不要手動設 Content-Type，讓 fetch 帶 boundary
    body: form,
  });
  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch { data = null; }
  if (!res.ok) throw new Error(`edit HTTP ${res.status}: ${data?.error?.message || raw.slice(0, 200)}`);
  return data?.data?.[0]?.b64_json || null;
}
