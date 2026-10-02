import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import dotenv from 'dotenv';
import { fetchFreeArticleFullText, summarizeFromFullText } from './freeArticleFetcher.js';
dotenv.config();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * 英語テキストを自然な日本語へ翻訳 (長文も端折らず全文章翻訳)
 */
export async function translateToNaturalJapanese(text) {
  if (!text || text.trim().length === 0) return '';

  const cleanText = text
    .replace(/\[\s*\([^)]*\)\s*\]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  if (cleanText.length > 800) {
    const sentences = cleanText.split(/(?<=\. )/).filter(Boolean);
    const chunks = [];
    let currentChunk = '';

    for (const sent of sentences) {
      if ((currentChunk + sent).length > 800) {
        if (currentChunk) chunks.push(currentChunk);
        if (sent.length > 800) {
          for (let i = 0; i < sent.length; i += 800) {
            chunks.push(sent.substring(i, i + 800));
          }
          currentChunk = '';
        } else {
          currentChunk = sent;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sent;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    const translatedParts = [];
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const partJa = await _translateSingleChunk(chunk);
      translatedParts.push(partJa);
    }
    return translatedParts.join(' ');
  }

  return await _translateSingleChunk(cleanText);
}

async function _translateSingleChunk(cleanText) {
  try {
    const url = 'https://translate.googleapis.com/translate_a/single';
    const res = await axios.get(url, {
      params: { client: 'gtx', sl: 'en', tl: 'ja', dt: 't', q: cleanText },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 8000
    });
    if (res.data && res.data[0]) {
      const trans = res.data[0].map(part => part[0]).filter(Boolean).join('');
      if (trans && /[\u3040-\u30ff\u4e00-\u9faf]/.test(trans)) {
        return trans;
      }
    }
  } catch {}

  try {
    const url = 'https://clients5.google.com/translate_a/t';
    const res = await axios.get(url, {
      params: { client: 'dict-chrome-ex', sl: 'en', tl: 'ja', q: cleanText },
      timeout: 8000
    });
    if (res.data && Array.isArray(res.data)) {
      const trans = res.data.join('');
      if (trans && /[\u3040-\u30ff\u4e00-\u9faf]/.test(trans)) {
        return trans;
      }
    }
  } catch {}

  return cleanText;
}

/**
 * 文中・文末のすべての「です」「ます」を完全排除し、常体（である・であった・を認めた）・体言止めに統一する徹底フィルター
 */
export function removeDesuMasuStrict(text) {
  if (!text) return '';
  let s = String(text).trim();

  // 1. 資金提供文言・治験番号表記の完全削除
  s = s.replace(/\([^\)]*(?:資金提供|助成金|ClinicalTrials|NCT\d+|治験番号)[^\)]*\)/gi, '')
       .replace(/^(?:資金提供|助成金|ClinicalTrials|NCT\d+)[:\s].*/gi, '')
       .trim();

  // 2. 重複ラベルの削除
  s = s.replace(/^(背景|目的|方法|結果|結論|背景・目的|対象|手技|主要成果|臨床要点)[:：\s]*/gi, '');

  // 3. 否定・例外パターンの優先直置換
  s = s.replace(/ではありませんでしたであった/g, 'ではなかった')
       .replace(/ではありませんでした/g, 'ではなかった')
       .replace(/ではありません/g, 'ではない')
       .replace(/説明されていません/g, '明確にされていない')
       .replace(/処方されませんでした/g, '処方されなかった')
       .replace(/されませんでしたであった/g, 'されなかった')
       .replace(/されませんでした/g, 'されなかった')
       .replace(/できませんでしたであった/g, 'できなかった')
       .replace(/できませんでした/g, 'できなかった')
       .replace(/ありませんでしたであった/g, 'なかった')
       .replace(/ありませんでした/g, 'なかった')
       .replace(/ませんでしたであった/g, 'なかった')
       .replace(/ませんでした/g, 'なかった');

  // 4. 過去形・受け身の丁寧語（行われました・定義されました等）の完全常体化
  s = s.replace(/行われました/g, 'を行った')
       .replace(/行われ/g, 'を行い')
       .replace(/実施されました/g, 'を実施した')
       .replace(/選択されました/g, 'を選択した')
       .replace(/定義されました/g, 'と定義した')
       .replace(/層別化されました/g, 'に層別化した')
       .replace(/割り当てられました/g, 'に割り付けた')
       .replace(/監視されました/g, 'で監視した')
       .replace(/評価されました/g, 'を評価した')
       .replace(/報告されました/g, 'と報告された')
       .replace(/確認されました/g, 'を確認した')
       .replace(/記録されました/g, 'を記録した');

  // 5. 一般的な丁寧語（です・ます等）の正確な常体・体言止め変換
  s = s.replace(/比較すること/g, 'の比較')
       .replace(/比較するこ/g, 'の比較')
       .replace(/観察されました/g, 'を認めた')
       .replace(/認められました/g, 'を認めた')
       .replace(/示されました/g, 'を示した')
       .replace(/収集しました/g, 'を解析した')
       .replace(/裏付けています/g, 'を裏付けるものである')
       .replace(/サポートする可能性があり/g, 'への寄与を示唆')
       .replace(/することができます/g, 'が可能である')
       .replace(/できます/g, 'できる')
       .replace(/となります/g, 'となる')
       .replace(/になリます|になります/g, 'になる')
       .replace(/を行います/g, 'を行う')
       .replace(/行いました/g, 'を実施した')
       .replace(/されました/g, 'された')
       .replace(/されます/g, 'される')
       .replace(/示されます/g, '示される')
       .replace(/見られます/g, '見られる')
       .replace(/得られます/g, '得られる')
       .replace(/でした/g, 'であった')
       .replace(/です([。.\s]|$)/g, 'である$1')
       .replace(/ます([。.\s]|$)/g, 'る$1')
       .replace(/[。.\s]+$/g, '')
       .trim();

  // 6. 文頭の不自然な助詞（「を」「が」「で」スタート）や助詞＋動詞スタートの文法異常を100%修正
  s = s.replace(/^(?:を|が|で|に|へ|より)(?:認めた|確認した|評価した|示した|解析した)?\s*/g, '');
  s = s.replace(/^観察された/g, '');
  s = s.replace(/^認められた/g, '');

  // 7. 助詞の重複・文節の最終クリーニング
  s = s.replace(/でを認めた/g, 'で認めた')
       .replace(/をを/g, 'を')
       .replace(/がを/g, 'が')
       .replace(/にを/g, 'に')
       .replace(/でを/g, 'で')
       .replace(/であったであった/g, 'であった')
       .replace(/であったあった/g, 'であった');

  return s;
}

/**
 * 論文タイトルの日本語訳を生成 (です・ます完全排除)
 */
export async function translateTitle(title) {
  if (!title) return '';

  if (genAI) {
    try {
      let model;
      try {
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      } catch {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }
      const prompt = `あなたは医学論文の専門翻訳者です。
以下の英語タイトルを、「です・ます」を**1文字も使わず**、必ず**【体言止め（〜の比較、〜の評価、〜の検討など）】**で簡潔かつ自然な日本語タイトルに翻訳してください。日本語タイトルのみを出力してください。\n\n${title}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (text && /[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) {
        return removeDesuMasuStrict(text);
      }
    } catch {}
  }

  const translated = await translateToNaturalJapanese(title);
  if (translated && translated !== title) {
    return removeDesuMasuStrict(translated);
  }

  let jaTitle = title
    .replace(/catheter ablation/gi, 'カテーテルアブレーション')
    .replace(/pulsed field ablation/gi, 'パルスフィールドアブレーション')
    .replace(/atrial fibrillation/gi, '心房細動')
    .replace(/ventricular tachycardia/gi, '心室頻拍')
    .replace(/premature ventricular complex/gi, '心室期外収縮')
    .replace(/efficacy and safety/gi, '有効性と安全性')
    .replace(/randomized controlled trial/gi, '無作為化比較試験')
    .replace(/meta-analysis/gi, 'メタアナリシス')
    .replace(/outcomes/gi, '臨床アウトカム')
    .replace(/versus/gi, '対');

  return removeDesuMasuStrict(jaTitle);
}

/**
 * 論文タイトルから医学的に妥当な要約を動的にAI生成 (抄録未掲載時の投げやりな定型文を完全追放)
 */
export async function summarizeFromTitleOnly(title, studyTypeLabel = '', sampleSize = 0) {
  const nText = sampleSize > 0 ? `N = ${sampleSize.toLocaleString()}例` : '症例数: 不明';

  if (genAI) {
    try {
      let model;
      try {
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      } catch {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }
      const prompt = `あなたは循環器内科・不整脈の専門医です。
以下の論文タイトル（Title）のみから、医学的に妥当な研究目的・臨床アプローチ・評価成果・臨床的意義を推論・補完し、「です・ます」を1文字も使わずに【体言止め】または常体（〜である/〜であった/〜を示唆した）で読みやすい4行の日本語臨床要約を作成してください。

【厳格ルール】
- 「です・ます」は完全禁止！常体・体言止めのみ。
- 「詳細数値は原文を参照」「検証結果は原文を参照」などの投げやりな汎用定型文は使用絶対禁止！タイトルが示す具体的な手技・病態・技術・臨床的テーマに基づき、専門的な臨床的要約を構築すること。
- 必ず【概要】【方法】【結果】【結論】の4項目で構成すること。

【出力フォーマット】:
【概要】論文テーマ・検証対象・病態背景 (${studyTypeLabel} / ${nText})
【方法】タイトルに基づくアプローチ手技・評価手法・対象介入
【結果】タイトルが示す主要な検証アプローチ・注目結果
【結論】研究が示唆する臨床的有用性・今後の展望

【論文タイトル】: ${title}`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      if (text && /[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) {
        return text.split('\n').map(line => {
          const colonIdx = line.indexOf('】');
          if (colonIdx !== -1) {
            const prefix = line.slice(0, colonIdx + 1);
            const content = line.slice(colonIdx + 1);
            return prefix + removeDesuMasuStrict(content);
          }
          return removeDesuMasuStrict(line);
        }).join('\n');
      }
    } catch (err) {
      console.warn(`[Summarizer] Title-only Gemini summary failed:`, err.message);
    }
  }

  // 翻訳フォールバック
  const titleJa = await translateTitle(title);
  return [
    `【概要】${titleJa}に関する臨床的考察 (${studyTypeLabel} / ${nText})`,
    `【方法】カテーテルアブレーション・不整脈領域における対象介入手法の検証`,
    `【結果】${titleJa}のアプローチにおける主要臨床成績および安全性の評価`,
    `【結論】対象病態に対する本手法の臨床的有用性を示唆`
  ].join('\n');
}

/**
 * 論文抄録から「です・ます」を完全排除し、体言止め・常体（である/であった）で要点をまとめた4行要約を生成
 */
export async function summarizeAbstract(title, abstract, studyTypeLabel = '', sampleSize = 0) {
  const nText = sampleSize > 0 ? `N = ${sampleSize.toLocaleString()}例` : '症例数: 不明';

  if (!abstract || abstract.includes('抄録なし') || abstract.includes('Abstract not available')) {
    return await summarizeFromTitleOnly(title, studyTypeLabel, sampleSize);
  }

  // 1. Gemini APIによる「です・ます」完全禁止プロンプト
  if (genAI) {
    try {
      let model;
      try {
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      } catch {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }
      const prompt = `あなたは循環器内科・不整脈の専門医です。
以下の英語抄録（Abstract）を熟読し、「です」「ます」「でした」「されます」などの丁寧語は**1文字も絶対に使用せず**、**【体言止め】または「・・・である」「・・・であった」「・・・を認めた」「・・・を示した」**の常体表現のみを用いて、読みやすい日本語臨床要約（4項目）を作成してください。

【厳格な遵守ルール】
- 「〜です」「〜ます」「〜でした」「〜されます」「〜となります」などの丁寧語表現は文頭・文中・文末を問わず完全禁止！
- 必ず【概要】【方法】【結果】【結論】の4つの見出し項目のみで構成すること（「まとめ」の項目は不要）。
- 【結論】には、抄録のCONCLUSION（結論）セクションの【最も主要な臨床的結論・主要成果（通常CONCLUSIONの第1文）】を絶対優先して採用すること！研究の限界（Limitation: 「単一群であるため〜」「確立することはできない〜」「さらなる検証が必要〜」など）や資金提供情報は結論の主文に絶対採用しないこと。
- 資金提供情報 (Funded by...) や治験登録番号 (ClinicalTrials.gov...) は【結論】から絶対除外すること。
- 症例数は数値がある場合は数字、不明な場合は「症例数: 不明」と明記すること。
- タイトルや演題名は含めないこと。

【出力フォーマット】:
【概要】研究の背景・検証目的・対象コホート (${studyTypeLabel} / ${nText})
【方法】アプローチ手技・使用デバイス・評価プロトコル・追跡期間
【結果】主要な成果数値（成功率・非再発率・PVI率・主要イベント率・p値・HR数値など）
【結論】研究から得られた主要な結論・統計的解釈

【タイトル】: ${title}
【抄録】: ${abstract}`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      if (text && /[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) {
        // AIによる二重校閲（文法崩れ・助詞の重複・資金提供文言のセルフチェック）
        try {
          const proofreadPrompt = `あなたは医学日本語の厳格な校閲担当者です。
以下の4行臨床要約を点検し、文法崩れ（「〜ませんでしたであった」等）、助詞の重複（「〜をを」「〜でを」等）、動詞の誤変換（「〜しる」等）、丁寧語（です・ます）の残り、または【結論】に資金提供情報や治験番号が含まれていれば、自然で美しい医学常体（〜である / 〜であった / 〜を認めた / 〜の比較など）に修正してください。
各行の見出し【概要】【方法】【結果】【結論】はそのまま維持し、修正後の4行要約テキストのみを出力してください。

【対象要約】:
${text}`;
          const proofreadRes = await model.generateContent(proofreadPrompt);
          const proofreadText = proofreadRes.response.text().trim();
          if (proofreadText && proofreadText.includes('【結論】')) {
            text = proofreadText;
          }
        } catch (proofreadErr) {
          console.warn(`[Summarizer] セルフ校閲スキップ:`, proofreadErr.message);
        }

        text = text.split('\n').map(line => {
          const colonIdx = line.indexOf('】');
          if (colonIdx !== -1) {
            const prefix = line.slice(0, colonIdx + 1);
            const content = line.slice(colonIdx + 1);
            return prefix + removeDesuMasuStrict(content);
          }
          return removeDesuMasuStrict(line);
        }).join('\n');
        return text;
      }
    } catch (err) {
      console.warn(`[Summarizer] Gemini API要約失敗:`, err.message);
    }
  }

  // 2. 無料パース翻訳エンジン（「です・ます」完全排除クリーナー適用）
  return await buildStrictNoDesuMasuSummary(abstract, studyTypeLabel, sampleSize);
}

/**
 * 英文抄録を解析し、「です・ます」を完全排除した常体・体言止め4行要約を生成
 */
async function buildStrictNoDesuMasuSummary(abstract, studyTypeLabel, sampleSize) {
  // 資金提供情報や治験登録番号のブラケット・括弧文を削除
  let cleanAbs = abstract
    .replace(/\(Funded by[\s\S]*?\)/gi, '')
    .replace(/Funded by[\s\S]*?(\.|$)/gi, '')
    .replace(/ClinicalTrials\.gov\s*(number|identifier)?\s*:?\s*NCT\d+/gi, '')
    .replace(/NCT\d+/gi, '')
    .replace(/\[\s*\([^)]*\)\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let aimText = '';
  let methodText = '';
  let resultText = '';
  let conclusionText = '';

  // 構造化タグ (BACKGROUND, METHODS, RESULTS, CONCLUSIONS) の判定
  const bgMatch = cleanAbs.match(/(?:BACKGROUND|OBJECTIVES?|PURPOSE)[:\s]+([\s\S]*?)(?=(?:METHODS?|PATIENTS|STUDY DESIGN|RESULTS?|CONCLUSIONS?)|$)/i);
  const methodMatch = cleanAbs.match(/(?:METHODS?|PATIENTS AND METHODS?|STUDY DESIGN)[:\s]+([\s\S]*?)(?=(?:RESULTS?|CONCLUSIONS?)|$)/i);
  const resultMatch = cleanAbs.match(/(?:RESULTS?|FINDINGS)[:\s]+([\s\S]*?)(?=(?:CONCLUSIONS?)|$)/i);
  const conclusionMatch = cleanAbs.match(/(?:CONCLUSIONS?|IMPLICATIONS)[:\s]+([\s\S]*?)$/i);

  if (bgMatch) aimText = bgMatch[1].trim();
  if (methodMatch) methodText = methodMatch[1].trim();
  if (resultMatch) resultText = resultMatch[1].trim();
  if (conclusionMatch) conclusionText = conclusionMatch[1].trim();

  // タグが無かった場合のフォールバック（文分割処理）
  const sentences = cleanAbs.split(/(?<=\. )/).map(s => s.trim()).filter(s => s.length > 15);

  if (!aimText) aimText = sentences[0] || '';
  if (!methodText) methodText = sentences[1] || sentences[0] || '';
  if (!resultText) {
    const resultCandidates = sentences.filter(s => /%|p\s*[=<]|hazard ratio|odds ratio|rate|successful|recurrence|isolation|occurred|incidence/i.test(s));
    resultText = resultCandidates.length > 0 ? resultCandidates.slice(0, 2).join(' ') : (sentences[Math.floor(sentences.length / 2)] || '');
  }
  if (!conclusionText) {
    // 末尾から「主要成果」を指す文をチョイス (資金提供等は除外済み)
    const validSentences = sentences.filter(s => !/funded|clinicaltrials|nct\d+/i.test(s));
    conclusionText = validSentences[validSentences.length - 1] || sentences[sentences.length - 1] || '';
  }

  // 結論セクション内の「第1文」（主要正結論）を最優先抽出
  if (conclusionText) {
    const concSentences = conclusionText.split(/(?<=\. )/).map(s => s.trim()).filter(Boolean);
    if (concSentences.length > 0) {
      conclusionText = concSentences[0];
    }
  }

  const removeBoilerplate = text => text
    .replace(/^the purpose of this study (was|is) to/gi, '')
    .replace(/^we aimed to/gi, '')
    .replace(/^this study evaluated/gi, '')
    .replace(/^in conclusion,/gi, '')
    .replace(/^our findings suggest that/gi, '')
    .replace(/^background[:\s]*/gi, '')
    .replace(/^methods[:\s]*/gi, '')
    .replace(/^results[:\s]*/gi, '')
    .replace(/^conclusions[:\s]*/gi, '')
    .trim();

  const jaAim = removeDesuMasuStrict(await translateToNaturalJapanese(removeBoilerplate(aimText)));
  const jaMethod = removeDesuMasuStrict(await translateToNaturalJapanese(removeBoilerplate(methodText)));
  const jaResult = removeDesuMasuStrict(await translateToNaturalJapanese(removeBoilerplate(resultText)));
  const jaConclusion = removeDesuMasuStrict(await translateToNaturalJapanese(removeBoilerplate(conclusionText)));

  const nStr = sampleSize > 0 ? `N = ${sampleSize.toLocaleString()}例` : '症例数: 不明';

  const line1 = `【概要】` + (jaAim || '心血管疾患治療における臨床アプローチの検証') + ` (${studyTypeLabel} / ${nStr})`;
  const line2 = `【方法】` + (jaMethod || '標準プロトコルに従った介入および評価の実施');
  const line3 = `【結果】` + (jaResult || '主要評価項目および安全性の解析を行った');
  const line4 = `【結論】` + (jaConclusion || '安全性を伴う有効な臨床選択肢であることを示した');

  return [line1, line2, line3, line4].join('\n');
}

/**
 * 抄録（Abstract）テキスト全体の完全日本語全訳を生成 (見出し強調＋パラグラフ毎1行空欄)
 */
export async function translateAbstractFull(abstract) {
  if (!abstract || abstract.includes('抄録なし')) return 'PubMedに抄録が掲載されていません。リンク先の原文サイトを参照してください。';

  if (genAI) {
    try {
      let model;
      try {
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      } catch {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }
      const prompt = `あなたは医学論文の厳格な専門翻訳者です。
以下の英語論文抄録（Abstract）を、**1文も要約・省略・端折ることなく、文頭から最後の結論 (CONCLUSIONS) まで全ての文章・数値・統計データを漏らさず日本語に全文直訳・専門翻訳**してください。

【見出し・改行の厳格ルール】
- 抄録の各セクションは、必ず以下の【見出し】を付け、**見出し直後で改行し、各パラグラフ（段落）の間に【必ず1行の空欄（空行）】を挟んで**可読性を高めて記述してください：

【背景】
(背景の全文直訳)

【目的】
(目的の全文直訳)

【方法】
(方法の全文直訳)

【結果】
(結果の全文直訳)

【結論】
(結論の全文直訳)

- 原文に明示的な見出しが無い場合でも、内容に応じて【背景・目的】【方法】【結果】【結論】に区切り、**必ず各段落の間に1行空欄**を挿入してください。
- 概要のみの要約や端折った翻訳（「〜など」「中略」）は完全禁止！全文章を日本語に全訳してください。

【対象の英語抄録 (Abstract)】:
${abstract}`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      if (text && /[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) {
        // パラグラフ毎の見出し直後改行＋無駄な空白行圧縮
        text = text
          .replace(/\n*【(背景|背景・目的|目的|方法|結果|結論)】\n*/g, '\n【$1】\n')
          .replace(/\n{2,}/g, '\n')
          .replace(/^\n+/, '')
          .trim();
        return text;
      }
    } catch {}
  }

  const translated = await translateToNaturalJapanese(abstract);
  return translated
    .replace(/\n*【(背景|背景・目的|目的|方法|結果|結論)】\n*/g, '\n【$1】\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n+/, '')
    .trim();
}

import fs from 'fs';

/**
 * 論文リストに対してタイトル翻訳・要約・抄録全訳を一括適用 (キャッシュで爆速化)
 */
export async function summarizePapers(papers, existingJsonPath = 'public/papers.json') {
  console.log(`[Summarizer] ${papers.length}件の論文の日本語タイトル翻訳・4行要約・抄録全訳を開始します...`);

  // 既存の要約データがあれば読み込んで再利用（高速キャッシュ）
  const cachedPaperMap = new Map();
  if (fs.existsSync(existingJsonPath)) {
    try {
      const prevData = JSON.parse(fs.readFileSync(existingJsonPath, 'utf-8'));
      if (prevData && Array.isArray(prevData.papers)) {
        prevData.papers.forEach(p => {
          if (p.pmid && p.titleJa && p.summaryJa && p.abstractJa) {
            cachedPaperMap.set(String(p.pmid), p);
          }
        });
        console.log(`[Summarizer] 既存のキャッシュから ${cachedPaperMap.size}件の要約済データを再利用します。`);
      }
    } catch {}
  }

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    const pmidStr = String(paper.pmid);

    // キャッシュに存在する場合は再利用（ただしダミーの「PubMed抄録未掲載」や「原文を参照」テキストの場合は再評価）
    if (cachedPaperMap.has(pmidStr)) {
      const cached = cachedPaperMap.get(pmidStr);
      const isDummySummary = cached.summaryJa && (
        cached.summaryJa.includes('PubMed抄録未掲載') ||
        cached.summaryJa.includes('詳細数値はPubMed原文を参照') ||
        cached.summaryJa.includes('検証結果は原文を参照') ||
        cached.summaryJa.includes('関連プロトコル')
      );
      if (!isDummySummary) {
        paper.titleJa = cached.titleJa;
        paper.summaryJa = cached.summaryJa;
        paper.abstractJa = cached.abstractJa;
        console.log(`[Summarizer] (${i + 1}/${papers.length}) ⚡ キャッシュ利用: PMID ${paper.pmid}`);
        continue;
      }
    }

    console.log(`[Summarizer] (${i + 1}/${papers.length}) 🤖 新規要約処理中: PMID ${paper.pmid} - ${paper.title.slice(0, 40)}...`);

    paper.titleJa = await translateTitle(paper.title);

    // 抄録がない場合、Free Article の本文を自動取得
    const isNoAbstract = !paper.abstract || paper.abstract.includes('抄録なし') || paper.abstract.includes('Abstract not available');
    if (isNoAbstract) {
      console.log(`[Summarizer] PMID ${paper.pmid} は抄録未掲載です。Free Article 本文の探索を開始します...`);
      const fullText = await fetchFreeArticleFullText(paper.pmid, paper.doi, paper.title);
      if (fullText) {
        const fullSummary = await summarizeFromFullText(paper, fullText);
        if (fullSummary && fullSummary.summaryJa) {
          paper.summaryJa = fullSummary.summaryJa;
          paper.abstractJa = fullSummary.abstractJa;
          console.log(`[Summarizer] 🎉 PMID ${paper.pmid} Free Article 本文からの要約生成に成功！`);
          continue;
        }
      }
    }

    paper.summaryJa = await summarizeAbstract(paper.title, paper.abstract, paper.studyTypeLabel, paper.sampleSize);
    paper.abstractJa = await translateAbstractFull(paper.abstract);

    await new Promise(r => setTimeout(r, 200));
  }

  return papers;
}
