#!/usr/bin/env zsh

# ====================================================
# PubMed カテーテルアブレーション論文要約 週次自動実行 (macOS用)
# ====================================================

# スクリプトの存在するディレクトリへ移動
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# NVM および Node.js 環境の読み込み
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
fi

# Homebrew PATH (もしあれば)
if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

echo "===================================================="
echo " PubMed カテーテルアブレーション論文要約 自動実行"
echo " 実行日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo " 実行ディレクトリ: $SCRIPT_DIR"
echo " Node.js バージョン: $(node -v 2>/dev/null || echo 'Not Found')"
echo "===================================================="

# ログディレクトリの作成
mkdir -p logs

# Node.jsスクリプトの実行とログ保存
LOG_FILE="logs/execution.log"
echo "----------------------------------------------------" >> "$LOG_FILE"
echo " [タスク開始] $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "----------------------------------------------------" >> "$LOG_FILE"

node src/index.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[SUCCESS] レポート生成が正常に完了しました。"
    echo "[SUCCESS] 完了: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
else
    echo "[ERROR] エラーが発生しました (終了コード: $EXIT_CODE)。"
    echo "[ERROR] 詳細は $LOG_FILE を確認してください。"
    echo "[ERROR] 異常終了: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
fi

exit $EXIT_CODE
