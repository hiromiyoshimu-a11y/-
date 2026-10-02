import fs from 'fs';

function checkGrammar() {
  const data = JSON.parse(fs.readFileSync('public/papers.json', 'utf-8'));
  
  const badStart = data.papers.filter(p => p.summaryJa && /】[をがでにへより]/i.test(p.summaryJa));
  const badDesuMasu = data.papers.filter(p => p.summaryJa && /(?:です|ます|でした|行われました|されました)(?:[。.\s]|$)/i.test(p.summaryJa));

  console.log(`文頭が助詞スタートの論文数: ${badStart.length}`);
  badStart.forEach(p => console.log(`- PMID ${p.pmid}: ${p.summaryJa}`));

  console.log(`\n丁寧語が残留している論文数: ${badDesuMasu.length}`);
  badDesuMasu.forEach(p => console.log(`- PMID ${p.pmid}: ${p.summaryJa}`));
}

checkGrammar();
