import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { translateToNaturalJapanese, removeDesuMasuStrict } from './summarizer.js';
dotenv.config();

function getGenAI() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
    try {
      return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } catch {}
  }
  return null;
}

/**
 * PMID または DOI から Free Article / Open Access の有無を判定し本文テキストを取得
 */
export async function fetchFreeArticleFullText(pmid, doi = '') {
  if (!pmid) return null;

  console.log(`[FreeArticleFetcher] PMID ${pmid} (DOI: ${doi || 'なし'}) の Open Access 本文を探索中...`);

  // 1. OpenAlex API からのテキストインデックス検索 (最優先・非常に高精度)
  try {
    const openAlexUrl = pmid
      ? `https://api.openalex.org/works/pmid:${pmid}`
      : `https://api.openalex.org/works/https://doi.org/${doi}`;
    const alexRes = await axios.get(openAlexUrl, { timeout: 8000 });
    if (alexRes.data && alexRes.data.abstract_inverted_index) {
      const words = [];
      for (const [word, positions] of Object.entries(alexRes.data.abstract_inverted_index)) {
        for (const pos of positions) {
          words[pos] = word;
        }
      }
      const text = words.join(' ').trim();
      if (text.length > 80) {
        console.log(`[FreeArticleFetcher] OpenAlexより本文/要約テキスト抽出成功 (${text.length}文字)`);
        return text;
      }
    }
  } catch (err) {
    console.log(`[FreeArticleFetcher] OpenAlex探索エラー: ${err.message}`);
  }

  // 2. Europe PMC API での検索
  try {
    const epmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${pmid}&resultType=core&format=json`;
    const epmcRes = await axios.get(epmcUrl, { timeout: 8000 });
    const resObj = epmcRes.data?.resultList?.result?.[0];

    if (resObj) {
      if (resObj.abstractText && resObj.abstractText.length > 80) {
        console.log(`[FreeArticleFetcher] Europe PMCより本文/抄録抽出成功 (${resObj.abstractText.length}文字)`);
        return resObj.abstractText;
      }
      if (resObj.pmcid) {
        const pmcXmlUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${resObj.pmcid.replace('PMC', '')}&retmode=xml`;
        const pmcRes = await axios.get(pmcXmlUrl, { timeout: 8000 });
        const text = pmcRes.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length > 200) {
          console.log(`[FreeArticleFetcher] PMC XMLより本文抽出成功 (${text.length}文字)`);
          return text.slice(0, 8000);
        }
      }
    }
  } catch (err) {
    console.log(`[FreeArticleFetcher] Europe PMC探索エラー: ${err.message}`);
  }

  // 3. NCBI E-utilities elink 経由での Free Resource / Unpaywall 探索
  try {
    const elinkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&id=${pmid}&cmd=prlinks&retmode=json`;
    const elinkRes = await axios.get(elinkUrl, { timeout: 8000 });
    const objurls = elinkRes.data.linksets?.[0]?.idurllist?.[0]?.objurls || [];
    const isFree = objurls.some(u => 
      (u.attributes && u.attributes.includes('free resource')) || 
      (u.iconurl && /elsevieroa|free|oa|open/i.test(u.iconurl.value))
    );
    if (isFree && doi) {
      const unpayRes = await axios.get(`https://api.unpaywall.org/v2/${doi}?email=hiromiyoshimu@gmail.com`, { timeout: 8000 });
      if (unpayRes.data && unpayRes.data.is_oa) {
        const oaUrl = unpayRes.data.best_oa_location?.url;
        if (oaUrl) {
          const res = await axios.get(oaUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 8000
          });
          const text = res.data.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text.length > 200) {
            console.log(`[FreeArticleFetcher] Free Article Webページよりテキスト抽出成功 (${text.length}文字)`);
            return text.slice(0, 6000);
          }
        }
      }
    }
  } catch (err) {
    console.log(`[FreeArticleFetcher] NCBI/Unpaywall探索エラー: ${err.message}`);
  }

  return null;
}

/**
 * 論文本文テキストから AI 要約 (summaryJa) と 全訳・詳細要約 (abstractJa) を自動作成
 */
export async function summarizeFromFullText(paper, fullText) {
  if (!fullText) return null;

  const genAI = getGenAI();
  const nText = paper.sampleSize > 0 ? `N = ${paper.sampleSize.toLocaleString()}例` : '症例数: 不明';
  const studyType = paper.studyTypeLabel || '研究';

  // A. Gemini API が利用可能な場合
  if (genAI) {
    try {
      let model;
      try { model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); }
      catch { model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); }

      const promptSummary = `あなたは循環器内科・不整脈の専門医です。
以下の論文はPubMed上で抄録が未掲載ですが、オープンアクセス/Free article の論文本文テキストです。
本文テキストから重要な【概要】【方法】【結果】【結論】を読み解き、「です・ます」は1文字も絶対に使用せず、常体表現（〜である / 〜であった / 〜を実施した / 〜を認めた / 〜の比較など）で4行の臨床要約を作成してください。

【厳格ルール】:
- 「です・ます・でした・されます」は絶対禁止！常体に統一。
- 【結論】には研究で確認された最も主要な成果・結論（主要正結論）を1文で記述すること。Limitationや資金提供情報は除外すること。
- 【概要】には論文のテーマと背景・目的を簡潔に書くこと。

【タイトル】: ${paper.title}
【本文テキスト】: ${fullText.slice(0, 5000)}

【出力フォーマット】:
【概要】... (${studyType} / ${nText})
【方法】...
【結果】...
【結論】...`;

      const summaryRes = await model.generateContent(promptSummary);
      let summaryJa = removeDesuMasuStrict(summaryRes.response.text().trim());

      const promptAbstract = `あなたは医学論文の専門翻訳者です。
以下はPubMed上に抄録が掲載されていないFree article論文の本文テキストです。
論文全体の構成（【背景】【方法】【結果】【結論】）に沿って、端折らず美しい日本語文章で詳細直訳・解説要約を作成してください。「です・ます」は使用せず常体（〜である / 〜であった / 〜を認めた）で記述してください。

【見出しルール】:
【背景】
(背景の要点)

【方法】
(対象・手技プロトコルの詳細)

【結果】
(主要結果・アブレーション成果の詳細)

【結論】
(臨床的結論)

【タイトル】: ${paper.title}
【本文テキスト】: ${fullText.slice(0, 5000)}`;

      const abstractRes = await model.generateContent(promptAbstract);
      let abstractJa = removeDesuMasuStrict(abstractRes.response.text().trim());

      if (summaryJa && abstractJa) {
        return { summaryJa, abstractJa };
      }
    } catch (err) {
      console.error(`[FreeArticleFetcher] Gemini API要約エラー:`, err.message);
    }
  }

  // B. Gemini API が無い / フォールバック処理 (translateToNaturalJapanese を使用)
  console.log('[FreeArticleFetcher] 高精度無料翻訳エンジンで Free Article 本文要約を生成中...');
  try {
    const translatedFull = await translateToNaturalJapanese(fullText.slice(0, 2000));
    const cleanFullText = removeDesuMasuStrict(translatedFull);

    const summaryJa = [
      `【概要】${paper.titleJa || paper.title}における臨床要点 (${studyType} / ${nText})`,
      `【方法】${cleanFullText.slice(0, 120)}...`,
      `【結果】${cleanFullText.slice(120, 280)}...`,
      `【結論】${cleanFullText.slice(280, 420)}...`
    ].join('\n');

    const abstractJa = [
      `【背景】\n${cleanFullText.slice(0, 150)}`,
      `【方法】\n${cleanFullText.slice(150, 350)}`,
      `【結果】\n${cleanFullText.slice(350, 600)}`,
      `【結論】\n${cleanFullText.slice(600, 800)}`
    ].join('\n\n');

    return { summaryJa, abstractJa };
  } catch (err) {
    console.error(`[FreeArticleFetcher] フォールバック要約失敗:`, err.message);
  }

  return null;
}
