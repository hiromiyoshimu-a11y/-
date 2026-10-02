import fs from 'fs';

const jsonPath1 = 'public/papers.json';
const jsonPath2 = 'outputs/papers.json';

function purgeFile(filePath) {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data && Array.isArray(data.papers)) {
      const initialCount = data.papers.length;
      data.papers = data.papers.filter(p => {
        if (!p.summaryJa) return false;
        return !p.summaryJa.includes('本手法の臨床的有用性を示唆') &&
               !p.summaryJa.includes('PubMed抄録未掲載') &&
               !p.summaryJa.includes('詳細数値はPubMed原文を参照') &&
               !p.summaryJa.includes('検証結果は原文を参照') &&
               !p.summaryJa.includes('関連プロトコル');
      });
      console.log(`Purged ${initialCount - data.papers.length} bad cache entries from ${filePath}`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
  }
}

purgeFile(jsonPath1);
purgeFile(jsonPath2);
