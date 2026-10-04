# 字幕燒錄工具（Burn-in Subtitles in Browser）

純前端單頁應用程式，使用 [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) 在瀏覽器內將 MKV / MP4 / MOV 轉成 H.264 + AAC 的 MP4，並把字幕硬燒進畫面。
影片全程在本機處理，不會上傳到任何伺服器，可直接部署在 GitHub Pages，並針對 iPad Safari 使用情境設計。

## 功能

- 支援 `.mkv`、`.mp4`、`.mov` 輸入
- 自動解析 MKV 內建字幕軌（語言、標題、編碼），以下拉選單供選擇
- 三種字幕來源：內建字幕軌、外部 `.srt`、不燒錄
- 文字字幕（SRT / ASS）直接燒錄；圖像字幕（PGS / DVD）以 `overlay` 疊加燒錄
- 輸出設定：720p / 1080p / 原始大小、影像碼率、編碼速度
- 即時進度條、百分比與 FFmpeg 日誌
- 完成後可預覽並下載 MP4
- 透過 Service Worker 啟用 `SharedArrayBuffer`，支援多執行緒轉碼

## 檔案結構

```
.
├── index.html              # 主程式（HTML + CSS + JS，使用 Tailwind CDN）
├── coi-serviceworker.js    # 補上 COOP/COEP 標頭的 Service Worker
└── README.md
```

> `coi-serviceworker.js` 必須與 `index.html` 放在同一層目錄，且不能內嵌進 HTML（瀏覽器規定 Service Worker 必須是獨立檔案）。

## 部署到 GitHub Pages

1. 在 GitHub 建立新的 repository（Public）。
2. 將 `index.html`、`coi-serviceworker.js`、`README.md` 放在根目錄並 push 到 `main` 分支。
3. 到 **Settings → Pages**，Source 選 **Deploy from a branch**，Branch 選 `main` / `(root)`，按 **Save**。
4. 等待約 1～2 分鐘，開啟 `https://<帳號>.github.io/<repo 名稱>/`。
5. **首次開啟會自動重新整理一次**（Service Worker 啟用後必要的動作）。頁面頂端顯示「✔ 多執行緒已啟用」即表示成功。

本機測試請用 HTTP 伺服器（Service Worker 需要 `https` 或 `localhost`），例如：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

## 使用方式

1. **Step 1**：選擇影片檔，程式會自動載入 FFmpeg 核心並解析字幕軌。
2. **Step 2**：選擇字幕來源（內建字幕軌 / 外部 SRT / 不燒錄）。
3. **Step 3**：設定解析度、碼率與編碼速度。
4. 按「開始轉換」，完成後預覽並下載 MP4。

預設值：1080p、5000 kbps、`ultrafast`。

## 運作原理

| 項目 | 做法 |
| --- | --- |
| 字幕軌解析 | FFmpeg.wasm 0.12 沒有 ffprobe，改用 `ffmpeg -i` 並解析日誌中的 `Stream #0:N(lang): Subtitle` |
| 文字字幕燒錄 | `-vf subtitles=/in/input.mkv:si=N`；`si` 是「第幾條字幕軌」，不是 stream 編號，程式已自動換算 |
| 圖像字幕燒錄 | `-filter_complex "[0:v:0][0:s:N]overlay"` |
| 外部 SRT | 寫入 FFmpeg 虛擬檔案系統後以 `subtitles` 濾鏡燒錄 |
| 大檔案處理 | 以 WORKERFS 掛載影片，避免整個檔案複製進 WASM 記憶體 |
| 中文字型 | 燒錄時從 jsDelivr 下載 Noto Sans TC 並以 `fontsdir` 指定 |
| 多執行緒 | 有跨域隔離時載入 `@ffmpeg/core-mt`，否則退回 `@ffmpeg/core` |
| 輸出編碼 | `libx264` + `aac`，`yuv420p`，`+faststart` |

## 已知限制

- **記憶體**：iPad Safari 的 WebAssembly 記憶體上限約 1～2 GB。長片、高解析度、高碼率容易失敗，建議影片小於約 1 GB，必要時改選 720p 並降低碼率（約 3000 kbps）。輸出檔仍會在 WASM 記憶體內產生。
- **速度**：瀏覽器內編碼比原生 FFmpeg 慢很多，1080p 尤其明顯。
- **前景執行**：轉換期間請保持頁面在前景，切換 App 可能使 Safari 中止處理。
- **MKV 內附字型**：不會載入，ASS 字幕會改用 Noto Sans TC 顯示。
- **首次載入**：需要網路下載 FFmpeg 核心（約 30 MB）與中文字型。
- **Safari 相容性**：Safari 不支援 `credentialless` COEP，因此使用 `require-corp`；所有跨網域資源皆以 `crossorigin="anonymous"` 載入。

## 自訂

- **更換字型**：修改 `index.html` 中的 `FONT_URL`，指向你自己 repo 內的 `.otf` / `.ttf`，並同步調整 `force_style` 中的 `FontName`。
- **字幕大小與樣式**：修改 `force_style='FontName=Noto Sans TC,FontSize=22,Outline=2'`。
- **調整預設值**：修改 `index.html` 中 Step 3 的 `<select>` 與 `<input id="vbr">`。

## 疑難排解

| 狀況 | 處理方式 |
| --- | --- |
| 頁面顯示「尚未啟用多執行緒」 | 重新整理一次；確認 `coi-serviceworker.js` 與 `index.html` 同層、網址為 https |
| 載入 FFmpeg 核心失敗 | 檢查網路是否能連到 `cdn.jsdelivr.net`，並關閉可能攔截的內容阻擋器 |
| 中文字幕顯示為方塊 | 字型下載失敗；檢查網路或改用自己 repo 內的字型 |
| 轉換到一半停止或頁面重新載入 | 多半是記憶體不足；改選 720p、降低碼率或使用較小的檔案 |
| 找不到字幕軌 | 該影片可能沒有內建字幕；改用外部 `.srt` |
| 轉換失敗（結束碼非 0） | 查看日誌框中的 FFmpeg 錯誤訊息 |

## 授權與第三方元件

- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)（核心含 x264，採 GPL 授權；散佈時請留意授權條款）
- [Tailwind CSS](https://tailwindcss.com/)（CDN）
- [Noto Sans TC](https://github.com/notofonts/noto-cjk)（SIL Open Font License）
- [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) 的概念
