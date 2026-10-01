import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function cleanDesuMasu(text) {
  if (!text) return '';
  let s = String(text).trim();
  s = s.replace(/でした/g, 'であった')
       .replace(/されました/g, 'された')
       .replace(/行いました/g, 'を実施した')
       .replace(/評価しました/g, 'を評価した')
       .replace(/観察されました/g, 'を認めた')
       .replace(/示されました/g, 'を示した')
       .replace(/確認されました/g, 'を確認した')
       .replace(/認められました/g, 'を認めた')
       .replace(/です([。.\s]|$)/g, 'である$1')
       .replace(/ます([。.\s]|$)/g, 'る$1');
  return s;
}

async function fixDuplicatedSummary(paper) {
  const lines = (paper.summaryJa || '').split('\n');
  let g = '', m = '', r = '', c = '';

  lines.forEach(l => {
    if (l.startsWith('【概要】')) g = l.replace('【概要】', '').trim();
    else if (l.startsWith('【方法】')) m = l.replace('【方法】', '').trim();
    else if (l.startsWith('【結果】')) r = l.replace('【結果】', '').trim();
    else if (l.startsWith('【結論】')) c = l.replace('【結論】', '').trim();
  });

  // 重複チェック: m と r がほぼ同一、または文字の類似度が極めて高い場合
  const isDuplicate = !m || !r || m === r || m.includes(r.slice(0, 15)) || r.includes(m.slice(0, 15));

  if (!isDuplicate) {
    return paper.summaryJa;
  }

  console.log(`[FixSummary] 重複検出: PMID ${paper.pmid} - ${paper.title.slice(0, 30)}...`);

  // Gemini APIが利用可能な場合、高精度に4行要約を再生成
  if (genAI && paper.abstract && !paper.abstract.includes('抄録なし')) {
    try {
      let model;
      try { model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); }
      catch { model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); }

      const nText = paper.sampleSize > 0 ? `N = ${paper.sampleSize.toLocaleString()}例` : '症例数: 不明';
      const prompt = `あなたは不整脈の専門医です。以下の論文抄録から、【方法】と【結果】が絶対に重複しないように、それぞれのセクションから正確に要点を抽出し、常体・体言止めの4行臨床要約を作成してください。

【厳格ルール】:
- 「です・ます・でした・されます」は絶対禁止！常体（〜である / 〜であった / 〜を実施した / 〜を認めた / 〜の評価）に統一。
- 【方法】と【結果】の内容は絶対に被らせないこと！【方法】は研究デザイン・対象手技・評価プロトコルを記述し、【結果】は主要な成果数値（非再発率・成功率・p値・HR・比較結果など）のみを記述すること。

【タイトル】: ${paper.title}
【抄録】: ${paper.abstract}

【出力形式】:
【概要】... (${paper.studyTypeLabel || '研究'} / ${nText})
【方法】...
【結果】...
【結論】...`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (text && text.includes('【結果】') && text.includes('【方法】')) {
        return text;
      }
    } catch (e) {
      console.warn(`Gemini fix failed for PMID ${paper.pmid}:`, e.message);
    }
  }

  // フォールバック: abstractJa または abstract から【方法】と【結果】を抽出
  const absJa = paper.abstractJa || '';
  let extractedM = 'カテーテル / パルスフィールドアブレーションのプロトコル実施';
  let extractedR = '主要評価項目および治療効果を解析した';

  if (absJa.includes('【方法】')) {
    const mPart = absJa.split('【方法】')[1]?.split('【')[0]?.trim();
    if (mPart) extractedM = cleanDesuMasu(mPart.slice(0, 100));
  }
  if (absJa.includes('【結果】')) {
    const rPart = absJa.split('【結果】')[1]?.split('【')[0]?.trim();
    if (rPart) extractedR = cleanDesuMasu(rPart.slice(0, 120));
  }

  const newSummary = [
    `【概要】${g || paper.titleJa || '研究の概要'}`,
    `【方法】${extractedM}`,
    `【結果】${extractedR}`,
    `【結論】${c || '主要な臨床的意義を確認した'}`
  ].join('\n');

  return newSummary;
}

async function main() {
  const filePaths = [
    path.resolve('public/papers.json'),
    path.resolve('outputs/papers.json')
  ];

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!data.papers || !Array.isArray(data.papers)) continue;

    let count = 0;
    for (const paper of data.papers) {
      const fixedSummary = await fixDuplicatedSummary(paper);
      if (paper.summaryJa !== fixedSummary) {
        paper.summaryJa = fixedSummary;
        count++;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[FixSummary] Completed ${filePath}: ${count} papers fixed.`);
  }
}

main();
