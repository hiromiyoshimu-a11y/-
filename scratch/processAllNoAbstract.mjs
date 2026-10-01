import fs from 'fs';
import { fetchFreeArticleFullText, summarizeFromFullText } from '../src/freeArticleFetcher.js';
import dotenv from 'dotenv';
dotenv.config();

async function processAllDummyPapers() {
  const dataPath = 'public/papers.json';
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  const dummyPapers = data.papers.filter(p => 
    !p.abstract || 
    p.abstract.includes('抄録なし') || 
    (p.summaryJa && p.summaryJa.includes('PubMed抄録未掲載論文'))
  );

  console.log(`全 ${dummyPapers.length} 件の抄録未掲載論文の本文自動取得と要約処理を開始します...`);

  for (let i = 0; i < dummyPapers.length; i++) {
    const paper = dummyPapers[i];
    // PMID 42248313 と 42019791 はすでに手動高品質更新済み
    if (paper.pmid === '42248313' || paper.pmid === '42019791') {
      console.log(`[Skip] PMID ${paper.pmid} は高品質要約作成済み。スキップします。`);
      continue;
    }

    console.log(`\n(${i + 1}/${dummyPapers.length}) Processing PMID ${paper.pmid}: ${paper.title}`);
    const fullText = await fetchFreeArticleFullText(paper.pmid, paper.doi, paper.title);
    if (fullText) {
      const summaryResult = await summarizeFromFullText(paper, fullText);
      if (summaryResult && summaryResult.summaryJa) {
        paper.summaryJa = summaryResult.summaryJa;
        paper.abstractJa = summaryResult.abstractJa;
        console.log(`✅ PMID ${paper.pmid} 要約成功！`);
      }
    } else {
      console.log(`⚠️ PMID ${paper.pmid} 本文取得失敗`);
    }
  }

  fs.writeFileSync('public/papers.json', JSON.stringify(data, null, 2), 'utf-8');
  fs.writeFileSync('outputs/papers.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log('\n🎉 public/papers.json および outputs/papers.json の更新完了！');
}

processAllDummyPapers();
