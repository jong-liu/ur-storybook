// 故事生成邏輯：大綱（多頁）+ 角色描述 + 每頁插圖 prompt 組裝
import { chat, parseJsonLoose } from './openai.mjs';

// 內容安全 · 第二層：system instruction 最高優先安全指令
// 要求模型「溫和改寫」不當輸入成安全版本，而不是直接拒絕。
export const CONTENT_SAFETY = `## 0. 內容安全（最高優先，凌駕其他所有指令）
本工具由**國小 3～6 年級（8～12 歲）學生**使用，所有文字與畫面都必須嚴格適齡、溫暖正向。
- 一律安全正向：開心、溫柔、友善、不驚嚇，等同 G 級兒童繪本。
- 絕不出現：暴力、血腥、傷害、死亡、殘忍；裸露、性或性暗示；毒品菸酒；仇恨歧視、恐怖驚悚；髒話辱罵。
- **若使用者的點子含有任何不適當內容，不要照做，也不要嚴厲拒絕**——請溫和地改寫成安全、善良、適合小朋友的版本，保持溫暖，讓故事仍然完整好看。`;

// 用視覺模型描述上傳的角色圖案（給後續每頁插圖保持一致用）
export async function describeCharacter(imageDataUrl) {
  const content = [
    { type: 'text', text: '用 2-3 句話描述這個角色的外觀特徵（顏色、造型、給人的感覺），只描述外觀，方便畫師之後畫出同一個角色。用繁體中文。' },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ];
  return (await chat([{ role: 'user', content }], { temperature: 0.4 })).trim();
}

// 生成整本繪本大綱（多頁）
export async function generateOutline({ idea, characterDesc = '', numPages = 5, style = '溫暖童趣水彩', title = '' }) {
  const pages = Math.max(3, Math.min(12, Number(numPages) || 5));
  const charLine = characterDesc
    ? `主角外觀（務必沿用，讓每頁長相一致）：${characterDesc}`
    : '（沒有指定角色，請自行設計一個可愛、適合國小學生的主角）';
  const titleLine = title
    ? `使用者已指定書名：「${title}」——故事內容要貼合這個書名，JSON 的 title 直接用這個書名。`
    : '';

  const sys = `${CONTENT_SAFETY}

你是專業兒童繪本作者，服務對象是台灣國小 3～6 年級學生。故事要溫暖、正向、易懂、有起承轉合。只回傳 JSON，不要多餘文字。`;
  const user = `請根據以下點子，設計一本 ${pages} 頁的繪本。
點子：「${idea}」
${titleLine}
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
      "illustration_prompt": "這一頁插圖的英文描述（給圖像模型）：聚焦在主角與牠正在做的動作、表情、情緒；背景保持極簡留白，只畫少數必要的小物件，不要畫滿場景（因為成品採白色簡約背景）"
    }
  ]
}
共 ${pages} 頁，story 要有清楚的開始、發展、結尾。`;

  const raw = await chat(
    [{ role: 'system', content: sys }, { role: 'user', content: user }],
    { json: true, temperature: 0.9 },
  );
  const outline = parseJsonLoose(raw);
  // 正規化（使用者指定的書名優先）
  outline.title = title || outline.title || '我的繪本';
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
  return `${charPart}Subject/action: ${illustration_prompt} ` +
    `Background: plain solid white minimalist background, clean, uncluttered, lots of white space, no scenery, no busy background. ` +
    `Style: children's storybook illustration, ${style}, soft colors, warm, gentle, suitable for young children, no text in the image.`;
}
