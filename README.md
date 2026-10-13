# 數獨（個人用 · 無廣告）

專為 Charlie Yip 個人使用的數獨網頁 App：無廣告、無追蹤、無付費牆，支援離線與「加入主畫面」（PWA）。

## 功能

- 標準 9×9 數獨，四種難度：簡單 / 中等 / 困難 / 專家（皆為唯一解）
- 選取高亮（列、欄、宮、相同數字）
- 數字鍵盤、筆記模式、撤銷 / 重做
- 提示（每局 3 次）、計時器、暫停
- 自動檢查錯誤（可關）、錯誤計數；可選「三錯挑戰」
- 完成慶祝、進度與設定存於本機 `localStorage`
- 深色模式、鍵盤操作、離線可用

## 在電腦上開啟

```bash
cd /workspace/sudoku-app
./start.sh
# 或：python3 -m http.server 8080
```

瀏覽器開啟：<http://127.0.0.1:8080/>

> 請用本機伺服器開啟（不要直接用 `file://`），否則 Service Worker / PWA 可能無法正常運作。

## 在 iPhone 上「加入主畫面」

1. **讓 iPhone 能連到這台 App**（擇一）
   - 電腦與 iPhone 同一 Wi‑Fi：執行 `./start.sh`，在 iPhone Safari 輸入 `http://<電腦區網IP>:8080`
   - 或之後部署到任意靜態空間 / 隧道（如 Cloudflare Tunnel、ngrok）後用 HTTPS 網址開啟
2. 用 **Safari** 開啟該網址
3. 點底部分享按鈕 **□↑**
4. 向下滑，選 **「加入主畫面」**（加入主畫面）
5. 名稱可維持「數獨」，點 **加入**
6. 主畫面會出現圖示；之後可離線開啟（首次需連線以快取資源）

## 檔案結構

```
sudoku-app/
├── index.html
├── manifest.json
├── sw.js
├── start.sh
├── css/styles.css
├── js/sudoku.js    # 產生器與求解
├── js/game.js      # 遊戲狀態與存檔
├── js/ui.js        # 介面
└── icons/          # App 圖示
```

## 隱私

完全本機運作，無分析、無廣告、無外部追蹤腳本。字體使用系統字型（含 PingFang TC）。
