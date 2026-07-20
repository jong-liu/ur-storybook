# spike — 最小可行鏈路

驗證一句描述 →（文字模型）一頁大綱 →（影像模型）一張插圖 是否跑得通。
**零相依**：只用 Node 18+ 原生 `fetch`，不需 `npm install`，可直接在此 GDrive 資料夾跑。

## 跑法

1. 把專案根目錄 `.env` 裡的 `GEMINI_API_KEY=` 填上你的 myai168/NTHU 金鑰。
2. 在專案根目錄執行：
   ```bash
   node spike/generate.mjs "一隻愛冒險的小鯨魚在深海遇見會發光的水母"
   ```
   不給參數就用預設句子。

## 產物

- `generated/page-<時間>.json` — 這一頁的 title / character / page_text / illustration_prompt
- `generated/page-<時間>.png` — 插圖（若影像模型可用）

## 已知卡點

代理商（myai168/NTHU）文字模型可用，但影像模型可能回 `No pricing info!`（沒設計費）。
若插圖那步這樣失敗 → 文字鏈路已證明可行，影像需換 Google 官方付費金鑰，
或請代理商開通影像模型計費。切換官方金鑰：見 `.env.example`。
