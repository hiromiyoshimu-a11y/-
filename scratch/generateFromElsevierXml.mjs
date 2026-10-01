import axios from 'axios';
import { parseStringPromise } from 'xml2js';
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

async function testFetchAndSummarize(pii, paperTitle, pmid) {
  const url = `https://api.elsevier.com/content/article/PII:${pii}?httpAccept=text/xml`;
  console.log(`[Elsevier] PII ${pii} (PMID ${pmid}) の全文XMLを取得中: ${url}`);
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const xml = res.data;
    // XMLタグの完全除去
    const cleanFullText = xml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`[Elsevier] 本文テキスト抽出完了 (${cleanFullText.length}文字)`);
    console.log(`サンプル:`, cleanFullText.slice(0, 400));

    if (!genAI) return null;

    let model;
    try { model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); }
    catch { model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); }

    // 1. 4行要約 (summaryJa)
    const promptSummary = `あなたは不整脈・カテーテル/パルスフィールドアブレーションの専門医です。
以下の論文はPubMed上で抄録未掲載ですが、オープンアクセスの本分テキストです。
本文から重要な【概要】【方法】【結果】【結論】を読み解き、「です・ます」は1文字も絶対に使用せず、常体（〜である / 〜であった / 〜を実施した / 〜を認めた）で4行の臨床要約を作成してください。

【タイトル】: ${paperTitle}
【本文テキスト】: ${cleanFullText.slice(0, 4500)}

【出力フォーマット】:
【概要】... (症例報告 (Case Report) / N = 1例)
【方法】...
【結果】...
【結論】...`;

    const summaryRes = await model.generateContent(promptSummary);
    const summaryJa = cleanDesuMasu(summaryRes.response.text().trim());

    // 2. 詳細要約 (abstractJa)
    const promptAbstract = `あなたは医学論文の専門翻訳者です。
以下はPubMed上に抄録が掲載されていないFree article論文の全文テキストです。
論文全体の構成（【背景・目的】【方法・手技】【結果・症例経過】【結論】）に沿って、端折らず美しい日本語文章で詳細直訳要約を作成してください。

【見出しルール】:
【背景】
(背景の全文要約)

【方法】
(方法・使用デバイス・アプローチ手技の詳細要約)

【結果】
(結果・症例経過・アブレーション成果の詳細要約)

【結論】
(主要な結論の要約)

【タイトル】: ${paperTitle}
【本文テキスト】: ${cleanFullText.slice(0, 4500)}`;

    const abstractRes = await model.generateContent(promptAbstract);
    const abstractJa = cleanDesuMasu(abstractRes.response.text().trim());

    console.log(`\n🎉 生成成功！\n--- summaryJa ---\n${summaryJa}\n\n--- abstractJa ---\n${abstractJa}`);

    return { summaryJa, abstractJa };
  } catch (err) {
    console.error(`Elsevier Fetch error:`, err.message);
  }
}

testFetchAndSummarize('S1547527126024525', 'Para-His periaortic VT ablation with focal pulsed-field energy', '42248313');
