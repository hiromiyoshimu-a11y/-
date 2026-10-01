import fs from 'fs';
import path from 'path';

function cleanLines(text) {
  if (!text) return text;
  let s = String(text);
  // 連続する空白行・改行を単一改行に圧縮
  s = s.replace(/\n{2,}/g, '\n').trim();
  return s;
}

const filePaths = [
  path.resolve('public/papers.json'),
  path.resolve('outputs/papers.json')
];

for (const filePath of filePaths) {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let count = 0;
    if (data.papers && Array.isArray(data.papers)) {
      for (const p of data.papers) {
        if (p.abstractJa) {
          const orig = p.abstractJa;
          const cleaned = cleanLines(orig);
          if (orig !== cleaned) {
            p.abstractJa = cleaned;
            count++;
          }
        }
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[CleanLines] ${filePath}: ${count} papers updated.`);
  }
}
