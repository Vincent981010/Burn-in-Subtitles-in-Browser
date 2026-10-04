# 字幕燒錄工具（Burn-in Subtitles in Browser）

純前端單頁應用程式，使用 [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) 在瀏覽器內將 MKV / MP4 / MOV 轉成 H.264 + AAC 的 MP4，並把字幕硬燒進畫面。
影片全程在本機處理，不會上傳到任何伺服器，可直接部署在 GitHub Pages，並針對 iPad / iPhone Safari 使用情境設計。

## 功能

- 支援 `.mkv`、`.mp4`、`.mov` 輸入
- 自動解析 MKV 內建字幕軌（語言、標題、編碼），以下拉選單供選擇
- 三種字幕來源：內建字幕軌、外部 `.srt`、不燒錄
- 文字字幕（SRT / ASS）直接燒錄；圖像字幕（PGS / DVD）以 `overlay` 疊加燒錄
- 輸出設定：720p / 1080p / 原始大小、影像碼率、編碼速度
- 字幕大小可自訂（佔影片高度的百分比），並有「小 / 中 / 大」快速按鈕
- 即時進度條、百分比與 FFmpeg 日誌
- 完成後可預覽並下載 MP4
- 透過 Service Worker 啟用 `SharedArrayBuffer`，支援多執行緒轉碼
- 核心載入有多重備援（jsDelivr → unpkg → 本機 `vendor/`）

## 檔案結構

```
.
├── index.html              # 主程式（HTML + CSS + JS，使用 Tailwind CDN）
├── coi-serviceworker.js    # 補上 COOP/COEP 標頭的 Service Worker
├── vendor/                 # （建議）本機備援的 FFmpeg 核心，見下方說明
│   ├── ffmpeg-core.js      # 必須是 ESM 版（dist/esm）
│   ├── ffmpeg-core.wasm
│   └── 814.ffmpeg.js
└── README.md
```

> - `coi-serviceworker.js` 必須與 `index.html` 放在同一層目錄，且不能內嵌進 HTML（瀏覽器規定 Service Worker 必須是獨立檔案）。
> - `vendor/` 不是必要的，但若 CDN 載入失敗（或你想完全不依賴 CDN），這是最穩的做法。程式也會在網站根目錄尋找這三個檔案，所以在 iPad 上用網頁介面無法建立資料夾時，可直接放在根目錄。

## 部署到 GitHub Pages

1. 在 GitHub 建立新的 repository（Public）。
2. 將 `index.html`、`coi-serviceworker.js`、`README.md`（以及 `vendor/`）放在根目錄並 push 到 `main` 分支。
3. 到 **Settings → Pages**，Source 選 **Deploy from a branch**，Branch 選 `main` / `(root)`，按 **Save**。
4. 等待約 1～2 分鐘，開啟 `https://<帳號>.github.io/<repo 名稱>/`。
5. **首次開啟會自動重新整理一次**（Service Worker 啟用後必要的動作）。頁面頂端顯示「✔ 多執行緒已啟用」即表示成功。

### 取得 vendor 檔案（選用）

在終端機執行（務必使用 `dist/esm` 的核心）：

```bash
mkdir vendor && cd vendor
curl -LO https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js
curl -LO https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm
curl -LO https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js
```

`ffmpeg-core.wasm` 約 32 MB，在 GitHub 單檔 100 MB 的上限內。此備援一律使用單執行緒核心。

### 本機測試

Service Worker 需要 `https` 或 `localhost`：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

## 使用方式

1. **Step 1**：選擇影片檔，程式會自動載入 FFmpeg 核心並解析字幕軌。
2. **Step 2**：選擇字幕來源（內建字幕軌 / 外部 SRT / 不燒錄）。
3. **Step 3**：設定解析度、碼率、編碼速度與字幕大小。
4. 按「開始轉換」，完成後預覽並下載 MP4。

預設值：1080p、5000 kbps、`ultrafast`、字幕大小 5.8（約等於 HandBrake 預設）。

### 字幕大小

- 以「影片高度的百分比」表示：小 4.5、中 5.8、大 7，可輸入 2～15 之間的數字。
- SRT 等純文字字幕以 288 高為基準（libass 預設 PlayResY），程式會自動換算成 `FontSize`。
- ASS 字幕預設保留原作者的樣式；勾選「也套用到 ASS 字幕」才會覆寫。
- 外框粗細預設 1.2（0 為無外框，最大 4），可在介面調整。
- 要和 HandBrake 的輸出一致，請用短片並排比較後微調數值。

## 運作原理

| 項目 | 做法 |
| --- | --- |
| 字幕軌解析 | FFmpeg.wasm 0.12 沒有 ffprobe，改用 `ffmpeg -i` 讀取檔案前 48 MB，並解析日誌中的 `Stream #0:N(lang): Subtitle` |
| 文字字幕燒錄 | `-vf subtitles=/in/input.mkv:si=N`；`si` 是「第幾條字幕軌」，不是 stream 編號，程式已自動換算 |
| 圖像字幕燒錄 | `-filter_complex "[0:v:0][0:s:N]overlay"` |
| 外部 SRT | 寫入 FFmpeg 虛擬檔案系統後以 `subtitles` 濾鏡燒錄 |
| 大檔案處理 | 轉換時以 WORKERFS 掛載影片，避免整個檔案複製進 WASM 記憶體；掛載失敗則退回整檔載入 |
| 中文字型 | 燒錄時從 jsDelivr 下載 Noto Sans TC 並以 `fontsdir` 指定 |
| 多執行緒 | 有跨域隔離時載入 `@ffmpeg/core-mt`，否則退回 `@ffmpeg/core` |
| 核心格式 | 指定 `classWorkerURL` 時 FFmpeg 會建立 module worker，其中無法使用 `importScripts`，因此必須使用 **ESM 版核心**（`dist/esm`） |
| 輸出編碼 | `libx264` + `aac`，`yuv420p`，`+faststart` |

## 已知限制

- **記憶體**：WebAssembly 核心本身約有 2 GB 的記憶體上限，與裝置 RAM 無關。輸入影片雖以掛載方式讀取，但輸出的 MP4 仍在這個範圍內產生。長片、高解析度、高碼率容易失敗，必要時改選 720p 並降低碼率（約 3000 kbps）。
- **速度**：FFmpeg.wasm 只能用 CPU 軟編碼，無法使用 iPhone / iPad 的硬體編碼器，1080p 比原生 App 慢很多。
- **前景執行**：轉換期間請保持頁面在前景、螢幕不要鎖定，切換 App 可能使 Safari 中止處理。iPhone 較容易中斷，建議只處理短片。
- **MKV 內附字型**：不會載入，ASS 字幕會改用 Noto Sans TC 顯示。
- **首次載入**：需要網路下載 FFmpeg 核心（約 30 MB）與中文字型。
- **Safari 相容性**：Safari 不支援 `credentialless` COEP，因此使用 `require-corp`；所有跨網域資源皆以 `crossorigin="anonymous"` 載入。

## 疑難排解

| 狀況 | 處理方式 |
| --- | --- |
| 頁面顯示「尚未啟用多執行緒」 | 確認 `coi-serviceworker.js` 有上傳且與 `index.html` 同層、網址為 https，然後重新整理；仍無效請清除該網站資料 |
| 日誌出現 `failed to import ffmpeg-core.js` | 核心必須是 ESM 版（`dist/esm`）；若自備 `vendor/`，請確認 `ffmpeg-core.js` 來自 `dist/esm` |
| `找不到 …ffmpeg-core.wasm（HTTP 404）` | 本機備援檔案未上傳或路徑錯誤；檢查 `vendor/` 內三個檔案 |
| 載入 FFmpeg 核心失敗 | 檢查網路能否連到 `cdn.jsdelivr.net` / `unpkg.com`，並關閉可能攔截的內容阻擋器，或改用 `vendor/` 備援 |
| 改了程式但畫面沒變 | Pages 部署需 1～2 分鐘；Service Worker 與瀏覽器可能快取舊版，請清除網站資料後重新載入 |
| 中文字幕顯示為方塊 | 字型下載失敗；檢查網路或改用自己 repo 內的字型（修改 `FONT_URL`） |
| 字幕太大或太小 | 調整步驟 3 的「字幕大小」 |
| 轉換到一半停止或頁面重新載入 | 多半是記憶體不足；改選 720p、降低碼率或使用較小的檔案 |
| 找不到字幕軌 | 該影片可能沒有內建字幕；改用外部 `.srt` |
| 轉換失敗（結束碼非 0） | 查看日誌框中的 FFmpeg 錯誤訊息 |

## 自訂

- **更換字型**：修改 `index.html` 中的 `FONT_URL`，指向你自己 repo 內的 `.otf` / `.ttf`，並同步調整 `force_style` 中的 `FontName`。
- **調整預設值**：修改 `index.html` 中 Step 3 的 `<select>` 與 `<input>` 的 `value`。

## 授權與第三方元件

- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)（核心含 x264，採 GPL 授權；散佈時請留意授權條款）
- [Tailwind CSS](https://tailwindcss.com/)（CDN）
- [Noto Sans TC](https://github.com/notofonts/noto-cjk)（SIL Open Font License）
- [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) 的概念
