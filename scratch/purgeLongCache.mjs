import fs from 'fs';

function purgeLongSummaries(filePath) {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data && Array.isArray(data.papers)) {
      const initialCount = data.papers.length;
      data.papers = data.papers.filter(p => {
        if (!p.summaryJa) return false;
        // 400文字を超える非常に長い要約は旧キャッシュとしてパージ
        return p.summaryJa.length <= 450;
      });
      console.log(`Purged ${initialCount - data.papers.length} long summary cache entries from ${filePath}. Remaining: ${data.papers.length}`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
  }
}

purgeLongSummaries('public/papers.json');
purgeLongSummaries('outputs/papers.json');
