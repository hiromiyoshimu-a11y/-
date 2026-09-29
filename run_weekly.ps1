# PubMed カテーテルアブレーション論文要約 自動実行 PowerShell スクリプト

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

$logDir = Join-Path $scriptPath "logs"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$logFile = Join-Path $logDir "execution.log"
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Add-Content -Path $logFile -Value "===================================================="
Add-Content -Path $logFile -Value " [週次タスク開始] $dateStr"
Add-Content -Path $logFile -Value "===================================================="

try {
    & "C:\Program Files\nodejs\node.exe" src/index.js *>> $logFile
    Add-Content -Path $logFile -Value "[SUCCESS] 完了しました。"
} catch {
    Add-Content -Path $logFile -Value "[ERROR] エラーが発生しました: $_"
}
