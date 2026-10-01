import fs from 'fs';

function checkFundingInConclusion() {
  const data = JSON.parse(fs.readFileSync('public/papers.json', 'utf-8'));
  const dirty = data.papers.filter(p => 
    p.summaryJa && /【結論】.*?(?:資金提供|助成金|ClinicalTrials|NCT\d+)/gi.test(p.summaryJa)
  );

  console.log(`【結論】に資金提供・治験表記が残っている論文数: ${dirty.length}`);
  dirty.forEach(p => {
    console.log(`PMID: ${p.pmid} | SummaryJa:\n${p.summaryJa}`);
  });
}

checkFundingInConclusion();
