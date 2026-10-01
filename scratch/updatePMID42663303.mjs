import fs from 'fs';

function fixPmid42663303() {
  const patch = {
    '42663303': {
      titleJa: '中等度脳卒中リスクを伴う心房細動に対する経口抗凝固療法',
      summaryJa: [
        '【概要】中等度脳卒中リスク (CHADS-VASc 1点[男性]/2点[女性]) を伴う心房細動 (AF) 患者における DOAC 療法の有効性と安全性の検証 (無作為化比較試験 (RCT) / N = 1,803例)',
        '【方法】韓国の多数の施設において、中等度脳卒中リスクの AF 患者1,803例を DOAC 投与群 (902例) と抗凝固非投与群 (901例) に1:1でランダム化割り付けし、24ヶ月間の追跡評価を実施した',
        '【結果】24ヶ月時点の主要複合エンドポイント発生率は DOAC 群 0.5% (4例) に対し非抗凝固群 1.5% (13例) であり、DOAC 群で有意に低かった (ハザード比 0.31; 95% CI: 0.10–0.94; P = 0.03)',
        '【結論】中等度脳卒中リスクを伴う心房細動患者において、DOAC 療法は抗凝固非投与と比較して24ヶ月時点の脳卒中・塞栓症・主要複合イベント発生リスクを有意に低下させた'
      ].join('\n'),
      abstractJa: [
        '【背景】\n米国および欧州の主要ガイドラインでは、脳卒中リスクが中程度（CHADS-VASc スコア 男性1点・女性2点）の心房細動（AF）患者に対する経口抗凝固療法をクラス IIa 適応として推奨しているが、無作為化比較試験（RCT）による確固たる検証エビデンスが不足していた。',
        '【方法】\n韓国の多施設において、中等度脳卒中リスクの AF 患者1,803例を対象とした非盲検優越性 RCT（SINGLE-AF 試験）を実施した。対象者を直接作用型経口抗凝固薬（DOAC）群（902例）または抗凝固療法非投与群（901例）に1:1の割合でランダムに割り付けた。主要エンドポイントは24ヶ月時点での脳卒中、全身性塞栓症、大出血、心血管死の複合発生率とした。',
        '【結果】\n24ヶ月の追跡期間において、主要エンドポイントは DOAC 群で 4例（累積発生率 0.5%）、非抗凝固群で 13例（累積発生率 1.5%）に発生し、DOAC 群でリスクが有意に低下した（差 -1.0パーセントポイント; 95% CI: -2.0〜-0.1; P = 0.03; ハザード比 0.31; 95% CI: 0.10〜0.94）。脳卒中発症は DOAC 群 3例（0.3%）、非抗凝固群 10例（1.1%）であった。大出血および重篤な有害事象の発生率は両群間で同等であり、心血管死は認められなかった。',
        '【結論】\n中等度脳卒中リスクを伴う心房細動患者において、DOAC 療法は抗凝固療法を行わない場合と比較して、24ヶ月時点での脳卒中、全身性塞栓症、大出血、心血管死のリスクを有意に低下させることが実証された。'
      ].join('\n\n')
    }
  };

  ['public/papers.json', 'outputs/papers.json'].forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // 全論文の結論から資金提供・治験番号表記をクリーニング
    data.papers.forEach(paper => {
      if (patch[paper.pmid]) {
        paper.titleJa = patch[paper.pmid].titleJa;
        paper.summaryJa = patch[paper.pmid].summaryJa;
        paper.abstractJa = patch[paper.pmid].abstractJa;
      } else if (paper.summaryJa) {
        paper.summaryJa = paper.summaryJa.replace(/\([^\)]*(?:資金提供|助成金|ClinicalTrials|NCT\d+|治験番号)[^\)]*\)/gi, '').trim();
      }
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Updated ${filePath}`);
  });
}

fixPmid42663303();
