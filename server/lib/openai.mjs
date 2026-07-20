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

// 文字生圖：/images/generations
export async function generateImage(prompt) {
  const { key, base } = cfg();
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: IMAGE_MODEL(), prompt, size: IMAGE_SIZE(), n: 1 }),
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
