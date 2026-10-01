import fs from 'fs';

function checkNoAbstract() {
  const data = JSON.parse(fs.readFileSync('public/papers.json', 'utf-8'));
  const dummyPapers = data.papers.filter(p => 
    !p.abstract || 
    p.abstract.includes('抄録なし') || 
    (p.summaryJa && p.summaryJa.includes('PubMed抄録未掲載論文'))
  );

  console.log(`抄録未掲載・ダミー要約論文の件数: ${dummyPapers.length} / ${data.papers.length}`);
  dummyPapers.forEach(p => {
    console.log(`PMID: ${p.pmid} | Title: ${p.title.slice(0, 50)}...`);
  });
}

checkNoAbstract();
