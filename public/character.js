// 角色產生器前端邏輯（純 vanilla JS）
const $ = (id) => document.getElementById(id);
const FIELDS = ['cName', 'cFeatures', 'cMood', 'cPose', 'cClothing'];
let currentImage = null;
let currentName = '';

// 風格標籤（跟後端 CHARACTER_STYLE_TAGS 一致；載入時也會用 /api/health 覆寫確保同步）
const DEFAULT_TAGS = ['日系插畫風', '角色特徵鮮明', '情緒自然表情', '動態姿態', '服裝細節精緻',
  '手繪塗鴉風', '潑墨筆觸', '隨性線條', '粉彩與墨色混合', '漫畫草稿質感',
  '白色簡約背景', '氛圍感強', '高細節', '高品質'];

function renderChips(tags) {
  $('styleChips').innerHTML = tags.map((t) => `<span class="chip">${t}</span>`).join('');
}
renderChips(DEFAULT_TAGS);
fetch('/api/health').then((r) => r.json()).then((d) => {
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

// ── 載入範例 ─────────────────────────────────────────────────
$('loadExample').addEventListener('click', () => {
  $('cName').value = '一個勇敢的小女孩，叫小星';
  $('cFeatures').value = '紅色短髮、大大的琥珀色眼睛、臉頰有小雀斑';
  $('cMood').value = '開心又充滿好奇';
  $('cPose').value = '張開雙手往前奔跑';
  $('cClothing').value = '黃色雨衣配紅色小雨鞋';
  liveSafetyCheck();
  setStatus('已載入範例，可以直接生成，或改成自己的角色 😊');
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
    const res = await fetch('/api/character', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c),
    });
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
