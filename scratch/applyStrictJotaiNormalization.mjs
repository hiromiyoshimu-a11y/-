import fs from 'fs';
import { generateJsonReport } from '../src/jsonGenerator.js';
import { generateExcelReport } from '../src/excelGenerator.js';

export function normalizeJotaiStyle(text) {
  if (!text) return '';
  let s = String(text);

  // ==========================================
  // 1. 崩れた「〜しる」「ありる」の徹底修復
  // ==========================================
  s = s.replace(/可能性がありる/g, '可能性がある');
  s = s.replace(/([でとも])ありる/g, '$1ある');
  s = s.replace(/ありる(?=[。、\n\r\t 　\)]|$)/g, 'ある');
  s = s.replace(/ありる/g, 'ある');
  s = s.replace(/([高低大少重軽長短深浅明確有意])くなりる/g, '$1くなる');
  
  // 動詞の「〜しる」誤変換
  s = s.replace(/示しる/g, '示す');
  s = s.replace(/生じしる/g, '生じる');
  s = s.replace(/達しる/g, '達する');
  s = s.replace(/要しる/g, '要する');
  s = s.replace(/満たしる/g, '満たす');
  s = s.replace(/見出しる/g, '見出す');
  s = s.replace(/及ぼしる/g, '及ぼす');
  s = s.replace(/果たしる/g, '果たす');
  s = s.replace(/減らしる/g, '減らす');
  s = s.replace(/増やしる/g, '増やす');
  s = s.replace(/もたらしる/g, 'もたらす');
  s = s.replace(/引き起こしる/g, '引き起こす');
  s = s.replace(/関与しる/g, '関与する');
  s = s.replace(/存在しる/g, '存在する');
  s = s.replace(/行いる/g, '行う');
  s = s.replace(/伴いる/g, '伴う');
  s = s.replace(/従いる/g, '従う');
  s = s.replace(/導きる/g, '導く');
  s = s.replace(/([一-龠]{2,})しる/g, '$1する');

  // ==========================================
  // 2. 進行・完了の丁寧語（〜ています、〜ていました 等）
  // ==========================================
  s = s.replace(/([てで])います/g, '$1いる');
  s = s.replace(/([てで])いました/g, '$1いた');
  s = s.replace(/([てで])おります/g, '$1いる');
  s = s.replace(/([てで])おりました/g, '$1いた');

  // ==========================================
  // 3. 過去丁寧語（〜ました）の完全常体化（〜た）
  // ==========================================
  // 受動・使役・可能
  s = s.replace(/されました/g, 'された');
  s = s.replace(/せられました/g, 'せられた');
  s = s.replace(/られました/g, 'られた');
  s = s.replace(/見られました/g, '認めた');
  s = s.replace(/認められました/g, '認めた');
  s = s.replace(/考えられました/g, '考えられた');
  s = s.replace(/思われました/g, '思われた');
  s = s.replace(/望まれました/g, '望まれた');
  s = s.replace(/求められました/g, '求められた');
  s = s.replace(/含まれました/g, '含まれた');
  s = s.replace(/得られました/g, '得られた');
  s = s.replace(/生まれました/g, '生まれた');

  // サ変動詞（漢字2文字以上＋しました、カタカナ語＋しました、〜としました）
  s = s.replace(/([一-龠]{2,})しました/g, '$1した');
  s = s.replace(/([ァ-ヴー]+)しました/g, '$1した');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)としました/g, '$1とした');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)ですが/g, '$1であるが');
  s = s.replace(/([一-龠ぁ-んァ-ヴー]+)でしたが/g, '$1であったが');

  // 五段・一段動詞の過去形
  s = s.replace(/満たしました/g, '満たした');
  s = s.replace(/示しました/g, '示した');
  s = s.replace(/見出しました/g, '見出した');
  s = s.replace(/行いました/g, '行った');
  s = s.replace(/伴いました/g, '伴った');
  s = s.replace(/用いました/g, '用いた');
  s = s.replace(/従いました/g, '従った');
  s = s.replace(/基づきました/g, '基づいた');
  s = s.replace(/導きました/g, '導いた');
  s = s.replace(/続きました/g, '続いた');
  s = s.replace(/防ぎました/g, '防いだ');
  s = s.replace(/要しました/g, '要した');
  s = s.replace(/達しました/g, '達した');
  s = s.replace(/生じました/g, '生じた');
  s = s.replace(/認めました/g, '認めた');
  s = s.replace(/ありました/g, 'あった');
  s = s.replace(/なりました/g, 'なった');
  s = s.replace(/できました/g, 'できた');
  s = s.replace(/減らしました/g, '減らした');
  s = s.replace(/増やしました/g, '増やした');
  s = s.replace(/及ぼしました/g, '及ぼした');
  s = s.replace(/もたらしました/g, 'もたらした');
  s = s.replace(/果たしました/g, '果たした');
  s = s.replace(/目指しました/g, '目指した');
  s = s.replace(/引き起こしました/g, '引き起こした');
  s = s.replace(/一致しました/g, '一致した');
  s = s.replace(/試みました/g, '試みた');
  s = s.replace(/除外しました/g, '除外した');
  s = s.replace(/割り当てました/g, '割り当てた');

  // ==========================================
  // 4. 現在丁寧語（〜ます）の完全常体化（〜る・〜す 等）
  // ==========================================
  s = s.replace(/されます/g, 'される');
  s = s.replace(/せられます/g, 'せられる');
  s = s.replace(/られます/g, 'られる');
  s = s.replace(/見られます/g, '認める');
  s = s.replace(/認められます/g, '認める');
  s = s.replace(/考えられます/g, '考えられる');
  s = s.replace(/思われます/g, '思われる');
  s = s.replace(/望まれます/g, '望まれる');
  s = s.replace(/求められます/g, '求められる');
  s = s.replace(/含まれます/g, '含まれる');
  s = s.replace(/得られます/g, '得られる');

  // サ変動詞（漢字2文字以上＋します、カタカナ語＋します）
  s = s.replace(/([一-龠]{2,})します/g, '$1する');
  s = s.replace(/([ァ-ヴー]+)します/g, '$1する');

  // 五段・一段動詞の現在形
  s = s.replace(/可能性があります/g, '可能性がある');
  s = s.replace(/([高低大少重軽長短深浅明確有意])くなります/g, '$1くなる');
  s = s.replace(/あります/g, 'ある');
  s = s.replace(/満たします/g, '満たす');
  s = s.replace(/示します/g, '示す');
  s = s.replace(/見出します/g, '見出す');
  s = s.replace(/行います/g, '行う');
  s = s.replace(/伴います/g, '伴う');
  s = s.replace(/用います/g, '用いる');
  s = s.replace(/従います/g, '従う');
  s = s.replace(/基づきます/g, '基づく');
  s = s.replace(/導きます/g, '導く');
  s = s.replace(/続きます/g, '続く');
  s = s.replace(/防ぎます/g, '防ぐ');
  s = s.replace(/要します/g, '要する');
  s = s.replace(/達します/g, '達する');
  s = s.replace(/生じます/g, '生じる');
  s = s.replace(/認めます/g, '認める');
  s = s.replace(/なります/g, 'なる');
  s = s.replace(/できます/g, 'できる');
  s = s.replace(/減らします/g, '減らす');
  s = s.replace(/増やします/g, '増やす');
  s = s.replace(/及ぼします/g, '及ぼす');
  s = s.replace(/もたらします/g, 'もたらす');
  s = s.replace(/果たします/g, '果たす');
  s = s.replace(/目指します/g, '目指す');
  s = s.replace(/引き起こします/g, '引き起こす');
  s = s.replace(/一致します/g, '一致する');
  s = s.replace(/試みます/g, '試みる');
  s = s.replace(/除外します/g, '除外する');
  s = s.replace(/割り当てます/g, '割り当てる');

  // ==========================================
  // 5. 判断・指定・否定（〜です、〜でした、〜ません 等）
  // ==========================================
  s = s.replace(/でした/g, 'であった');
  s = s.replace(/ではありません/g, 'ではない');
  s = s.replace(/ではありませんでした/g, 'ではなかった');
  s = s.replace(/ではないであった/g, 'ではなかった');
  s = s.replace(/ではありない/g, 'ではない');
  s = s.replace(/ありませんでした/g, 'なかった');
  s = s.replace(/ありないであった/g, 'なかった');
  s = s.replace(/ありません/g, 'ない');
  s = s.replace(/ありない/g, 'ない');
  s = s.replace(/ないであった/g, 'なかった');
  s = s.replace(/ませんでした/g, 'なかった');
  s = s.replace(/ません/g, 'ない');
  s = s.replace(/です(?=[。、\n\r\t 　\)]|$)/g, 'である');
  s = s.replace(/ます(?=[。、\n\r\t 　\)]|$)/g, 'る');

  // ==========================================
  // 6. 結論・考察定型句の整理
  // ==========================================
  s = s.replace(/と結論づけられました/g, 'と結論された');
  s = s.replace(/と結論付けられました/g, 'と結論された');
  s = s.replace(/と結論づけられた/g, 'と結論された');
  s = s.replace(/と結論付けられた/g, 'と結論された');
  s = s.replace(/と結論づけられる/g, 'と結論される');
  s = s.replace(/と結論付けられる/g, 'と結論される');
  s = s.replace(/結論づけられました/g, '結論された');
  s = s.replace(/結論付けられました/g, '結論された');
  s = s.replace(/結論づけられた/g, '結論された');
  s = s.replace(/結論付けられた/g, '結論された');
  s = s.replace(/結論づけられる/g, '結論される');
  s = s.replace(/結論付けられる/g, '結論される');

  // 重複修復
  s = s.replace(/であったであった/g, 'であった');
  s = s.replace(/であるである/g, 'である');
  s = s.replace(/されたされた/g, 'された');
  s = s.replace(/認めた認めた/g, '認めた');

  return s;
}

async function run() {
  console.log('🚀 全論文データの「常体（である調）・体言止め」徹底正規化を開始します...');
  const data = JSON.parse(fs.readFileSync('public/papers.json', 'utf-8'));
  const papers = data.papers;

  let sumCount = 0;
  let absCount = 0;

  papers.forEach(p => {
    if (p.summaryJa) {
      const orig = p.summaryJa;
      p.summaryJa = normalizeJotaiStyle(orig);
      if (orig !== p.summaryJa) sumCount++;
    }
    if (p.abstractJa) {
      const orig = p.abstractJa;
      p.abstractJa = normalizeJotaiStyle(orig);
      if (orig !== p.abstractJa) absCount++;
    }
    if (p.titleJa) {
      p.titleJa = normalizeJotaiStyle(p.titleJa);
    }
  });

  console.log(`✓ 修正された summaryJa: ${sumCount}件 / 全${papers.length}件`);
  console.log(`✓ 修正された abstractJa: ${absCount}件 / 全${papers.length}件`);

  // 添付画像の対象論文（PMID: 42859517 JoA）の確認
  const imgPaper = papers.find(p => String(p.pmid) === '42859517');
  if (imgPaper) {
    console.log('\n================== 添付画像論文 (PMID 42859517 JoA) ==================');
    console.log(imgPaper.summaryJa);
    console.log('====================================================================\n');
  }

  // 「満たしました」が含まれていた代表論文（PMID: 42364049）の確認
  const p42364049 = papers.find(p => String(p.pmid) === '42364049');
  if (p42364049) {
    console.log('================== PMID 42364049 (満たしました修復) ==================');
    console.log(p42364049.summaryJa);
    console.log('====================================================================\n');
  }

  data.updatedAt = new Date().toISOString();

  generateJsonReport(data.papers, 'public/papers.json');
  generateJsonReport(data.papers, 'dist/papers.json');
  generateJsonReport(data.papers, 'outputs/papers.json');

  const todayStr = new Date().toISOString().split('T')[0];
  await generateExcelReport(data.papers, `outputs/Catheter_Ablation_Papers_${todayStr}.xlsx`);
  await generateExcelReport(data.papers, `outputs/latest_catheter_ablation_papers.xlsx`);

  console.log('💾 全ファイルへの書き出しが完了しました！');
}

run().catch(console.error);
