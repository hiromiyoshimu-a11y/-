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
       .replace(/関連していました/g, 'に関連していた')
       .replace(/関連していました。/g, 'に関連していた。')
       .replace(/です([。.\s]|$)/g, 'である$1')
       .replace(/ます([。.\s]|$)/g, 'る$1');
  return s;
}

// Limitation文言の判定
function isLimitationSentence(sentence) {
  if (!sentence) return false;
  const s = sentence.toLowerCase();
  return s.includes('cannot establish') ||
         s.includes('single-arm') ||
         s.includes('hypothesis-generating') ||
         s.includes('warrants further') ||
         s.includes('further study') ||
         s.includes('further investigation') ||
         s.includes('small sample') ||
         s.includes('limitations include') ||
         s.includes('確立することはできない') ||
         s.includes('単一群であるため') ||
         s.includes('仮説を生み出す') ||
         s.includes('さらなる研究が必要');
}

async function fixConclusion(paper) {
  const lines = (paper.summaryJa || '').split('\n');
  let currentConclusion = '';
  lines.forEach(l => {
    if (l.startsWith('【結論】')) {
      currentConclusion = l.replace('【結論】', '').trim();
    }
  });

  // PMID 42764111 または Limitation文言が含まれているかチェック
  const needsFix = String(paper.pmid) === '42764111' || isLimitationSentence(currentConclusion);

  if (!needsFix) {
    return paper.summaryJa;
  }

  console.log(`[FixConclusion] 修正対象検出: PMID ${paper.pmid} - ${paper.title.slice(0, 30)}...`);

  // Gemini APIによる主要結論の正確な抽出
  if (genAI && paper.abstract && !paper.abstract.includes('抄録なし')) {
    try {
      let model;
      try { model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); }
      catch { model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); }

      const prompt = `あなたは医学要約の専門医です。以下の論文抄録の【CONCLUSION (結論)】セクションから、研究の限界 (limitation: 「単一群であるため〜」「確立することはできない〜」「仮説を生み出す〜」など) ではなく、**研究で確認された【主要な正の結論・臨床的成果 (通常CONCLUSIONの第1文)】**を1文で正確に抽出し、「です・ます」を絶対に使わず常体（〜であった / 〜を示した / 〜に関連していた）で要約してください。要約された結論の文のみを出力してください。

【タイトル】: ${paper.title}
【抄録】: ${paper.abstract}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (text) {
        const cleanConc = cleanDesuMasu(text.replace(/^【結論】\s*/, ''));
        const newLines = lines.map(l => l.startsWith('【結論】') ? `【結論】${cleanConc}` : l);
        return newLines.join('\n');
      }
    } catch (e) {
      console.warn(`[FixConclusion] Gemini fix failed for PMID ${paper.pmid}:`, e.message);
    }
  }

  // フォールバック: abstractJa から CONCLUSION の最初の文を抽出
  const absJa = paper.abstractJa || '';
  if (absJa.includes('【結論】')) {
    const concBlock = absJa.split('【結論】')[1]?.trim() || '';
    const sentences = concBlock.split(/(?<=[。.\n])/).map(s => s.trim()).filter(Boolean);
    // 最初の文（Limitationでないもの）
    const mainConc = sentences.find(s => !isLimitationSentence(s)) || sentences[0];
    if (mainConc) {
      const cleanConc = cleanDesuMasu(mainConc);
      const newLines = lines.map(l => l.startsWith('【結論】') ? `【結論】${cleanConc}` : l);
      return newLines.join('\n');
    }
  }

  return paper.summaryJa;
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
      const fixedSummary = await fixConclusion(paper);
      if (paper.summaryJa !== fixedSummary) {
        paper.summaryJa = fixedSummary;
        count++;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[FixConclusion] Completed ${filePath}: ${count} papers updated.`);
  }
}

main();
