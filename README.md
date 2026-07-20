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

## Node 版本

- 建議使用 Node `20.x`（本專案已提供 `.nvmrc`）。
- 若你使用 `nvm`：

```bash
nvm use
```

## 一桌三櫃

- 🪑 GDrive：`G:\我的雲端硬碟\claude\projects\ur-storybook\`
- 🐙 GitHub：`jong-liu/ur-storybook`
- 📘 Obsidian：`2ndbrain/ur-storybook/工作筆記.md`

## 本機後端 + GitHub 前端（建議部署法）

1. 在專案根目錄建立 `.env`（可複製 `.env.example`）並填好：
   - `OPENAI_API_KEY`
   - `CORS_ALLOW_ORIGINS`（預設已含 `https://jong-liu.github.io`）
2. 啟動本機後端：

```bash
node server/server.mjs
```

3. 打開 GitHub Pages 前端，並加上 `api` 參數指向本機後端：

```text
https://jong-liu.github.io/ur-storybook/?api=http://localhost:3000
```

4. 角色頁也可直接這樣開：

```text
https://jong-liu.github.io/ur-storybook/character.html?api=http://localhost:3000
```

說明：
- 前端會把 `api` 參數存到 `localStorage`，下次同網域開頁面會自動沿用。
- 後端已支援 CORS 與 preflight（含 Private Network preflight），可被 GitHub Pages 直接呼叫。

## 給學生直接使用（GitHub Pages + 雲端後端）

前端 GitHub Pages 連結：

```text
https://jong-liu.github.io/ur-storybook/
```

要讓學生可直接上傳手繪圖並生成故事書，你需要把 `server/server.mjs` 部署到雲端（例如 Render / Railway / Fly.io），拿到一個後端網址（假設為 `https://your-backend.example.com`）。

部署後，發給學生的連結可用這種格式：

```text
https://jong-liu.github.io/ur-storybook/?api=https://your-backend.example.com
```

角色頁連結：

```text
https://jong-liu.github.io/ur-storybook/character.html?api=https://your-backend.example.com
```

### 可選：課堂密碼保護

若要防止外部濫用，後端設定環境變數：

```text
APP_PASSWORD=你的課堂密碼
```

前端遇到 401 會自動跳出密碼輸入框；輸入一次後會暫存於瀏覽器 `localStorage`。

也可以把密碼直接放在連結（方便但較不安全）：

```text
https://jong-liu.github.io/ur-storybook/?api=https://your-backend.example.com&pwd=你的課堂密碼
```

### 雲端後端建議環境變數

- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL=gpt-4o`
- `OPENAI_IMAGE_MODEL=gpt-image-1`
- `OPENAI_IMAGE_QUALITY=low`
- `OPENAI_CHARACTER_QUALITY=high`
- `CORS_ALLOW_ORIGINS=https://jong-liu.github.io`
- `APP_PASSWORD`（可選）
