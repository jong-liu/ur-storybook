// ur-storybook · 客戶端 PDF 匯出（零相依，不需 jsPDF）
//
// 做法：每一頁（含封面）用 <canvas> 把「插圖 + 文字」畫成一張圖 → 轉 JPEG，
// 再手工組出「每頁一張全頁圖片」的 PDF（DCTDecode）。文字烤進圖片，
// 因此中文不需嵌入 CJF 字型，完全在瀏覽器端完成。
// 掛在 window.StorybookPDF.exportBook({ title, slides })。
(function (global) {
  const PAGE_W = 1024;
  const IMG_H = 1024;
  const FOOTER_H = 300;
  const PAGE_H = IMG_H + FOOTER_H;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('圖片載入失敗'));
      img.src = src;
    });
  }

  // 文字自動換行（回傳每行陣列）
  function wrapLines(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of (text || '')) {
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }

  // 把一個 slide 畫成 canvas → JPEG dataURL
  async function composeSlide(slide) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = slide.isCover ? PAGE_H + 40 : PAGE_H;
    const ctx = canvas.getContext('2d');

    // 底色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 插圖
    if (slide.image && slide.image !== 'ERROR') {
      try {
        const img = await loadImage(slide.image);
        ctx.drawImage(img, 0, 0, PAGE_W, IMG_H);
      } catch { /* 畫不出就留白 */ }
    } else {
      ctx.fillStyle = '#f3f0fa';
      ctx.fillRect(0, 0, PAGE_W, IMG_H);
    }

    // 文字區
    const footerTop = IMG_H;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, footerTop, PAGE_W, canvas.height - footerTop);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2b2b3a';

    if (slide.isCover) {
      ctx.font = 'bold 60px "Noto Sans TC", system-ui, sans-serif';
      const lines = wrapLines(ctx, slide.title, PAGE_W - 120);
      const lh = 78;
      let y = footerTop + (canvas.height - footerTop) / 2 - ((lines.length - 1) * lh) / 2 + 20;
      lines.forEach((ln) => { ctx.fillText(ln, PAGE_W / 2, y); y += lh; });
    } else {
      ctx.font = '40px "Noto Sans TC", system-ui, sans-serif';
      const lines = wrapLines(ctx, slide.text, PAGE_W - 120);
      const lh = 54;
      let y = footerTop + (FOOTER_H - (lines.length - 1) * lh) / 2 + 6;
      lines.forEach((ln) => { ctx.fillText(ln, PAGE_W / 2, y); y += lh; });
    }
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height };
  }

  function dataUrlToBytes(dataUrl) {
    const b64 = dataUrl.split(',')[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // 手工組 PDF：每頁一張全頁 JPEG（DCTDecode）
  function buildPdf(pages) {
    const chunks = [];
    let offset = 0;
    const enc = (s) => new TextEncoder().encode(s);
    const push = (data) => {
      const bytes = typeof data === 'string' ? enc(data) : data;
      chunks.push(bytes);
      offset += bytes.length;
      return bytes.length;
    };

    const offsets = [];
    const startObj = (n) => { offsets[n] = offset; };

    push('%PDF-1.4\n');

    const N = pages.length;
    // 物件編號：1=Catalog 2=Pages；每頁 3 個物件
    startObj(1); push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    const kids = [];
    for (let k = 0; k < N; k++) kids.push(`${3 + 3 * k} 0 R`);
    startObj(2);
    push(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${N} >>\nendobj\n`);

    for (let k = 0; k < N; k++) {
      const pageNum = 3 + 3 * k;
      const contentNum = 4 + 3 * k;
      const imgNum = 5 + 3 * k;
      const { bytes, width, height } = pages[k];

      // Page
      startObj(pageNum);
      push(`${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /XObject << /Im0 ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`);

      // Contents：把單位方塊縮放到整頁畫出影像
      const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;
      startObj(contentNum);
      push(`${contentNum} 0 obj\n<< /Length ${enc(content).length} >>\nstream\n${content}endstream\nendobj\n`);

      // Image XObject（JPEG）
      startObj(imgNum);
      push(`${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
      push(bytes);
      push('\nendstream\nendobj\n');
    }

    // xref
    const xrefStart = offset;
    const objCount = 2 + 3 * N + 1; // 含物件 0
    let xref = `xref\n0 ${objCount}\n0000000000 65535 f \n`;
    for (let n = 1; n < objCount; n++) {
      xref += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    }
    push(xref);
    push(`trailer\n<< /Size ${objCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    // 合併
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return new Blob([out], { type: 'application/pdf' });
  }

  function sanitizeFilename(name) {
    return (name || '我的故事書').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || '我的故事書';
  }

  async function exportBook({ title, slides }) {
    const usable = slides.filter((s) => s.image && s.image !== 'ERROR');
    if (usable.length === 0) throw new Error('還沒有可以匯出的插圖');
    const pages = [];
    for (const s of usable) {
      const { dataUrl, width, height } = await composeSlide(s);
      pages.push({ bytes: dataUrlToBytes(dataUrl), width, height });
    }
    const blob = buildPdf(pages);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(title) + '.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  global.StorybookPDF = { exportBook };
})(window);
