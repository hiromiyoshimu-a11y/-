@echo off
chcp 65001 > NUL
setlocal

:: カレントディレクトリをスクリプトが存在するフォルダーに設定
cd /d "%~dp0"

echo ====================================================
echo  PubMed カテーテルアブレーション論文要約 週次自動実行
echo  実行日時: %DATE% %TIME%
echo ====================================================

:: ログディレクトリの作成
if not exist logs mkdir logs

:: Node.jsスクリプトの実行とログ保存
"C:\Program Files\nodejs\node.exe" src/index.js >> logs\execution.log 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] 週次レポート生成が完了しました。
) else (
    echo [ERROR] エラーが発生しました。logs\execution.log を確認してください。
)

endlocal
