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
export async function fetchFreeArticleFullText(pmid, doi = '', title = '') {
  if (!pmid) return null;

  console.log(`[FreeArticleFetcher] PMID ${pmid} (DOI: ${doi || 'なし'}) の Open Access 本文を多角探索中...`);

  let aggregatedText = '';

  // 1. OpenAlex API からのテキストインデックス検索
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
      if (text.length > 100) {
        aggregatedText += ' ' + text;
      }
    }
  } catch (err) {}

  // 2. Europe PMC API での検索
  try {
    const epmcUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${pmid}&resultType=core&format=json`;
    const epmcRes = await axios.get(epmcUrl, { timeout: 8000 });
    const resObj = epmcRes.data?.resultList?.result?.[0];

    if (resObj) {
      if (resObj.abstractText && resObj.abstractText.length > 100) {
        aggregatedText += ' ' + resObj.abstractText;
      }
      if (resObj.pmcid) {
        const pmcXmlUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${resObj.pmcid.replace('PMC', '')}&retmode=xml`;
        const pmcRes = await axios.get(pmcXmlUrl, { timeout: 8000 });
        const text = pmcRes.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length > 300) {
          aggregatedText += ' ' + text.slice(0, 6000);
        }
      }
    }
  } catch (err) {}

  // 3. DuckDuckGo / Open Web Search での全文・研究概要探索 (テキストが不十分な場合)
  if (aggregatedText.length < 500 && title) {
    try {
      const searchQuery = encodeURIComponent(`"${title}" ablation pulsed field catheter`);
      const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;
      const res = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 8000
      });
      const snippets = [...res.data.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .join(' ');
      if (snippets.length > 100) {
        aggregatedText += ' ' + snippets;
      }
    } catch (err) {}
  }

  const finalCleanText = aggregatedText.replace(/\s+/g, ' ').trim();
  if (finalCleanText.length > 150) {
    console.log(`[FreeArticleFetcher] 本文・総合情報抽出成功 (${finalCleanText.length}文字)`);
    return finalCleanText;
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
以下はPubMed上に抄録が掲載されていないFree article論文の本文テキストです。
超多忙な臨床医が10秒で要点を理解できるよう、**全体の長さを合計10行以内（約300文字程度）にまとめた短く簡潔な日本語臨床要約（4項目）**を作成してください。

【厳格ルール】:
- 「です・ます」などの丁寧語は完全禁止！【体言止め】または常体（〜である/〜であった/〜を認めた）のみ。
- 全体で【合計10行以内（約300文字程度）】に必ず凝縮すること！ダラダラとした全訳や長文の列挙は絶対禁止。
- 各項目（【概要】【方法】【結果】【結論】）はそれぞれ【1〜2文（各60〜90文字以内）】の短文ポイントでまとめること。
- 【結論】は最も主要な臨床成果・統計的結論を1文でズバリ提示すること（資金提供や治験番号、研究の限界は除外）。

【タイトル】: ${paper.title}
【本文テキスト】: ${fullText.slice(0, 6000)}

【出力フォーマット (合計10行以内・簡潔要約)】:
【概要】研究目的と対象 (${studyType} / ${nText})
【方法】アプローチ手技・比較・主要評価プロトコル
【結果】主要な成果数値（成功率・非再発率・PVI率・主要イベント率・HR値など短文で）
【結論】研究から得られた主要結論`;

      const summaryRes = await model.generateContent(promptSummary);
      let summaryJa = removeDesuMasuStrict(summaryRes.response.text().trim());

      const promptAbstract = `あなたは医学論文の専門翻訳者です。
以下はPubMed上に抄録が掲載されていないFree article論文の本文テキストです。
論文全体の構成（【背景】【方法】【結果】【結論】）に沿って、端折らず美しい日本語文章で詳細直訳・解説要約を作成してください。「です・ます」は使用せず常体（〜である / 〜であった / 〜を認めた）で記述してください。各項目は空欄にせず充実した内容にしてください。

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
【本文テキスト】: ${fullText.slice(0, 6000)}`;

      const abstractRes = await model.generateContent(promptAbstract);
      let abstractJa = removeDesuMasuStrict(abstractRes.response.text().trim());

      if (summaryJa && abstractJa && !summaryJa.includes('【結果】...')) {
        return { summaryJa, abstractJa };
      }
    } catch (err) {
      console.error(`[FreeArticleFetcher] Gemini API要約エラー:`, err.message);
    }
  }

  // B. Gemini API が無い / フォールバック処理
  console.log('[FreeArticleFetcher] 高精度無料翻訳エンジンで Free Article 本文要約を生成中...');
  try {
    const translatedFull = await translateToNaturalJapanese(fullText.slice(0, 3000));
    const cleanFullText = removeDesuMasuStrict(translatedFull);

    const len = cleanFullText.length;
    const part = Math.floor(len / 4);

    const summaryJa = [
      `【概要】${paper.titleJa || paper.title}における臨床効果の検証 (${studyType} / ${nText})`,
      `【方法】${cleanFullText.slice(0, Math.min(120, part))}...`,
      `【結果】${cleanFullText.slice(part, part + Math.min(140, part))}...`,
      `【結論】${cleanFullText.slice(part * 2, part * 2 + Math.min(120, part))}...`
    ].join('\n');

    const abstractJa = [
      `【背景】\n${cleanFullText.slice(0, part)}`,
      `【方法】\n${cleanFullText.slice(part, part * 2)}`,
      `【結果】\n${cleanFullText.slice(part * 2, part * 3)}`,
      `【結論】\n${cleanFullText.slice(part * 3)}`
    ].join('\n\n');

    return { summaryJa, abstractJa };
  } catch (err) {
    console.error(`[FreeArticleFetcher] フォールバック要約失敗:`, err.message);
  }

  return null;
}
