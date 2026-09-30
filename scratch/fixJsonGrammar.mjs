import fs from 'fs';
import path from 'path';

function cleanText(text) {
  if (!text) return text;
  let cleaned = text;
  
  // 1. 文法崩れ置換
  cleaned = cleaned.replace(/ませんでしたであった/g, 'なかった');
  cleaned = cleaned.replace(/ませんでした/g, 'なかった');
  cleaned = cleaned.replace(/れませんでした/g, 'れなかった');
  cleaned = cleaned.replace(/ではありませんであった/g, 'ではなかった');
  cleaned = cleaned.replace(/ではありません/g, 'ではない');
  cleaned = cleaned.replace(/ありませんでした/g, 'なかった');
  cleaned = cleaned.replace(/機能しる/g, '機能する');
  cleaned = cleaned.replace(/確立しる/g, '確立する');
  cleaned = cleaned.replace(/でを認めた/g, 'で認めた');
  cleaned = cleaned.replace(/をを/g, 'を');
  cleaned = cleaned.replace(/がを/g, 'が');
  cleaned = cleaned.replace(/にを/g, 'に');
  cleaned = cleaned.replace(/でを/g, 'で');
  cleaned = cleaned.replace(/でした/g, 'であった');
  cleaned = cleaned.replace(/でしたであった/g, 'であった');
  cleaned = cleaned.replace(/でありました/g, 'であった');
  cleaned = cleaned.replace(/ありました/g, 'あった');
  cleaned = cleaned.replace(/見られました/g, '見られた');
  cleaned = cleaned.replace(/得られました/g, '得られた');
  cleaned = cleaned.replace(/示されました/g, '示された');
  cleaned = cleaned.replace(/報告されました/g, '報告された');
  cleaned = cleaned.replace(/行われました/g, '行われた');
  cleaned = cleaned.replace(/評価されました/g, '評価された');
  cleaned = cleaned.replace(/観察されました/g, '観察された');

  // 二重化防止
  cleaned = cleaned.replace(/であったであった/g, 'であった');
  cleaned = cleaned.replace(/であったあった/g, 'であった');

  return cleaned;
}

const filePaths = [
  path.resolve('public/papers.json'),
  path.resolve('outputs/papers.json')
];

for (const filePath of filePaths) {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let fixCount = 0;
    if (data.papers && Array.isArray(data.papers)) {
      for (const p of data.papers) {
        ['summaryJa', 'abstractJa', 'titleJa'].forEach(field => {
          if (p[field]) {
            const orig = p[field];
            const cleaned = cleanText(orig);
            if (orig !== cleaned) {
              p[field] = cleaned;
              fixCount++;
            }
          }
        });
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Cleaned ${filePath}: ${fixCount} fields fixed.`);
  }
}
