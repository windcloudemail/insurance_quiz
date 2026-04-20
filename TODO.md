# 外幣題庫網站 TODO

依優先級排序，勾選表示完成。詳細討論記錄見對話歷史。

## 🔴 高優 — 公開給他人使用前必做

- [ ] **密碼 hash**：`users.password` 改 bcrypt / Argon2，不要再存明文
- [ ] **Token 驗證 + 過期**：新增 `sessions` 表（token, user_id, role, expires_at），middleware 查 DB 驗證 token；移除目前 stateless 可偽造的 `{role}-{userId}-{random}` 設計
- [ ] **Login rate limit**：同 IP 5 次/分鐘，抵禦 YYYY (200 種) 暴力破解
- [ ] **Cloudflare Access 門禁**：Zero Trust → Applications 設 email allowlist，未登入陌生人看不到網站（免費 50 users）

## 🟠 中優 — 提升使用體驗

- [ ] **考試模式**：Home 新增「模擬考」按鈕；Quiz 該模式下不即時揭答 + 加倒數計時器；Result 一次看全部結果
- [ ] **選項隨機打亂**：每次進題目把 1/2/3/4 順序 shuffle，避免死記位置。注意 answer 欄也要跟著 remap
- [ ] **複選題 ABCD 展開**：題幹上方小字列出 A/B/C/D 各自原文，避免只看 `(1)AB(2)CD` 不知選項內容
- [ ] **題目搜尋（Admin）**：按 keyword 過濾題目 / 選項 / 解析
- [ ] **答題歷程時間序列**：繪圖呈現每日 / 每週正確率曲線
- [ ] **錯題分「近期」vs「舊錯」**：`user_attempts.attempted_at` 過濾最近 N 天

## 🟡 低優 — Nice-to-have

- [ ] **題目收藏 / 筆記**：users 可對特定題目 pin / 加註記
- [ ] **PWA 離線**：service worker + manifest，手機可離線做題、可「加到主畫面」
- [ ] **Admin.jsx 拆分**：SortableRow / FailuresPanel / QuestionForm / Toolbar 獨立 component（現在 700+ 行）
- [ ] **Keyboard 快捷鍵（Quiz）**：1-4 鍵選擇、Enter 揭答 / 下一題
- [ ] **Dark mode toggle**
- [ ] **CLAUDE.md / README.md 更新**（schema 與 API 已大幅變動）

## 🚀 部署

- [ ] **Cloudflare Pages 正式部署**（git push 觸發）
- [ ] **Production D1 migration**：套用最新 `schema.sql`（新增 `users`、`user_attempts`、`import_failures` 表與 `source_number` / `correct_count` / `wrong_count` 欄位）
- [ ] **D1 備份策略**：`wrangler d1 export` 定期匯出到本機 / 雲端空間

## 🧹 技術債

- [ ] **寫測試**：至少 `fileParser` / auth API / attempts API 有 unit test
- [ ] **Code split**：`tesseract.js` / `pdfjs-dist` lazy load，現在 bundle 1.2 MB
- [ ] **統計 source of truth 統一**：目前 `questions.correct_count/wrong_count`（全站累計）和 `user_attempts`（per-user）並存，需決定誰為主；或清楚文件化雙軌用途
- [ ] **TypeScript 導入**（長期）

## 📄 還沒處理的題本

- [ ] `11409_外幣模擬卷(北二專屬)_.pdf`：答案在最後解答頁（不在同一 row），parser 需擴充從答案頁抽答
- [ ] `11409_共同科目模擬卷(北二專屬).pdf`：4 卷模擬試題結構特殊，需另寫 parser（若要準備共同科目）
- [ ] `11409_公會題庫(北二專屬).pdf` vs `.docx`：目前用 docx 抽 551 題，pdf 版未抽；若需驗證可另跑

---

**新增項目請加到對應區塊並標 `- [ ]`。完成後改成 `- [x]`。**
