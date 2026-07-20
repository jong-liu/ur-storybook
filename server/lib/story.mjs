// 故事生成邏輯：大綱（多頁）+ 角色描述 + 每頁插圖 prompt 組裝
import { chat, parseJsonLoose } from './openai.mjs';

// 用視覺模型描述上傳的角色圖案（給後續每頁插圖保持一致用）
export async function describeCharacter(imageDataUrl) {
  const content = [
    { type: 'text', text: '用 2-3 句話描述這個角色的外觀特徵（顏色、造型、給人的感覺），只描述外觀，方便畫師之後畫出同一個角色。用繁體中文。' },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ];
  return (await chat([{ role: 'user', content }], { temperature: 0.4 })).trim();
}

// 生成整本繪本大綱（多頁）
export async function generateOutline({ idea, characterDesc = '', numPages = 5, style = '溫暖童趣水彩' }) {
  const pages = Math.max(3, Math.min(12, Number(numPages) || 5));
  const charLine = characterDesc
    ? `主角外觀（務必沿用，讓每頁長相一致）：${characterDesc}`
    : '（沒有指定角色，請自行設計一個可愛、適合國小學生的主角）';

  const sys = '你是專業兒童繪本作者，服務對象是台灣國小 3～6 年級學生。故事要溫暖、正向、易懂、有起承轉合。只回傳 JSON，不要多餘文字。';
  const user = `請根據以下點子，設計一本 ${pages} 頁的繪本。
點子：「${idea}」
${charLine}
畫風：${style}

回傳 JSON（json），格式如下：
{
  "title": "繪本標題（繁體中文，吸引小朋友）",
  "character": "主角外觀的完整描述（繁體中文，含顏色/造型/特徵，之後每頁插圖都會沿用這段來保持角色一致）",
  "pages": [
    {
      "page": 1,
      "text": "這一頁給小朋友讀的故事文字（繁體中文，1-3 句，用字簡單溫暖）",
      "illustration_prompt": "這一頁插圖的英文描述（給圖像模型：具體場景+動作+情緒，結尾固定加 children's storybook illustration, ${style}, soft colors, warm, for kids）"
    }
  ]
}
共 ${pages} 頁，story 要有清楚的開始、發展、結尾。`;

  const raw = await chat(
    [{ role: 'system', content: sys }, { role: 'user', content: user }],
    { json: true, temperature: 0.9 },
  );
  const outline = parseJsonLoose(raw);
  // 正規化
  outline.title = outline.title || '我的繪本';
  outline.character = outline.character || characterDesc || '';
  outline.pages = (outline.pages || []).map((p, i) => ({
    page: p.page || i + 1,
    text: p.text || '',
    illustration_prompt: p.illustration_prompt || p.text || '',
  }));
  return outline;
}

// 組裝單頁最終插圖 prompt：把角色描述綁進去 → 跨頁一致性
export function buildImagePrompt({ illustration_prompt, character, style = '溫暖童趣水彩' }) {
  const charPart = character ? `Main character (keep identical on every page): ${character}. ` : '';
  return `${charPart}Scene: ${illustration_prompt} Style: children's storybook illustration, ${style}, soft colors, warm, gentle, suitable for young children, no text in the image.`;
}
