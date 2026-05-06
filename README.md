# Finance Tracker

A personal asset-inventory web app inspired by [Percento](https://www.larrynote.com/blog/percento-intro). Focus on **盤點當下淨資產**, not transaction logging.

純前端 SPA，所有資料留在你的瀏覽器（IndexedDB）；可選擇連結一個本機 .json 檔做自動同步備份。無後端、無帳號。

## 主要功能

- **資產盤點**：流動資金 / 投資 / 固定資產 三大分類；流動再依幣別分為美元現金 / 台幣現金；投資依類型分為美元股票 / 台灣股票 / 加密貨幣 / 其他
- **自動報價**：
  - 美股（Stooq，前一交易日收盤）
  - 台股（TWSE 上市，TPEx OpenAPI fallback 到上櫃）
  - 加密貨幣（CoinGecko 即時）
- **多幣別**：台幣 / 美元，匯率自動拉取（[open.er-api.com](https://open.er-api.com)），12h 快取
- **視覺化**：
  - 總覽：資產分類 / 投資組合 兩張圈圖、各類別卡片
  - 點美元股票或台灣股票切片可展開 finviz 風格的方塊圖
  - 資產列表分組顯示比例與總額，子分類可摺疊（**狀態跨頁面/重整保留**）
  - 區內佔比：每筆資產顯示在所屬子分類內的比例（例：TSLA 佔美元股票 50%）
- **隱藏金額按鈕**：右上角眼睛 icon，把所有金額與股數遮成 `****`，比例仍可見；狀態跨重整保留
- **歷史快照**：每天自動拍快照（淨資產 + 三大類分項），趨勢線圖支援 3 月 / 6 月 / 1 年 / 5 年區間
- **連結備份檔（Obsidian 風格自動同步）**：選一個 .json 檔（建議放 iCloud / Dropbox / Google Drive），App 每次變動會自動寫回；換機器只要連結同一個檔即可還原。需要支援 [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) 的瀏覽器（Chrome / Edge / Brave / Opera）。
- **JSON 匯出 / 匯入**：Safari / Firefox 等不支援 FSA 的瀏覽器走手動備份路徑，設定頁有匯出 / 匯入按鈕

## 快速開始

需求：Node 20+ 與 npm。

```bash
npm install
npm run dev
```

打開 <http://localhost:5173> 即可使用。

第一次開啟時，到「資產」分頁新增幾筆資產：
- 流動資金 → 現金 → 選 USD 或 TWD 加上金額
- 投資 → 股票 → 複委託 / 海外券商 → 代號（如 `AAPL`）+ 股數，存檔自動抓價
- 投資 → 股票 → 台灣券商 → 代號（如 `2330` 上市、`5478` 上櫃）+ 股數，存檔自動抓價
- 投資 → 加密貨幣 → 選幣種（BTC、ETH…）+ 數量，存檔自動抓價

接著到「設定」頁設定備份：
- Chromium：「連結備份檔」→ 建立新備份檔（建議放在雲端同步資料夾）
- Safari / Firefox：定期按「匯出 .json」做手動備份

## 命令

| 命令              | 說明                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `npm run dev`     | 開發伺服器，含 `/api/quote` 中介層（代理 Stooq / TWSE / TPEx）       |
| `npm run build`   | TypeScript type-check + 產生靜態 bundle 至 `dist/`                   |
| `npm run preview` | 預覽正式環境 build                                                   |
| `npm test`        | 跑 Vitest 測試                                                       |
| `npm run lint`    | ESLint                                                               |

## 技術棧

- **Vite** + **React 19** + **TypeScript** + **Tailwind CSS**
- **Dexie**（IndexedDB wrapper）+ `dexie-react-hooks` 響應式查詢
- **Recharts** — donut、treemap、line chart
- **Zustand** + `persist` middleware — 隱藏金額切換、UI 偏好持久化
- **Zod** — API 回應與匯入檔案驗證
- **File System Access API** — 連結備份檔自動同步（Chromium-only）
- **Vitest** + `fake-indexeddb` — 單元測試

## 資料

- live store：瀏覽器 IndexedDB（DB 名稱 `finance-tracker`）
- 連結備份檔：使用者選的 .json 檔；Dexie hook 觸發 1 秒 debounce auto-write
- UI 偏好（隱藏金額、摺疊狀態）：localStorage
- 報價與匯率快取也在 IndexedDB，按「更新報價」會重新抓取
- 沒有任何後端會看到你的資產資料

## 快照機制（趨勢圖資料點）

- 開啟 App 自動拍今日快照（idempotent，同一天多次寫入會覆寫同一筆）
- 按「更新報價」抓完最新匯率/股價後，會再覆寫今日快照
- 快照只記錄淨資產與三大類總額，不含明細，省空間
- 與「連結備份檔」是兩件不同的事：快照是趨勢圖的資料點，連結備份檔是把 IndexedDB 內容（含所有快照）寫到本機 .json

## 連結備份檔運作方式（Chromium）

1. 設定頁「建立新備份檔」→ 透過 FSA 選擇位置
2. App 立即把目前 DB 寫入該檔
3. 之後每次新增/編輯/刪除資產、拍快照、改基準幣別等，1 秒後自動寫回該檔
4. 跨機器：在另一台機器點「連結既有備份檔」選同一個雲端資料夾的檔 → 自動載入
5. 兩端同時開時，較新的版本（依 `exportedAt`）會在另一端的頂端黃條提示「載入新版本 / 保留本機（覆寫檔案）」

實作重點：
- `FileSystemFileHandle` 透過 IndexedDB 的 structured clone 持久化
- 重整後若權限為 `prompt` 狀態，會出現黃條請使用者一次性授權
- 寫入 lastWriteAt 時用 `mute()` 包起來避免無限迴圈
- `linkedFile` metadata 不會出現在匯出 JSON（避免不可序列化的 handle 跨機器外洩）

## 部署

設計成可部署到 **Cloudflare Pages**（或任何支援 Functions 的靜態主機）：

- 靜態檔案來自 `dist/`（`npm run build`）
- `functions/api/quote.ts` 是 Pages Function，作為股價 proxy
  - 美股 → Stooq
  - 台股 → TWSE STOCK_DAY → 找不到時 fallback TPEx OpenAPI
  - 三個上游都不開 CORS，必須走伺服端
- 同源（同網域）下 SPA 會打 `/api/quote` 拿股價，不需另外設定 CORS
- TPEx 是 bulk endpoint（~4MB / 10k+ 檔），proxy 內含 5 分鐘 in-memory 快取

匯率與加密貨幣 API 都允許 CORS，由瀏覽器直接呼叫，不經 proxy。

## 已知限制

- **連結備份檔僅 Chromium**：Safari / Firefox 沒有 FSA，自動 fallback 到手動匯出/匯入
- **僅支援 USD / TWD**：其他幣別之後再加
- **報價是日線**：盤後一段時間才更新；Stooq / TWSE / TPEx 都回最近一個交易日的收盤
- **興櫃 / 私募未涵蓋**：TWSE + TPEx 主板皆無；DB schema 仍保留 `manualUnitPrice` fallback 但 UI 已不暴露
- **無多端同步衝突解決**：兩台機器同時編輯時靠 `exportedAt` 比較，較舊的會被提示覆寫；不適合多人協作

## 專案結構

```
src/
├─ components/        # 圖表、卡片、banner
├─ db/                # Dexie schema + repositories
├─ domain/            # 分類、bucket、淨資產計算、快照
├─ lib/               # 通用工具（格式化、時區）
├─ routes/            # 頁面（Dashboard / AssetsList / AssetForm / Settings）
├─ services/
│  ├─ fx/             # 匯率 client（open.er-api.com）
│  ├─ io/             # 匯出/匯入、連結備份檔、change tracker
│  └─ prices/         # 報價 proxy + 各家 client + symbol 標準化
└─ state/             # React hooks、Zustand store、FileSync provider
functions/api/        # Cloudflare Pages Function（股價 proxy，TWSE + TPEx + Stooq）
tests/                # Vitest
```

## License

未指定。預設保留所有權利。
