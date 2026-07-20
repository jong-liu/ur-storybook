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

// 從「角色產生器」帶回來的角色圖 → 自動帶入
(function pickupGeneratedCharacter() {
  let img = null;
  try { img = sessionStorage.getItem('ur-storybook-character'); } catch {}
  if (!img) return;
  try { sessionStorage.removeItem('ur-storybook-character'); } catch {}
  state.charImageDataUrl = img;
  const box = $('charPreview');
  box.querySelector('img').src = img;
  box.classList.remove('hidden');
  setStatus('✅ 已帶入你剛做的角色，填一下故事就能開始囉！');
})();

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

// ── 範例故事下拉選單（童話與歷史故事範本，適合小三～小六）────
const EXAMPLES = [
  { title: '小紅帽', char: '小紅帽，一個戴著紅色斗篷的小女孩', setting: '森林裡，白天', plot: '她去看望奶奶，途中遇到大野狼', ending: '獵人救了她和奶奶，提醒孩子要小心陌生人' },
  { title: '灰姑娘', char: '灰姑娘，穿著破舊衣服但心地善良', setting: '王國的城堡，晚上舞會', plot: '仙女教母幫她變身，參加舞會並遇見王子', ending: '王子找到她，幸福生活，傳遞「善良會帶來好運」' },
  { title: '三隻小豬', char: '三隻小豬，分別蓋草屋、木屋、磚屋', setting: '鄉村田野，白天', plot: '大野狼來吹倒房子，只有磚屋能抵擋', ending: '小豬們學到努力與堅持的重要' },
  { title: '白雪公主', char: '白雪公主，皮膚白皙、心地善良', setting: '森林小屋，七個小矮人家', plot: '壞皇后給她毒蘋果，她陷入沉睡', ending: '王子救醒她，提醒孩子要警覺危險' },
  { title: '木偶奇遇記', char: '皮諾丘，一個會說話的木偶', setting: '義大利小鎮，白天', plot: '他因說謊鼻子變長，經歷冒險', ending: '學會誠實，變成真正的男孩' },
  { title: '孔子教學生', char: '孔子，古代中國的老師，穿著長袍', setting: '春秋時代的學堂', plot: '他教學生仁義禮智，回答學生疑問', ending: '學生們成為有智慧的人，傳遞「學習能改變人生」' },
  { title: '華盛頓砍櫻桃樹', char: '小華盛頓，美國第一任總統的童年', setting: '美國鄉村，白天', plot: '他砍倒櫻桃樹，誠實承認錯誤', ending: '父親讚賞他的誠實，傳遞「誠實是美德」' },
  { title: '嫦娥奔月', char: '嫦娥，美麗的女子', setting: '古代中國，月宮', plot: '她因服下仙藥飛到月亮', ending: '嫦娥住在月宮，提醒孩子「珍惜家人與幸福」' },
  { title: '馬丁路德金的夢想', char: '馬丁路德金博士，穿西裝的演說家', setting: '美國華盛頓，林肯紀念堂', plot: '他發表「我有一個夢想」演說', ending: '激勵人們追求平等，傳遞「尊重每個人」' },
  { title: '鄭和下西洋', char: '鄭和，明朝的航海家', setting: '大海與港口，15世紀', plot: '他率領船隊到達許多國家，交流文化', ending: '帶回友誼與知識，傳遞「探索能拓展眼界」' },
];

// 填入下拉選單選項
const exampleSelect = $('exampleSelect');
EXAMPLES.forEach((ex, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = `${i + 1}. ${ex.title}`;
  exampleSelect.appendChild(opt);
});

// 選了範例 → 一鍵填入所有欄位
exampleSelect.addEventListener('change', () => {
  const idx = exampleSelect.value;
  if (idx === '') return;
  const ex = EXAMPLES[Number(idx)];
  $('bookName').value = ex.title;
  $('fChar').value = ex.char;
  $('fSetting').value = ex.setting;
  $('fPlot').value = ex.plot;
  $('fEnding').value = ex.ending;
  liveSafetyCheck();
  setStatus(`已載入範例「${ex.title}」，可以直接生成，或改成自己的想法 😊`);
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

// 併發限流：同時最多 concurrency 個 worker，各自領下一個 index 來做
async function runPool(count, worker, concurrency = 3) {
  let next = 0;
  const run = async () => { while (next < count) { const i = next++; await worker(i); } };
  const runners = [];
  for (let k = 0; k < Math.min(concurrency, count); k++) runners.push(run());
  await Promise.all(runners);
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

    // 併發生圖（一次多張同時畫，比逐張快很多）；限流避免打到 API 速率上限
    const total = slideCount();
    let done = 0;
    setStatus(`🎨 正在同時畫封面和 ${total - 1} 頁……`);
    await runPool(total, async (i) => {
      try {
        setSlideImage(i, await requestImage(i));
      } catch (err) {
        setSlideImage(i, 'ERROR');
        console.error(`slide ${i} 生圖失敗：`, err.message);
      }
      done++;
      setStatus(`🎨 已完成 ${done} / ${total} 張……`);
      renderDots();
      if (state.current === i) showSlide(i);
    }, 3);
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
