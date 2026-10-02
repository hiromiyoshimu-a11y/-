import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fetchCatheterAblationPapers } from './pubmedFetcher.js';
import { summarizePapers } from './summarizer.js';
import { generateExcelReport } from './excelGenerator.js';
import { generateJsonReport } from './jsonGenerator.js';
import { sendEmailNotification } from './mailer.js';

dotenv.config();

async function main() {
  console.log('====================================================');
  console.log(' 🩺 PubMed カテーテルアブレーション論文要約ワークフロー ');
  console.log('====================================================');

  const daysPast = parseInt(process.env.DAYS_PAST || '90', 10);
  const maxResults = parseInt(process.env.MAX_RESULTS || '100', 10);

  try {
    // 1. PubMedより論文データ取得
    const rawPapers = await fetchCatheterAblationPapers(daysPast, maxResults);
    
    if (rawPapers.length === 0) {
      console.log('該当する論文は見つかりませんでした。処理を終了します。');
      return;
    }

    // 2. 抄録の日本語要約処理
    const summarizedPapers = await summarizePapers(rawPapers);

    // 3. Webアプリ用 JSON データファイル出力
    generateJsonReport(summarizedPapers, 'public/papers.json');
    generateJsonReport(summarizedPapers, 'outputs/papers.json');

    // 3. Excelファイル出力
    const todayStr = new Date().toISOString().split('T')[0];
    const outputDir = path.resolve('outputs');
    let datedFileName = `Catheter_Ablation_Papers_${todayStr}.xlsx`;
    let datedFilePath = path.join(outputDir, datedFileName);
    const latestFilePath = path.join(outputDir, 'latest_catheter_ablation_papers.xlsx');

    // ファイルが開かれてロックされている場合への安全対応
    try {
      await generateExcelReport(summarizedPapers, datedFilePath);
    } catch (err) {
      if (err.code === 'EBUSY') {
        const timestamp = Date.now();
        datedFileName = `Catheter_Ablation_Papers_${todayStr}_${timestamp}.xlsx`;
        datedFilePath = path.join(outputDir, datedFileName);
        console.warn(`[Main] 元のファイルが開かれているため、別名で保存します: ${datedFilePath}`);
        await generateExcelReport(summarizedPapers, datedFilePath);
      } else {
        throw err;
      }
    }

    // 最新版としてコピーを作成（ロックされている場合はスキップ/別名）
    try {
      fs.copyFileSync(datedFilePath, latestFilePath);
      console.log(`[Main] 最新版ファイルを作成しました: ${latestFilePath}`);
    } catch {
      console.warn(`[Main] latest_catheter_ablation_papers.xlsx が開かれているためコピーをスキップしました。`);
    }

    // 4. メール通知 (環境変数設定時のみ)
    await sendEmailNotification(datedFilePath, summarizedPapers.length);

    console.log('\n✅ 処理が完了しました！');
    console.log(`📄 生成ファイル: ${datedFilePath}`);
  } catch (err) {
    console.error('❌ エラーが発生しました:', err);
    process.exit(1);
  }
}

main();
