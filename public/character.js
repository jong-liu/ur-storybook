// 角色產生器前端邏輯（純 vanilla JS）
const $ = (id) => document.getElementById(id);
const FIELDS = ['cName', 'cFeatures', 'cMood', 'cPose', 'cClothing'];
let currentImage = null;
let currentName = '';

const API_BASE = resolveApiBase();
let API_PASSWORD = resolveApiPassword();

bootstrapApiAccess();

function resolveApiBase() {
  const q = new URLSearchParams(location.search).get('api');
  if (q) {
    const v = normalizeApiBase(q);
    try { localStorage.setItem('ur-storybook-api-base', v); } catch {}
    return v;
  }
  try {
    const saved = localStorage.getItem('ur-storybook-api-base');
    if (saved) return normalizeApiBase(saved);
  } catch {}
  return '';
}

function normalizeApiBase(v) {
  return String(v || '').trim().replace(/\/+$/, '');
}

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function resolveApiPassword() {
  const q = new URLSearchParams(location.search).get('pwd');
  if (q) {
    try { localStorage.setItem('ur-storybook-api-password', q); } catch {}
    return q;
  }
  try {
    return localStorage.getItem('ur-storybook-api-password') || '';
  } catch {
    return '';
  }
}

function buildApiHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_PASSWORD) headers['X-App-Password'] = API_PASSWORD;
  return headers;
}

async function bootstrapApiAccess() {
  if (!API_BASE) return;
  try {
    const res = await fetch(apiUrl('/api/health'));
    const data = await res.json();
    if (data.needsPassword && !API_PASSWORD) promptForApiPassword();
  } catch {}
}

function promptForApiPassword() {
  const input = window.prompt('請輸入課堂密碼（老師提供）');
  if (!input) return false;
  API_PASSWORD = input.trim();
  try { localStorage.setItem('ur-storybook-api-password', API_PASSWORD); } catch {}
  return true;
}

// 風格標籤（跟後端 CHARACTER_STYLE_TAGS 一致；載入時也會用 /api/health 覆寫確保同步）
const DEFAULT_TAGS = ['日系插畫風', '角色特徵鮮明', '情緒自然表情', '動態姿態', '服裝細節精緻',
  '手繪塗鴉風', '潑墨筆觸', '隨性線條', '粉彩與墨色混合', '漫畫草稿質感',
  '白色簡約背景', '氛圍感強', '高細節', '高品質'];

function renderChips(tags) {
  $('styleChips').innerHTML = tags.map((t) => `<span class="chip">${t}</span>`).join('');
}
renderChips(DEFAULT_TAGS);
fetch(apiUrl('/api/health'), { headers: API_PASSWORD ? { 'X-App-Password': API_PASSWORD } : undefined }).then((r) => r.json()).then((d) => {
  if (Array.isArray(d.characterStyleTags) && d.characterStyleTags.length) renderChips(d.characterStyleTags);
}).catch(() => {});

function getChar() {
  const g = (id) => $(id).value.trim();
  return { name: g('cName'), features: g('cFeatures'), mood: g('cMood'), pose: g('cPose'), clothing: g('cClothing') };
}
function combinedText() { return FIELDS.map((id) => $(id).value).join(' '); }

function setStatus(msg, show = true) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('hidden', !show);
}

// ── 內容安全：即時提醒 ───────────────────────────────────────
function liveSafetyCheck() {
  const r = window.ContentSafety.checkContentSafety(combinedText());
  const warn = $('ideaWarn');
  if (r.safe) { warn.classList.add('hidden'); warn.textContent = ''; }
  else { warn.textContent = '⚠️ ' + window.ContentSafety.safetyMessage(r); warn.classList.remove('hidden'); }
}
FIELDS.forEach((id) => $(id).addEventListener('input', liveSafetyCheck));

// ── 範例角色下拉選單（童話與歷史故事主角，適合小三～小六）────
const EXAMPLES = [
  { name: '小紅帽', features: '黑色短髮，明亮的大眼睛，白皙皮膚', mood: '開心又充滿好奇', pose: '手提籃子，輕快走在森林小路上', clothing: '紅色斗篷，簡單洋裝' },
  { name: '灰姑娘', features: '金色長髮，藍色眼睛，皮膚白皙', mood: '溫柔帶點期待', pose: '輕輕舉起裙擺，走向舞會大廳', clothing: '華麗藍色禮服，玻璃鞋' },
  { name: '三隻小豬', features: '圓滾滾的身形，粉紅色皮膚，小耳朵', mood: '努力又專注，帶點緊張', pose: '一隻搬木材，一隻堆磚塊，一隻吹草堆', clothing: '簡單背心與短褲' },
  { name: '白雪公主', features: '烏黑短髮，紅潤臉頰，白皙皮膚', mood: '純真微笑，帶點天真', pose: '雙手捧著蘋果，坐在小矮人小屋裡', clothing: '藍黃相間的公主裙' },
  { name: '皮諾丘', label: '木偶奇遇記（皮諾丘）', features: '木頭身體，長鼻子，圓眼睛', mood: '調皮又有點緊張', pose: '伸手摸鼻子，走在小鎮街道', clothing: '紅色短褲，黃色帽子' },
  { name: '孔子', features: '長鬍鬚，黑髮盤髻，莊重面容', mood: '慈祥又專注', pose: '手持竹簡，正在講課', clothing: '古代長袍，腰間束帶' },
  { name: '小華盛頓', label: '華盛頓（童年）', features: '棕色短髮，白皙皮膚，年輕稚氣', mood: '誠實又有點緊張', pose: '手持小斧頭，站在櫻桃樹旁', clothing: '簡單襯衫與短褲' },
  { name: '嫦娥', features: '烏黑長髮，白皙皮膚，優雅面容', mood: '溫柔帶點憂愁', pose: '雙手輕揚，飛向月亮', clothing: '飄逸的古代長裙，袖口寬大' },
  { name: '馬丁路德金博士', features: '短黑髮，深色皮膚，堅毅面容', mood: '充滿希望與力量', pose: '站在講台上，雙手舉起演說', clothing: '深色西裝，白襯衫與領帶' },
  { name: '鄭和', features: '黑髮束冠，莊重面容，膚色偏古銅', mood: '沉穩又自信', pose: '站在船甲板上，指向遠方海域', clothing: '明朝官服，寬袖長袍' },
];

const exampleSelect = $('exampleSelect');
EXAMPLES.forEach((ex, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = `${i + 1}. ${ex.label || ex.name}`;
  exampleSelect.appendChild(opt);
});

exampleSelect.addEventListener('change', () => {
  const idx = exampleSelect.value;
  if (idx === '') return;
  const ex = EXAMPLES[Number(idx)];
  $('cName').value = ex.name;
  $('cFeatures').value = ex.features;
  $('cMood').value = ex.mood;
  $('cPose').value = ex.pose;
  $('cClothing').value = ex.clothing;
  liveSafetyCheck();
  setStatus(`已載入範例角色「${ex.label || ex.name}」，可以直接生成，或改成自己的角色 😊`);
});

// ── 生成 ─────────────────────────────────────────────────────
$('generate').addEventListener('click', generate);
$('again').addEventListener('click', () => {
  $('result').classList.add('hidden');
  $('setup').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('download').addEventListener('click', () => {
  if (!currentImage) return;
  const a = document.createElement('a');
  a.href = currentImage;
  a.download = (currentName || '我的角色').replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '.png';
  document.body.appendChild(a); a.click(); a.remove();
});
$('useInBook').addEventListener('click', () => {
  if (!currentImage) return;
  try { sessionStorage.setItem('ur-storybook-character', currentImage); } catch {}
  location.href = 'index.html';
});

async function generate() {
  const c = getChar();
  if (!c.name && !c.features) {
    setStatus('至少填一下「🧑 角色是誰」或「✨ 外觀特徵」吧 🙂');
    return;
  }
  const pre = window.ContentSafety.checkContentSafety(combinedText());
  if (!pre.safe) { setStatus('😊 ' + window.ContentSafety.safetyMessage(pre)); return; }

  currentName = c.name;
  $('generate').disabled = true;
  $('setup').classList.add('hidden');
  $('result').classList.remove('hidden');
  $('charImg').innerHTML = '<div class="spinner">角色生成中…（高品質約需 20–40 秒）</div>';
  setStatus('🎨 正在畫你的角色……', true);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    let res = await fetch(apiUrl('/api/character'), {
      method: 'POST', headers: buildApiHeaders(), body: JSON.stringify(c),
    });
    if (res.status === 401) {
      if (promptForApiPassword()) {
        res = await fetch(apiUrl('/api/character'), {
          method: 'POST', headers: buildApiHeaders(), body: JSON.stringify(c),
        });
      }
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    currentImage = data.image;
    $('charImg').innerHTML = `<img src="${data.image}" alt="角色圖" />`;
    setStatus('🎉 角色完成！可以下載，或直接「用這個角色做繪本」。');
  } catch (err) {
    $('charImg').innerHTML = '<div class="spinner">生成失敗 😢</div>';
    setStatus('😢 出了點問題：' + err.message);
  } finally {
    $('generate').disabled = false;
  }
}
