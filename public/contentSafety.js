// ---------------------------------------------------------------------------
// 內容安全過濾 · 第一層（前端關鍵字檢查）給國小 3～6 年級
//
// 三層把關：
//   1) 這裡的前端關鍵字檢查（早期、友善，送出前 + 生成前）
//   2) 後端 system instruction 的兒童安全指令（server/lib/story.mjs）
//   3) 後端 OpenAI Moderation API（server/lib/openai.mjs）
//
// 清單刻意保守：中文用 2 字以上片語（降低誤判，如「殺球/樹幹」不會被擋），
// 英文用單字邊界比對（如「grape/hello/method」不會誤命中）。
// 純 script 載入，掛在 window.ContentSafety。
// ---------------------------------------------------------------------------
(function (global) {
  // 中文：用「包含」比對（刻意 2 字以上片語，降低誤判）
  const ZH_RULES = [
    { category: '暴力血腥', terms: ['殺人', '殺死', '殺光', '砍死', '刺死', '勒死', '毒死', '燒死', '捅死', '虐殺', '砍頭', '砍傷', '血腥', '屍體', '虐待', '酷刑', '爆頭', '分屍', '斷頭', '槍殺', '開槍打', '活埋', '凌遲', '滅口'] },
    { category: '性與裸露', terms: ['裸體', '裸露', '性行為', '性交', '性愛', '做愛', '強姦', '強暴', '猥褻', '色情', '情色', '性器', '下體', '陰部', '脫光'] },
    { category: '髒話辱罵', terms: ['幹你', '幹妳', '幹您', '幹他', '他媽的', '你媽的', '王八蛋', '混蛋', '智障', '白痴', '白癡', '低能', '腦殘', '神經病', '婊子', '賤人', '賤貨', '雜種', '狗娘', '去死', '死開', '廢物'] },
    { category: '毒品菸酒', terms: ['毒品', '吸毒', '大麻', '海洛因', '安非他命', '搖頭丸', '古柯鹼', '冰毒', 'K他命', '酗酒', '爛醉'] },
    { category: '自我傷害', terms: ['自殺', '自殘', '割腕', '想死', '輕生', '尋短', '跳樓', '上吊'] },
  ];

  // 英文：用「單字邊界」比對，避免 rape 命中 grape、hell 命中 hello
  const EN_RULES = [
    { category: '暴力血腥', terms: ['kill', 'murder', 'gore', 'behead', 'stab', 'gunshot', 'bloody', 'strangle', 'slaughter', 'massacre'] },
    { category: '性與裸露', terms: ['sex', 'nude', 'naked', 'porn', 'penis', 'vagina', 'rape'] },
    { category: '髒話辱罵', terms: ['fuck', 'motherfucker', 'shit', 'bitch', 'asshole', 'bastard', 'retard', 'slut', 'whore', 'cunt'] },
    { category: '毒品菸酒', terms: ['cocaine', 'heroin', 'weed', 'marijuana', 'meth', 'ecstasy'] },
    { category: '自我傷害', terms: ['suicide', 'self-harm'] },
  ];

  const escapeRegExp = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

  // 檢查單一段文字 → { safe, category?, matched? }
  function checkContentSafety(text) {
    if (!text) return { safe: true };
    for (const rule of ZH_RULES) {
      for (const t of rule.terms) {
        if (text.includes(t)) return { safe: false, category: rule.category, matched: t };
      }
    }
    const lower = text.toLowerCase();
    for (const rule of EN_RULES) {
      for (const t of rule.terms) {
        const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i');
        if (re.test(lower)) return { safe: false, category: rule.category, matched: t };
      }
    }
    return { safe: true };
  }

  // 檢查多頁（我方頁面格式 {text, illustration_prompt}）→ 第一個有問題的頁
  function checkPages(pages) {
    for (let i = 0; i < pages.length; i++) {
      const r1 = checkContentSafety(pages[i].text);
      if (!r1.safe) return { safe: false, pageIndex: i, result: r1 };
      const r2 = checkContentSafety(pages[i].illustration_prompt);
      if (!r2.safe) return { safe: false, pageIndex: i, result: r2 };
    }
    return { safe: true };
  }

  // 給小朋友看的友善提醒
  function safetyMessage(result) {
    const cat = result && result.category ? `（${result.category}）` : '';
    return `這段內容${cat}不太適合放進繪本喔 😊 換個溫暖、友善的說法再試一次吧！`;
  }

  global.ContentSafety = { checkContentSafety, checkPages, safetyMessage };
})(window);
