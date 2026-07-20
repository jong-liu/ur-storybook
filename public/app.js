// ur-storybook 前端邏輯（純 vanilla JS，無打包）
const $ = (id) => document.getElementById(id);

const state = {
  charImageDataUrl: '', // 上傳的角色圖 dataURL
  outline: null,        // { title, character, pages:[{page,text,illustration_prompt, image?}] }
  current: 0,           // 目前頁 index
  style: '溫暖童趣水彩',
};

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

// ── 生成按鈕 ─────────────────────────────────────────────────
$('generate').addEventListener('click', generate);
$('restart').addEventListener('click', () => {
  $('book').classList.add('hidden');
  $('setup').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('prev').addEventListener('click', () => showPage(state.current - 1));
$('next').addEventListener('click', () => showPage(state.current + 1));

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

async function generate() {
  const idea = $('idea').value.trim();
  if (!idea && !state.charImageDataUrl) {
    setStatus('請先寫一句故事點子，或上傳一張角色圖 🙂');
    return;
  }
  state.style = $('style').value;
  $('generate').disabled = true;

  try {
    // 1) 生成大綱
    setStatus('📝 正在構思故事大綱……');
    const outline = await api('/api/outline', {
      idea,
      characterImage: state.charImageDataUrl,
      numPages: $('numPages').value,
      style: state.style,
    });
    outline.pages.forEach((p) => (p.image = null));
    state.outline = outline;
    state.current = 0;

    // 2) 進入繪本畫面，逐頁生圖
    $('setup').classList.add('hidden');
    $('book').classList.remove('hidden');
    $('bookTitle').textContent = outline.title;
    renderDots();
    showPage(0);

    for (let i = 0; i < outline.pages.length; i++) {
      setStatus(`🎨 正在畫第 ${i + 1} / ${outline.pages.length} 頁……`);
      try {
        const { image } = await api('/api/image', {
          illustration_prompt: outline.pages[i].illustration_prompt,
          character: outline.character,
          style: state.style,
          characterImage: state.charImageDataUrl,
        });
        outline.pages[i].image = image;
      } catch (err) {
        outline.pages[i].image = 'ERROR';
        console.error(`第 ${i + 1} 頁生圖失敗：`, err.message);
      }
      renderDots();
      if (state.current === i) showPage(i); // 若正看這頁就即時更新
    }
    setStatus('🎉 你的故事書完成了！用左右箭頭翻頁吧。');
  } catch (err) {
    setStatus('😢 出了點問題：' + err.message);
    $('setup').classList.remove('hidden');
  } finally {
    $('generate').disabled = false;
  }
}

function showPage(i) {
  const pages = state.outline?.pages || [];
  if (i < 0 || i >= pages.length) return;
  state.current = i;
  const p = pages[i];

  const imgBox = $('pageImg');
  if (p.image === 'ERROR') imgBox.innerHTML = '<div class="spinner">這頁插圖生成失敗 😢</div>';
  else if (!p.image) imgBox.innerHTML = '<div class="spinner">插圖生成中…</div>';
  else imgBox.innerHTML = `<img src="${p.image}" alt="第 ${i + 1} 頁插圖" />`;

  $('pageText').textContent = p.text;
  $('prev').disabled = i === 0;
  $('next').disabled = i === pages.length - 1;
  updateDots();
}

function renderDots() {
  const wrap = $('dots');
  wrap.innerHTML = '';
  (state.outline?.pages || []).forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === state.current ? ' active' : '') + (p.image ? '' : ' pending');
    d.addEventListener('click', () => showPage(i));
    wrap.appendChild(d);
  });
}
function updateDots() {
  [...$('dots').children].forEach((d, i) => {
    d.classList.toggle('active', i === state.current);
    d.classList.toggle('pending', !state.outline.pages[i].image);
  });
}
