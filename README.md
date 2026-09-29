# ⚡ カテーテル/パルスフィールドアブレーション & 不整脈 最新医学論文要約 & 自動化ワークフロー

PubMed APIより過去3ヶ月に出版された「カテーテルアブレーション（Catheter Ablation）」「パルスフィールドアブレーション（Pulsed Field Ablation / PFA）」「不整脈（Arrhythmia/Arrhythmias）」に関する最新医学論文を取得し、研究デザイン（RCT/前向き/症例数）に応じて自動ソートの上、**日本語5行程度**で要約。リンク・掲載日・雑誌情報・参考論文コピペ用出典形式（Vancouver形式）をまとめたExcel（`.xlsx`）を自動出力・指定メールへ自動送信するツールです。

---

## 🌟 新機能 & 仕様

1. **検索キーワードの拡張**:
   - カテーテルアブレーション (`catheter ablation`)
   - パルスフィールドアブレーション (`pulsed field ablation` / PFA)
   - 不整脈全般 (`arrhythmia` / `arrhythmias`)
2. **研究デザイン & 症例数による掲載順ソート**:
   - **無作為化比較試験 (RCT)** や **前向き研究 (Prospective Study)** で **症例数（N）が多いものを上位**に配置
   - **症例報告 (Case Report / Case Series)** は一番下（下位）に配置
3. **日本語5行程度（約250文字）要約**:
   - Google Gemini API（`gemini-1.5-flash`）を活用し、専門用語に対応した高品質な日本語5行要約（目的・対象・治療法・結果・臨床的結論）を自動生成。
4. **GitHub Actions 毎週月曜日 朝6:00 (JST) 自動実行**:
   - `cron: '0 21 * * 0'` (UTC 日曜日 21:00 = JST 月曜日 午前06:00) で定期全自動実行。
5. **指定アドレスへのメール自動送付**:
   - 生成されたExcelファイルを `hiromiyoshimu@gmail.com` へ自動添付送信。

---

## 📁 ディレクトリ構造

```
Antigravity 論文要約/
├── outputs/                                # 生成されたExcelファイル保存先
│   ├── Catheter_Ablation_Papers_YYYY-MM-DD.xlsx
│   └── latest_catheter_ablation_papers.xlsx  # 最新版ショートカット
├── src/
│   ├── pubmedFetcher.js                    # PubMed API検索・デザイン/症例数ソート
│   ├── summarizer.js                       # AI日本語5行要約処理
│   ├── excelGenerator.js                   # 研究デザインバッジ付きExcelJS整形
│   ├── mailer.js                           # メール自動送信モジュール
│   └── index.js                            # メイン実行ファイル
├── .github/workflows/
│   └── weekly_pubmed.yml                   # GitHub Actions 毎週月曜朝6:00自動実行
├── .env                                    # 設定ファイル (Gemini APIキー・メール送信先)
├── run_weekly.bat                          # Windows タスクスケジューラ用実行バッチ
├── package.json
└── README.md
```

---

## 🚀 スクリプトの即時実行

### 1. `.env` の設定
`GEMINI_API_KEY` を `.env` に設定します。
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
DAYS_PAST=90
MAX_RESULTS=50
NOTIFICATION_EMAIL=hiromiyoshimu@gmail.com
```

### 2. 実行コマンド
```bash
node src/index.js
```
実行後、`outputs/` に研究デザイン順にソートされたExcelファイルが生成されます。

---

## ⏰ GitHub Actions での毎週月曜 朝6:00 (JST) 自動実行手順

1. **GitHub リポジトリへ Push**:
   本プロジェクトを GitHub のリポジトリに Push します。

2. **GitHub Secrets の設定**:
   GitHub リポジトリの `Settings` > `Secrets and variables` > `Actions` に以下を登録します。
   - `GEMINI_API_KEY`: Google Gemini API キー
   - `SMTP_HOST`: 例 `smtp.gmail.com`
   - `SMTP_PORT`: 例 `587`
   - `SMTP_USER`: 送信元メールアドレス (例: `your.email@gmail.com`)
   - `SMTP_PASS`: Googleアカウントのアプリパスワード

3. **自動実行スケジュール**:
   毎週月曜日の朝 06:00 (JST) に自動でワークフローが起動し、PubMedから過去3ヶ月の論文を取得・5行要約・ソートして `hiromiyoshimu@gmail.com` 宛てにメール添付で届きます。
