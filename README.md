# Finance Tracker

A personal asset-inventory web app inspired by [Percento](https://www.larrynote.com/blog/percento-intro). Focus on **盤點當下淨資產**, not transaction logging.

純前端 SPA，所有資料留在你的瀏覽器（IndexedDB），無後端、無帳號。

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
- **JSON 備份**：「設定」頁可匯出 / 匯入備份，方便跨機器搬移或防誤刪

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
- **Vitest** + `fake-indexeddb` — 單元測試

## 資料

- 所有資料存在瀏覽器的 IndexedDB（DB 名稱 `finance-tracker`）
- UI 偏好（隱藏金額、摺疊狀態）存在 localStorage
- 清除瀏覽器資料 = 清除本工具資料；建議定期匯出 JSON 備份
- 報價與匯率快取也存在 IndexedDB，重新整理會重新抓取
- 沒有任何後端會看到你的資產資料

## 快照機制

- 開啟 App 自動拍今日快照（idempotent，同一天多次寫入會覆寫同一筆）
- 按「重新整理」抓完最新匯率/股價後，會再覆寫今日快照
- Dashboard 右上角「拍快照」按鈕可手動觸發
- 快照只記錄淨資產與三大類總額，不含明細，省空間

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

- **僅支援 USD / TWD**：其他幣別之後再加
- **報價是日線**：盤後一段時間才更新；Stooq / TWSE / TPEx 都回最近一個交易日的收盤
- **興櫃 / 私募未涵蓋**：TWSE + TPEx 主板皆無；可手動填 `manualUnitPrice`（已從表單移除入口，但 DB schema 仍保留作 fallback）
- **單機**：無雲端同步，跨裝置請用匯出 / 匯入 JSON

## 專案結構

```
src/
├─ components/        # 圖表、卡片
├─ db/                # Dexie schema + repositories
├─ domain/            # 分類、bucket、淨資產計算、快照
├─ lib/               # 通用工具（格式化、時區）
├─ routes/            # 頁面（Dashboard / AssetsList / AssetForm / Settings）
├─ services/
│  ├─ fx/             # 匯率 client（open.er-api.com）
│  ├─ io/             # JSON 匯入匯出
│  └─ prices/         # 報價 proxy + 各家 client + symbol 標準化
└─ state/             # React hooks 與 Zustand store（useLiveQuery 包裝、UI 偏好）
functions/api/        # Cloudflare Pages Function（股價 proxy，TWSE + TPEx + Stooq）
tests/                # Vitest
```

## License

未指定。預設保留所有權利。
