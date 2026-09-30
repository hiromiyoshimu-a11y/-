import fs from 'fs';
import path from 'path';

function formatAbstractJa(text) {
  if (!text) return text;
  let s = String(text).trim();

  // 見出し表記の統一と改行の挿入
  s = s.replace(/(?:背景・目的|背景\/目的)[:：]/g, '\n\n【背景・目的】\n')
       .replace(/(?:背景)[:：]/g, '\n\n【背景】\n')
       .replace(/(?:目的)[:：]/g, '\n\n【目的】\n')
       .replace(/(?:方法|対象・方法|対象と方法)[:：]/g, '\n\n【方法】\n')
       .replace(/(?:結果|成績)[:：]/g, '\n\n【結果】\n')
       .replace(/(?:結論|考察)[:：]/g, '\n\n【結論】\n')
       .replace(/【(背景|目的|方法|結果|結論|背景・目的)】/g, '\n\n【$1】\n');

  // 先頭の余分な改行を削除
  s = s.replace(/^\s+/, '');
  // 連続する空行を2行までに整形
  s = s.replace(/\n{3,}/g, '\n\n');

  return s;
}

function cleanText(text) {
  if (!text) return text;
  let cleaned = text;
  cleaned = cleaned.replace(/ませんでしたであった/g, 'なかった');
  cleaned = cleaned.replace(/ませんでした/g, 'なかった');
  cleaned = cleaned.replace(/れませんでした/g, 'れなかった');
  cleaned = cleaned.replace(/ではありませんでしたであった/g, 'ではなかった');
  cleaned = cleaned.replace(/ではありませんでした/g, 'ではなかった');
  cleaned = cleaned.replace(/ではありません/g, 'ではない');
  cleaned = cleaned.replace(/ありませんでした/g, 'なかった');
  cleaned = cleaned.replace(/機能しる/g, '機能する');
  cleaned = cleaned.replace(/確立しる/g, '確立する');
  cleaned = cleaned.replace(/でを認めた/g, 'で認めた');
  cleaned = cleaned.replace(/をを/g, 'を');
  cleaned = cleaned.replace(/がを/g, 'が');
  cleaned = cleaned.replace(/にを/g, 'に');
  cleaned = cleaned.replace(/でを/g, 'で');
  cleaned = cleaned.replace(/でしたであった/g, 'であった');
  cleaned = cleaned.replace(/であったであった/g, 'であった');
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
        if (p.abstractJa) {
          const orig = p.abstractJa;
          const formatted = cleanText(formatAbstractJa(orig));
          if (orig !== formatted) {
            p.abstractJa = formatted;
            fixCount++;
          }
        }
        if (p.summaryJa) {
          p.summaryJa = cleanText(p.summaryJa);
        }
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Formatted ${filePath}: ${fixCount} abstracts updated.`);
  }
}
