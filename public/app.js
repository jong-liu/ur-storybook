// ur-storybook 前端邏輯（純 vanilla JS，無打包）
const $ = (id) => document.getElementById(id);

const state = {
  charImageDataUrl: '',  // 上傳的角色圖 dataURL
  book: null,            // { title, character, style, cover:{image}, pages:[{text, illustration_prompt, image}] }
  current: 0,            // 目前 slide index：0=封面，1..N=內頁
  generating: false,     // 初始批次生圖中（此時停用重畫/匯出，避免狀態訊息打架）
};

// slide 統一視圖：index 0 = 封面，1..N = 內頁
function slideCount() { return state.book ? state.book.pages.length + 1 : 0; }
function slideAt(i) {
  if (!state.book) return null;
  if (i === 0) return { type: 'cover', title: state.book.title, image: state.book.cover.image };
  const p = state.book.pages[i - 1];
  return { type: 'page', pageNo: i, text: p.text, image: p.image };
}
function setSlideImage(i, img) {
  if (i === 0) state.book.cover.image = img;
  else state.book.pages[i - 1].image = img;
}
function slideImagePrompt(i) {
  if (i === 0) return `Front cover illustration of a children's storybook titled "${state.book.title}". A warm, inviting whole scene featuring the main character. No text, no letters, no words in the image.`;
  return state.book.pages[i - 1].illustration_prompt;
}

// ── 角色圖上傳 → dataURL + 預覽 ──────────────────────────────
$('charImage').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.charImageDataUrl = reader.result;
    const box = $('charPreview');
    box.querySelector('img').src = reader.result;
    box.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});
$('clearImg').addEventListener('click', () => {
  state.charImageDataUrl = '';
  $('charImage').value = '';
  $('charPreview').classList.add('hidden');
});

// ── 引導式輸入：收集各欄位 ───────────────────────────────────
const STORY_FIELDS = ['bookName', 'fChar', 'fSetting', 'fPlot', 'fEnding'];

function getStory() {
  const g = (id) => $(id).value.trim();
  const title = g('bookName'), char = g('fChar'), setting = g('fSetting'), plot = g('fPlot'), ending = g('fEnding');
  const parts = [];
  if (char) parts.push(`主角：${char}`);
  if (setting) parts.push(`場景：${setting}`);
  if (plot) parts.push(`情節：${plot}`);
  if (ending) parts.push(`結局：${ending}`);
  return { title, char, setting, plot, ending, idea: parts.join('。') };
}
function combinedStoryText() {
  return STORY_FIELDS.map((id) => $(id).value).join(' ');
}

// ── 內容安全：即時友善提醒（第一層，邊打邊提醒，檢查所有欄位）────
function liveSafetyCheck() {
  const r = window.ContentSafety.checkContentSafety(combinedStoryText());
  const warn = $('ideaWarn');
  if (r.safe) { warn.classList.add('hidden'); warn.textContent = ''; }
  else { warn.textContent = '⚠️ ' + window.ContentSafety.safetyMessage(r); warn.classList.remove('hidden'); }
}
STORY_FIELDS.forEach((id) => $(id).addEventListener('input', liveSafetyCheck));

// ── 載入範例 ─────────────────────────────────────────────────
$('loadExample').addEventListener('click', () => {
  $('bookName').value = '小鯨魚波波的發光朋友';
  $('fChar').value = '一隻圓滾滾、天藍色的小鯨魚，叫波波，有一雙好奇的大眼睛';
  $('fSetting').value = '在深深的藍色海底';
  $('fPlot').value = '波波遇見一群會發光的水母，跟著牠們一起探險，發現海底的祕密洞穴';
  $('fEnding').value = '波波交到新朋友，學會分享與勇敢';
  liveSafetyCheck();
  setStatus('已載入範例，你可以直接生成，或改成自己的點子 😊');
});

// ── 按鈕 ─────────────────────────────────────────────────────
$('generate').addEventListener('click', generate);
$('restart').addEventListener('click', () => {
  $('book').classList.add('hidden');
  $('setup').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('prev').addEventListener('click', () => showSlide(state.current - 1));
$('next').addEventListener('click', () => showSlide(state.current + 1));
$('regen').addEventListener('click', () => regenerateSlide(state.current));
$('exportPdf').addEventListener('click', exportPdf);

function setStatus(msg, show = true) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('hidden', !show);
}

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// 單張生圖（含自動重試一次）；成功回 dataURL，失敗丟錯
async function requestImage(i, { retry = 1 } = {}) {
  const body = {
    illustration_prompt: slideImagePrompt(i),
    character: state.book.character,
    style: state.book.style,
    characterImage: state.charImageDataUrl,
  };
  let lastErr;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const { image } = await api('/api/image', body);
      return image;
    } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

async function generate() {
  const story = getStory();
  // 至少要有「情節」，或上傳角色圖
  if (!story.plot && !story.char && !state.charImageDataUrl) {
    setStatus('請至少填「🦸 主角」和「✨ 發生了什麼事」，或上傳一張角色圖 🙂');
    return;
  }
  if (!story.plot && !state.charImageDataUrl) {
    setStatus('再填一下「✨ 發生了什麼有趣的事？」，故事會更精彩喔 🙂');
    return;
  }
  // 內容安全 · 第一層（步驟④ 送出前）：檢查所有欄位
  const preCheck = window.ContentSafety.checkContentSafety(combinedStoryText());
  if (!preCheck.safe) { setStatus('😊 ' + window.ContentSafety.safetyMessage(preCheck)); return; }

  const style = $('style').value;
  $('generate').disabled = true;

  try {
    // 1) 生成大綱
    setStatus('📝 正在構思故事大綱……');
    const outline = await api('/api/outline', {
      idea: story.idea, title: story.title,
      characterImage: state.charImageDataUrl, numPages: $('numPages').value, style,
    });
    // 內容安全 · 第一層（步驟⑤ 生成前）
    const pageCheck = window.ContentSafety.checkPages(outline.pages);
    if (!pageCheck.safe) {
      setStatus(`😊 第 ${pageCheck.pageIndex + 1} 頁的內容${
        pageCheck.result.category ? '（' + pageCheck.result.category + '）' : ''
      }不太適合，換個更溫暖的點子再試一次吧！`);
      $('generate').disabled = false;
      return;
    }

    state.book = {
      title: outline.title, character: outline.character, style,
      cover: { image: null },
      pages: outline.pages.map((p) => ({ text: p.text, illustration_prompt: p.illustration_prompt, image: null })),
    };
    state.current = 0;

    // 2) 進入繪本畫面，逐張生圖（封面 + 每頁），失敗自動重試一次
    $('setup').classList.add('hidden');
    $('book').classList.remove('hidden');
    $('bookTitle').textContent = outline.title;
    document.title = `📖 ${outline.title}`;
    state.generating = true;
    $('exportPdf').disabled = true;
    renderDots();
    showSlide(0);

    const total = slideCount();
    for (let i = 0; i < total; i++) {
      setStatus(i === 0 ? '🎨 正在畫封面……' : `🎨 正在畫第 ${i} / ${total - 1} 頁……`);
      try {
        setSlideImage(i, await requestImage(i));
      } catch (err) {
        setSlideImage(i, 'ERROR');
        console.error(`slide ${i} 生圖失敗：`, err.message);
      }
      renderDots();
      if (state.current === i) showSlide(i);
    }
    state.generating = false;
    $('exportPdf').disabled = false;
    showSlide(state.current); // 重新整理重畫鈕狀態
    const failed = countFailed();
    setStatus(failed
      ? `完成，但有 ${failed} 張沒畫出來 😢 到那一頁按「重試」即可重畫。`
      : '🎉 你的故事書完成了！用左右箭頭翻頁，或按「匯出 PDF」存起來。');
  } catch (err) {
    setStatus('😢 出了點問題：' + err.message);
    $('setup').classList.remove('hidden');
  } finally {
    state.generating = false;
    $('generate').disabled = false;
  }
}

function countFailed() {
  if (!state.book) return 0;
  let n = state.book.cover.image === 'ERROR' ? 1 : 0;
  n += state.book.pages.filter((p) => p.image === 'ERROR').length;
  return n;
}

// 單頁重生 / 失敗重試（同一機制）
async function regenerateSlide(i) {
  if (!state.book || state.generating) return;
  $('exportPdf').disabled = true;
  setSlideImage(i, null);
  showSlide(i);
  renderDots();
  setStatus(i === 0 ? '🎨 重畫封面中……' : `🎨 重畫第 ${i} 頁中……`);
  try {
    setSlideImage(i, await requestImage(i));
    setStatus('✅ 好了！');
  } catch (err) {
    setSlideImage(i, 'ERROR');
    setStatus('😢 又失敗了，可以再按一次重試。');
  }
  $('exportPdf').disabled = false;
  renderDots();
  if (state.current === i) showSlide(i);
}

async function exportPdf() {
  if (!state.book) return;
  const slides = [];
  slides.push({ isCover: true, title: state.book.title, image: state.book.cover.image });
  state.book.pages.forEach((p) => slides.push({ isCover: false, text: p.text, image: p.image }));
  const btn = $('exportPdf');
  btn.disabled = true;
  setStatus('📄 正在製作 PDF……');
  try {
    await window.StorybookPDF.exportBook({ title: state.book.title, slides });
    setStatus('✅ PDF 已下載（檔名就是書名）。');
  } catch (err) {
    setStatus('😢 匯出失敗：' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function showSlide(i) {
  if (i < 0 || i >= slideCount()) return;
  state.current = i;
  const s = slideAt(i);

  const imgBox = $('pageImg');
  if (s.image === 'ERROR') imgBox.innerHTML = '<div class="spinner">這張插圖生成失敗 😢</div>';
  else if (!s.image) imgBox.innerHTML = '<div class="spinner">插圖生成中…</div>';
  else imgBox.innerHTML = `<img src="${s.image}" alt="插圖" />`;

  if (s.type === 'cover') {
    $('pageText').innerHTML = `<span class="cover-title">${escapeHtml(s.title)}</span>`;
  } else {
    $('pageText').textContent = s.text;
  }

  // 重畫/重試 按鈕文字
  const regen = $('regen');
  regen.textContent = s.image === 'ERROR' ? '🔁 重試' : (s.type === 'cover' ? '🔄 重畫封面' : '🔄 重畫這一頁');
  // 批次生成中、或這張正在生成中 → 停用重畫鈕
  regen.disabled = state.generating || (!s.image && s.image !== 'ERROR');

  $('prev').disabled = i === 0;
  $('next').disabled = i === slideCount() - 1;
  updateDots();
}

function renderDots() {
  const wrap = $('dots');
  wrap.innerHTML = '';
  for (let i = 0; i < slideCount(); i++) {
    const s = slideAt(i);
    const d = document.createElement('div');
    d.className = 'dot' + (i === state.current ? ' active' : '') +
      (s.image === 'ERROR' ? ' err' : (s.image ? '' : ' pending'));
    d.title = i === 0 ? '封面' : `第 ${i} 頁`;
    d.addEventListener('click', () => showSlide(i));
    wrap.appendChild(d);
  }
}
function updateDots() {
  [...$('dots').children].forEach((d, i) => {
    const s = slideAt(i);
    d.classList.toggle('active', i === state.current);
    d.classList.toggle('pending', !s.image && s.image !== 'ERROR');
    d.classList.toggle('err', s.image === 'ERROR');
  });
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
