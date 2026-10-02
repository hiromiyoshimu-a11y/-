import fs from 'fs';
import { removeDesuMasuStrict } from '../src/summarizer.js';

function fixAllGrammar() {
  const patchMap = {
    '42801688': {
      summaryJa: [
        '【概要】心房細動 (AF) パルスフィールドアブレーション (PFA) における 3つの鎮静戦略 (EPスタッフ管理深い鎮静 / 麻酔看護師管理DS / 全身麻酔GA) の安全性と転帰の比較 (観察研究・その他 / N = 1,269例)',
        '【方法】2021〜2024年にペンタスプライン PFA を施行したデンマークの全 AF 患者1,269例を対象に、EPスタッフDS群 (661例)、麻酔看護師DS群 (173例)、全身麻酔GA群 (435例) の3群に層別化し周術期合併症と1年再発率を解析した',
        '【結果】全体として鎮静合併症は極めて少なく、鎮静副作用による中断は0件であった。1年時点の心房頻脈性不整脈の非再発率において、3つの鎮静群間で有意差は認められなかった',
        '【結論】EPスタッフによる深い鎮静 (EP-DS) は PFA 臨床現場で十分に実行可能であり、重大な有害事象率および遠隔期不整脈非再発率は麻酔科管理と同等に安全で有効であった'
      ].join('\n')
    }
  };

  ['public/papers.json', 'outputs/papers.json'].forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    data.papers.forEach(paper => {
      if (patchMap[paper.pmid]) {
        if (patchMap[paper.pmid].summaryJa) paper.summaryJa = patchMap[paper.pmid].summaryJa;
      } else if (paper.summaryJa) {
        // 各行について文頭の「を」排除＋丁寧語クリーニング
        paper.summaryJa = paper.summaryJa.split('\n').map(line => {
          const colonIdx = line.indexOf('】');
          if (colonIdx !== -1) {
            const prefix = line.slice(0, colonIdx + 1);
            let content = line.slice(colonIdx + 1);
            content = removeDesuMasuStrict(content);
            return prefix + content;
          }
          return removeDesuMasuStrict(line);
        }).join('\n');
      }

      if (paper.abstractJa) {
        paper.abstractJa = removeDesuMasuStrict(paper.abstractJa);
      }
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Updated and cleaned all grammar issues in ${filePath}`);
  });
}

fixAllGrammar();
