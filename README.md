# ur-storybook

這是一個讓學生上傳手繪圖或輸入故事點子，直接生成故事書並下載 PDF 的工具。

目前的使用方式是：
- 前端放在 GitHub Pages
- 後端跑在你的 Ubuntu 主機
- 學生用瀏覽器打開網址後即可使用

## 學生使用連結

故事書頁：

```text
https://jong-liu.github.io/ur-storybook/?api=https://6d1e90e4d59ed8.lhr.life
```

角色頁：

```text
https://jong-liu.github.io/ur-storybook/character.html?api=https://6d1e90e4d59ed8.lhr.life
```

說明：
- 這個 `api` 網址目前是臨時 tunnel，只要你的後端或 tunnel 停掉，連結就會失效。

## 老師開課前要做什麼

1. 先進入專案資料夾。
2. 切到 Node 20。
3. 啟動後端。
4. 啟動 HTTPS tunnel。
5. 把學生連結貼給全班。

常用指令：

```bash
nvm use
node server/server.mjs
ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run
```

## 本機設定

專案使用 Node 20。

```bash
nvm use
```

## 日常使用流程

1. 開機後先確認 `nvm use` 已切到 Node 20。
2. 跑 `node server/server.mjs`。
3. 再開一個 terminal 跑 tunnel。
4. tunnel 產生一個新的 `https://xxxxx.lhr.life` 網址。
5. 把學生連結中的 `api=` 換成新的 tunnel 網址。
6. 把連結發給學生。

## 常見問題

### 為什麼不能直接用 `http://你的IP:3000`？

因為 GitHub Pages 是 HTTPS，瀏覽器會擋掉連到 HTTP 後端的 mixed content。

### 為什麼每次學生連結都可能變？

因為 `localhost.run` 是臨時 tunnel，每次重開可能拿到不同網址。

### 如果學生看到不能連線？

先檢查兩件事：
- `node server/server.mjs` 還有沒有在跑
- `ssh ... localhost.run` 那個 tunnel 還有沒有在跑

## 目前重要檔案

- `server/server.mjs`：後端 API 與 CORS / 密碼保護
- `public/app.js`：故事書頁前端邏輯
- `public/character.js`：角色頁前端邏輯
- `public/pdf.js`：PDF 匯出

## 備註

這份 README 只保留使用方式。
較完整的開發背景與專案藍圖請看 `CLAUDE.md`。
