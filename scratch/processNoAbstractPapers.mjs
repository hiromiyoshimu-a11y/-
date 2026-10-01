import fs from 'fs';
import path from 'path';
import { fetchFreeArticleFullText, summarizeFromFullText } from '../src/freeArticleFetcher.js';

function cleanDesuMasu(text) {
  if (!text) return '';
  let s = String(text).trim();
  s = s.replace(/でした/g, 'であった')
       .replace(/されました/g, 'された')
       .replace(/行いました/g, 'を実施した')
       .replace(/評価しました/g, 'を評価した')
       .replace(/観察されました/g, 'を認めた')
       .replace(/示されました/g, 'を示した')
       .replace(/確認されました/g, 'を確認した')
       .replace(/認められました/g, 'を認めた')
       .replace(/です([。.\s]|$)/g, 'である$1')
       .replace(/ます([。.\s]|$)/g, 'る$1');
  return s;
}

async function main() {
  const filePaths = [
    path.resolve('public/papers.json'),
    path.resolve('outputs/papers.json')
  ];

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!data.papers || !Array.isArray(data.papers)) continue;

    console.log(`[ProcessNoAbstract] ${filePath} 内の「抄録なし」論文をスキャン中...`);
    let updatedCount = 0;

    for (const paper of data.papers) {
      const isNoAbstract = !paper.abstract ||
                           paper.abstract.includes('抄録なし') ||
                           paper.abstractJa?.includes('抄録が掲載されていません') ||
                           String(paper.pmid) === '42248313'; // ユーザー指定のPMID 42248313

      if (!isNoAbstract) continue;

      console.log(`\n🔍 「抄録なし」検出: PMID ${paper.pmid} - ${paper.title.slice(0, 40)}...`);

      // 1. Free Article / 全文テキストの取得
      const fullText = await fetchFreeArticleFullText(paper.pmid);

      if (fullText) {
        console.log(`🤖 全文テキスト取得成功！ Gemini API でAI要約を作成中...`);
        const aiResult = await summarizeFromFullText(paper, fullText);

        if (aiResult) {
          paper.summaryJa = cleanDesuMasu(aiResult.summaryJa);
          paper.abstractJa = cleanDesuMasu(aiResult.abstractJa);
          updatedCount++;
          console.log(`✅ PMID ${paper.pmid} の要約更新成功！`);
          console.log(`【要約】:\n${paper.summaryJa}`);
        }
      } else {
        console.log(`⚠️ PMID ${paper.pmid} は Free Article のオープンテキストが発見できませんでした。`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n🎉 [ProcessNoAbstract] ${filePath}: ${updatedCount}件の論文の要約を新しく生成・更新しました！`);
  }
}

main();
