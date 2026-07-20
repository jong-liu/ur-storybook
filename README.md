# ur-storybook

上傳一張角色圖片，或輸入一段簡短描述，就自動生成一本圖文並茂的**故事書（storybook）**——
自動產出**故事大綱 → 場景 → 插圖**，並維持全書畫風與角色一致。

> 🚧 專案初始化階段。技術選型與程式碼待開發，架構藍圖見 [`CLAUDE.md`](CLAUDE.md)。

## 生成管線

1. **輸入解析** — 上傳圖片（角色）或簡短描述 → 角色設定 + 故事種子
2. **大綱生成** — 產生分頁故事結構
3. **場景擴寫** — 每頁文字 + 圖像描述
4. **插圖生成** — 逐頁生圖，鎖定角色/畫風一致性
5. **組 book / 匯出** — 翻頁預覽（選配 PDF 匯出）

## 開發須知

- **API Key 只放後端 `.env`**，永不進前端或 repo。
- **`node_modules` 不要放 Google Drive**：`npm install` 在 GDrive 內會失敗；
  原始碼放 GDrive，`install / build / run` 一律在本機磁碟（如 `C:\dev\ur-storybook`，從 GitHub clone）。

## 一桌三櫃

- 🪑 GDrive：`G:\我的雲端硬碟\claude\projects\ur-storybook\`
- 🐙 GitHub：`jong-liu/ur-storybook`
- 📘 Obsidian：`2ndbrain/ur-storybook/工作筆記.md`
