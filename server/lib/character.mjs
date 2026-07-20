// 角色圖案生成：把使用者的角色描述，套上固定的「日系插畫風」風格，組出生圖 prompt。

// 固定風格（使用者指定）：日系插畫、特徵鮮明、情緒自然、動態姿態、服裝精緻、
// 手繪塗鴉、潑墨筆觸、隨性線條、粉彩與墨色混合、漫畫草稿質感、白色簡約背景、
// 氛圍感強、高細節、高品質。
export const CHARACTER_STYLE =
  'Japanese illustration / anime-manga art style. Bold, distinctive character features. ' +
  'Natural, genuine emotional facial expression. Dynamic, expressive pose. ' +
  'Refined, finely detailed clothing. Hand-drawn doodle feel, ink-splash sumi-e brushstrokes, ' +
  'loose casual linework, a blend of soft pastel colors with black ink tones, rough manga-draft sketch texture. ' +
  'Strong evocative atmosphere. Plain solid white minimalist background with lots of white space. ' +
  'Highly detailed, high quality character design.';

// 給前端顯示用的中文風格標籤
export const CHARACTER_STYLE_TAGS = [
  '日系插畫風', '角色特徵鮮明', '情緒自然表情', '動態姿態', '服裝細節精緻',
  '手繪塗鴉風', '潑墨筆觸', '隨性線條', '粉彩與墨色混合', '漫畫草稿質感',
  '白色簡約背景', '氛圍感強', '高細節', '高品質',
];

export function buildCharacterPrompt({ name = '', features = '', mood = '', pose = '', clothing = '' }) {
  const parts = [
    name && `Character: ${name}`,
    features && `Appearance / features: ${features}`,
    mood && `Expression / mood: ${mood}`,
    pose && `Pose / action: ${pose}`,
    clothing && `Clothing / outfit: ${clothing}`,
  ].filter(Boolean).join('. ');

  return `Single full-body character design illustration of one character. ${parts}. ` +
    `${CHARACTER_STYLE} No text, no letters, no watermark, no signature.`;
}
