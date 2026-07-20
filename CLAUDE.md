# ur-storybook — 專案藍圖（上傳圖片 → 自動生成故事書）

> 本檔是專案級藍圖（變動慢、自動載入）。進度日誌在 Obsidian：`2ndbrain/ur-storybook/工作筆記.md`。
> 與全域最高指導原則衝突時，以全域為準；本檔為補充。

## 對話開始時請先讀
- 進度、最近更動、下一步：Obsidian `2ndbrain/ur-storybook/工作筆記.md`
- 說「**開工**」→ 讀工作筆記、報 git 狀態、建議下一步
- 說「**收工**」→ 更新工作筆記 + commit + push

## 1. 專案目標

一個 Web 工具：使用者**上傳一張圖片（角色圖案）或輸入一段簡短描述**，
系統就**自動生成一本故事書（storybook）**——包含：
1. **故事大綱**（outline）：主題、角色、起承轉合分頁
2. **場景**（scenes）：每頁的文字 + 圖像描述
3. **插圖**（illustrations）：每頁對應插畫，且**全書畫風、角色長相一致**

> 這是一個**全新、獨立**的專案（與隔壁 `storybook/` 無關，不共用程式碼）。

## 2. 生成管線（Pipeline）

| 階段 | 輸入 | 輸出 | 說明 |
|---|---|---|---|
| 1. 輸入解析 | 上傳圖片 / 簡短描述 | 角色設定 + 故事種子 | 圖片→角色外觀特徵；文字→故事主題 |
| 2. 大綱生成 | 故事種子 | 分頁大綱（JSON） | LLM 產生 N 頁的故事結構 |
| 3. 場景擴寫 | 大綱 | 每頁文字 + 圖像 prompt | 逐頁擴寫敘事與畫面描述 |
| 4. 插圖生成 | 圖像 prompt + 角色參考圖 | 每頁插畫 | 影像模型生圖，鎖定角色/畫風一致性 |
| 5. 組book / 匯出 | 文字 + 插圖 | 可預覽的故事書 | 前端翻頁預覽；（選配）匯出 PDF |

> 待決：各階段最終用哪個模型／SDK（見第 4 節），先把介面定好，模型可抽換。

## 3. 技術架構（已實作 v1）

**設計原則：零相依**——只用 Node 內建模組 + 純 HTML/JS，**不需 `npm install`**，
可直接在 GDrive 用 `node server/server.mjs` 跑，繞過「node_modules 不能放 GDrive」的坑。

| 層 | 技術 | 說明 |
|---|---|---|
| 前端 | 純 HTML/CSS/vanilla JS（`public/`） | 上傳描述／角色圖、設定頁數/畫風、逐頁生圖、翻頁預覽 |
| 後端 | Node 內建 `http`（`server/server.mjs`） | 提供靜態檔 + 代理 AI；**持有金鑰，前端永不接觸** |
| 文字/視覺 | OpenAI `gpt-4o`（`OPENAI_CHAT_MODEL`） | 大綱生成、上傳角色圖的視覺描述 |
| 影像生成 | OpenAI `gpt-image-1`（`OPENAI_IMAGE_MODEL`） | 純生成 `/images/generations`；有參考圖走 `/images/edits`（角色一致性） |

### 檔案地圖
- `server/server.mjs` — 零相依後端：靜態服務 + `/api/outline`、`/api/image`、`/api/health`
- `server/lib/openai.mjs` — OpenAI 封裝（chat/vision、generateImage、editImage）
- `server/lib/story.mjs` — 大綱生成、角色視覺描述、單頁插圖 prompt 組裝
- `public/index.html` / `style.css` / `app.js` — 學生用前端（繁中、大字、翻頁）
- `spike/` — 早期最小鏈路驗證腳本（保留參考）
- 啟動：`node server/server.mjs`（讀 `.env`；預設 PORT=3000，可用 `PORT` 環境變數改）

> 之後若要升級成 Vite + React，需搬到本機磁碟跑 `npm install`（見第 5 節）。

## 4. 一桌三櫃

- 🪑 GDrive 工作桌：`G:\我的雲端硬碟\claude\projects\ur-storybook\`（自動跨電腦同步）
- 🐙 GitHub repo：`jong-liu/ur-storybook`（公開，程式碼/前端的家）
- 📘 Obsidian 駕駛艙：`2ndbrain/ur-storybook/工作筆記.md`（進度與想法的家）
- 🔥 Firebase（選配）：要存使用者作品/帳號時再接

## 5. 鐵則（本專案特別注意）

- 🔥 **API Key 只放後端 `.env`**，永不進前端原始碼、永不進 repo。`.gitignore` 已排除 `.env` / `.claude/`。
- 🔴 **`node_modules` 不能放 Google Drive 串流資料夾**：`npm install` 在 GDrive 內會失敗
  （`EBADF` / `TAR_ENTRY_ERROR`，GDrive 串流搶檔案 handle；Junction 也不行）。
  **解法**：原始碼正典放 GDrive，`install / build / run` 一律在本機磁碟
  （例 `C:\dev\ur-storybook`，從 GitHub clone），改完 push、本機 `git pull` 再跑。
- 🟡 影像/資產**檔名不要含 `:`**（Windows NTFS 不合法，會導致 clone checkout 失敗）。
- GDrive 內 git 操作前先設 `git config windows.appendAtomically false`。
- commit 訊息寫清楚「做了什麼 + 為什麼」，不寫「更新」「修改」空話。

## 6. 工作模式

- **加新工具/模組**：說「我想做一個 XXX」→ 建 `tools/<名稱>/` 或對應模組並引導
- **結束工作**：說「**收工**」→ 更新工作筆記 + commit + push
- **接續工作**：說「**開工**」→ 讀工作筆記、報 git 狀態、建議下一步

## 7. 開放問題 / Next Steps

- [ ] 選定文字生成模型/SDK（大綱、場景擴寫）
- [ ] 選定影像生成模型（**必須能用參考圖鎖定角色一致性**，這是成敗關鍵）
- [ ] 定義各階段的資料格式（角色設定 / 大綱 JSON / 場景 / 頁面）
- [ ] 決定後端 host 方式（本機 / Cloud Run / Render…；GitHub Pages 只能放靜態前端）
- [ ] 前端翻頁預覽 + （選配）PDF 匯出
