import fs from 'fs';
import path from 'path';

/**
 * 論文データ配列を Web アプリ用の JSON データファイルに保存
 * 前回のデータと比較し、新しく追加された論文に isNew: true フラグを自動付与
 * @param {Array} papers 論文データ
 * @param {string} outputPath 保存先パス
 */
export function generateJsonReport(papers, outputPath = 'public/papers.json') {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  let existingPmids = new Set();
  let existingPaperMap = new Map();

  // 既存データが存在する場合は読み込んでPMIDリストと初回追加日を照合
  if (fs.existsSync(outputPath)) {
    try {
      const prevData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      if (prevData && Array.isArray(prevData.papers)) {
        prevData.papers.forEach(p => {
          existingPmids.add(String(p.pmid));
          existingPaperMap.set(String(p.pmid), p);
        });
      }
    } catch {}
  }

  let newCount = 0;
  const processedPapers = papers.map(paper => {
    const pmidStr = String(paper.pmid);
    const isBrandNew = !existingPmids.has(pmidStr);

    let firstSeen = todayStr;
    if (!isBrandNew && existingPaperMap.has(pmidStr)) {
      firstSeen = existingPaperMap.get(pmidStr).firstSeen || todayStr;
    }

    // 初回データ生成時、または前回のデータに存在しなかった論文を isNew: true とする
    const isNew = isBrandNew || (existingPmids.size === 0) || (firstSeen === todayStr);
    if (isNew) newCount++;

    return {
      ...paper,
      isNew,
      firstSeen
    };
  });

  const payload = {
    updatedAt: todayStr,
    totalCount: processedPapers.length,
    newCount: newCount,
    papers: processedPapers
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[JSON Generator] Webアプリ用データファイルを生成しました (新着: ${newCount}件): ${outputPath}`);
  return outputPath;
}
