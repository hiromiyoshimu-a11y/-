import axios from 'axios';
import { parseStringPromise } from 'xml2js';

/**
 * xml2js でパースされたネスト型オブジェクト/配列からプレーンテキストノードを再帰的に抽出
 * タグ (<i>, <sub>, <b> 等) が混ざった ArticleTitle や AbstractText の JSON 化けを完全に防止
 */
function extractTextContent(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }
  
  if (typeof node === 'object') {
    let result = '';
    // xml2js のテキストノードキー '_' を最優先
    if (node._) {
      result += extractTextContent(node._);
    }
    // その他の子ノード (i, sub, sup, b など) のテキストを連結
    for (const key of Object.keys(node)) {
      if (key !== '_' && key !== '$' && key !== 'Label') {
        const val = extractTextContent(node[key]);
        if (val) {
          result += (result && !result.endsWith(' ') && !val.startsWith(' ') ? ' ' : '') + val;
        }
      }
    }
    return result;
  }
  
  return String(node);
}

/**
 * ノードまたは文字列からプレーンテキストを安全に抽出し、
 * 万が一 JSON オブジェクト形式 (例: {"_":"...", "sub":"V"}) が混入していた場合も完全除去する
 */
export function cleanTextContent(node) {
  if (!node) return '';
  let str = typeof node === 'object' ? extractTextContent(node) : String(node);
  
  // JSON 化け文字列の最終防御
  if (str.includes('{"_":') || str.includes('{ "_":')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed) {
        str = extractTextContent(parsed);
      }
    } catch {
      str = str.replace(/\{\s*"_"\s*:\s*"([^"]+)"[^\}]*\}/g, '$1');
    }
  }

  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * PubMed AbstractText (構造化抄録) から BACKGROUND / OBJECTIVE / METHODS / RESULTS / CONCLUSIONS の各セクションをLabel付きで漏れなく抽出整形
 */
function formatAbstractStructured(absNode) {
  if (!absNode) return '';
  
  const nodes = Array.isArray(absNode) ? absNode : [absNode];
  const parts = [];

  for (const node of nodes) {
    if (typeof node === 'string') {
      const text = cleanTextContent(node);
      if (text) parts.push(text);
      continue;
    }
    
    if (typeof node === 'object' && node) {
      const label = node.Label || node.label || node.NlmCategory || node.nlmCategory || '';
      const content = cleanTextContent(node._ || node);

      if (label && content) {
        const cleanLabel = String(label).toUpperCase().trim();
        parts.push(`${cleanLabel}:\n${content}`);
      } else if (content) {
        parts.push(content);
      }
    }
  }

  let fullAbstract = parts.join('\n\n');

  // ラベルが未付与のテキスト抄録の場合、本文内の見出しキーを検出して改行・空行区切り整形
  if (!/BACKGROUND:\n|METHODS:\n|RESULTS:\n|CONCLUSIONS:\n/i.test(fullAbstract)) {
    fullAbstract = fullAbstract
      .replace(/\b(BACKGROUND|BACKGROUND AND OBJECTIVES?|OBJECTIVE|OBJECTIVES|PURPOSE|INTRODUCTION)[:\s]+/gi, '\n\nBACKGROUND:\n')
      .replace(/\b(METHODS|METHODS AND RESULTS|METHODS AND MATERIALS|PATIENTS AND METHODS|STUDY DESIGN)[:\s]+/gi, '\n\nMETHODS:\n')
      .replace(/\b(RESULTS|FINDINGS)[:\s]+/gi, '\n\nRESULTS:\n')
      .replace(/\b(CONCLUSIONS?|SUMMARY)[:\s]+/gi, '\n\nCONCLUSIONS:\n')
      .trim();
  }

  return fullAbstract;
}

/**
 * PubMed APIから過去3ヶ月の指定9誌（EP Europace, Heart Rhythm, JICE, JACC EP, Circ EP, Heart Rhythm Case Rep, JCE, Nat Med, NEJM）の論文を取得
 */
export async function fetchCatheterAblationPapers(daysPast = 90, maxResults = 100) {
  const keywordTerm = `("catheter ablation"[Title/Abstract] OR "pulsed field ablation"[Title/Abstract] OR "arrhythmia"[Title/Abstract] OR "arrhythmias"[Title/Abstract] OR "catheter ablation"[MeSH Terms] OR "pulsed field ablation"[MeSH Terms] OR "arrhythmias, cardiac"[MeSH Terms])`;
  
  const journalQuery = `("Europace"[Journal] OR "Heart Rhythm"[Journal] OR "Heart Rhythm O2"[Journal] OR "J Interv Card Electrophysiol"[Journal] OR "JACC Clin Electrophysiol"[Journal] OR "Circ Arrhythm Electrophysiol"[Journal] OR "Heart Rhythm Case Rep"[Journal] OR "J Cardiovasc Electrophysiol"[Journal] OR "Nat Med"[Journal] OR "Nature Medicine"[Journal] OR "N Engl J Med"[Journal] OR "New England Journal of Medicine"[Journal])`;

  const searchTerm = `${keywordTerm} AND ${journalQuery}`;

  console.log(`[PubMed Fetcher] PubMedから過去${daysPast}日間の指定9誌論文を検索中...`);

  // 1. esearch.fcgi
  const searchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
  const searchParams = {
    db: 'pubmed',
    term: searchTerm,
    reldate: daysPast,
    datetype: 'pdat',
    sort: 'pub_date',
    retmax: maxResults,
    retmode: 'json'
  };

  let searchRes = await axios.get(searchUrl, { params: searchParams });
  let idList = searchRes.data?.esearchresult?.idlist || [];
  let totalFound = searchRes.data?.esearchresult?.count || 0;

  // 9誌に限定してヒットが少ない場合は全誌検索でフォールバック補完
  if (idList.length < 20) {
    console.log(`[PubMed Fetcher] 指定9誌限定ヒット数 (${idList.length}件) のため、関連誌検索で補完します...`);
    const fallbackRes = await axios.get(searchUrl, {
      params: { ...searchParams, term: keywordTerm }
    });
    const fallbackIds = fallbackRes.data?.esearchresult?.idlist || [];
    const combinedIds = Array.from(new Set([...idList, ...fallbackIds]));
    idList = combinedIds.slice(0, maxResults);
  }

  console.log(`[PubMed Fetcher] 検索ヒット数: ${totalFound}件 (取得対象: 最新${idList.length}件)`);

  if (idList.length === 0) {
    return [];
  }

  // 2. efetch.fcgi
  const fetchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
  const fetchParams = {
    db: 'pubmed',
    id: idList.join(','),
    retmode: 'xml'
  };

  const fetchRes = await axios.get(fetchUrl, { params: fetchParams });
  const xmlData = fetchRes.data;

  // 3. XMLパース
  const parsedXml = await parseStringPromise(xmlData, { explicitArray: false, mergeAttrs: true });
  const articleListRaw = parsedXml.PubmedArticleSet?.PubmedArticle;

  const articlesArray = Array.isArray(articleListRaw)
    ? articleListRaw
    : (articleListRaw ? [articleListRaw] : []);

  const resultPapers = [];

  for (const item of articlesArray) {
    try {
      const medline = item.MedlineCitation;
      const pmid = medline.PMID?._ || medline.PMID;
      const article = medline.Article;

      // 論文タイトルの完全テキスト抽出
      let title = cleanTextContent(article.ArticleTitle) || 'No title available';

      // 雑誌情報
      const journal = article.Journal;
      const journalTitle = cleanTextContent(journal?.Title || journal?.ISOAbbreviation || 'Unknown Journal');
      const journalAbbr = cleanTextContent(journal?.ISOAbbreviation || journalTitle);
      const journalIssue = journal?.JournalIssue;
      const volume = journalIssue?.Volume || '';
      const issue = journalIssue?.Issue || '';
      const pagination = article.Pagination?.MedlinePgn || '';

      // 掲載日 (Publication Date)
      const pubDateObj = journalIssue?.PubDate;
      let pubYear = pubDateObj?.Year || '';
      let pubMonth = pubDateObj?.Month || '';
      let pubDay = pubDateObj?.Day || '';

      if (!pubYear && pubDateObj?.MedlineDate) {
        const match = pubDateObj.MedlineDate.match(/\d{4}/);
        if (match) pubYear = match[0];
        pubMonth = pubDateObj.MedlineDate;
      }

      if (article.ArticleDate) {
        const eDate = Array.isArray(article.ArticleDate) ? article.ArticleDate[0] : article.ArticleDate;
        if (!pubYear) pubYear = eDate.Year || '';
        if (!pubMonth) pubMonth = eDate.Month || '';
        if (!pubDay) pubDay = eDate.Day || '';
      }

      const formattedPubDate = [pubYear, pubMonth, pubDay].filter(Boolean).join('-');

      // 著者リスト
      const rawAuthors = article.AuthorList?.Author;
      const authorArray = Array.isArray(rawAuthors) ? rawAuthors : (rawAuthors ? [rawAuthors] : []);
      const authorsFormatted = authorArray.slice(0, 6).map(a => {
        const lastName = cleanTextContent(a.LastName || '');
        const initials = cleanTextContent(a.Initials || a.ForeName || '');
        return `${lastName} ${initials}`.trim();
      }).filter(Boolean);

      if (authorArray.length > 6) {
        authorsFormatted.push('et al.');
      }
      const authorsStr = authorsFormatted.join(', ');

      // DOI
      let doi = '';
      const articleIds = item.PubmedData?.ArticleIdList?.ArticleId;
      const idArray = Array.isArray(articleIds) ? articleIds : (articleIds ? [articleIds] : []);
      const doiObj = idArray.find(id => id.IdType === 'doi');
      if (doiObj) {
        doi = cleanTextContent(doiObj);
      }

      // 抄録 (Abstract) - BACKGROUND / OBJECTIVE / METHODS / RESULTS / CONCLUSIONS を漏れなく抽出
      let abstractText = '';
      if (article.Abstract?.AbstractText) {
        abstractText = formatAbstractStructured(article.Abstract.AbstractText);
      }

      // 出典フォーマット (Vancouver)
      let citation = `${authorsStr ? authorsStr + '. ' : ''}${title}. ${journalAbbr}. ${pubYear}${pubMonth ? ' ' + pubMonth : ''}${pubDay ? ' ' + pubDay : ''};${volume}${issue ? '(' + issue + ')' : ''}:${pagination}.`;
      if (doi) {
        citation += ` doi: ${doi}.`;
      }

      const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

      // 研究デザイン判定 & 症例数 (N) 抽出
      const pubTypesRaw = article.PublicationTypeList?.PublicationType;
      const pubTypes = Array.isArray(pubTypesRaw) ? pubTypesRaw : (pubTypesRaw ? [pubTypesRaw] : []);
      const pubTypeNames = pubTypes.map(pt => extractTextContent(pt).toLowerCase());

      const lowerTitle = title.toLowerCase();
      const lowerAbs = abstractText.toLowerCase();

      let designRank = 3;
      let studyTypeLabel = '観察研究・その他';

      const isCaseReport = pubTypeNames.some(pt => pt.includes('case report')) ||
        lowerTitle.includes('case report') || lowerTitle.includes('a case of') || lowerTitle.includes('case series') ||
        lowerTitle.startsWith('case ') || lowerAbs.includes('presenting a case');

      const isRCT = pubTypeNames.some(pt => pt.includes('randomized controlled trial') || pt.includes('clinical trial')) ||
        lowerTitle.includes('randomized') || lowerTitle.includes('randomised') || lowerAbs.includes('randomized controlled') || lowerAbs.includes('randomised controlled');

      const isProspective = lowerTitle.includes('prospective') || lowerAbs.includes('prospective study') || lowerAbs.includes('prospectively enrolled') || lowerAbs.includes('prospective registry');

      if (isCaseReport) {
        designRank = 99;
        studyTypeLabel = '症例報告 (Case Report)';
      } else if (isRCT) {
        designRank = 1;
        studyTypeLabel = '無作為化比較試験 (RCT)';
      } else if (isProspective) {
        designRank = 2;
        studyTypeLabel = '前向き研究 (Prospective)';
      }

      let sampleSize = 0;
      if (!isCaseReport) {
        const nMatch = lowerAbs.match(/\bn\s*=\s*(\d+[\d,]*)\b/) ||
          lowerAbs.match(/\b(\d+[\d,]*)\s*(patients|subjects|cases|participants|individuals)\b/) ||
          lowerAbs.match(/\benrolled\s+(\d+[\d,]*)\b/);

        if (nMatch) {
          const numStr = nMatch[1].replace(/,/g, '');
          const val = parseInt(numStr, 10);
          if (!isNaN(val) && val < 1000000) {
            sampleSize = val;
          }
        }
      } else {
        sampleSize = 1;
      }

      // 指定9誌 (EP Europace, Heart Rhythm, JICE, JACC EP, Circ EP, Heart Rhythm Case Reports, JCE, Nature Medicine, NEJM) の判定
      const lowerJournal = journalTitle.toLowerCase();
      const lowerAbbr = journalAbbr.toLowerCase();
      const isTargetJournal = [
        'europace', 'heart rhythm', 'interventional cardiac electrophysiology',
        'jacc', 'circulation: arrhythmia', 'cardiovascular electrophysiology',
        'nature medicine', 'nat med', 'new england journal', 'n engl j med', 'nejm'
      ].some(jKey => lowerJournal.includes(jKey) || lowerAbbr.includes(jKey));

      resultPapers.push({
        pmid,
        title,
        pubDate: formattedPubDate || pubYear || 'N/A',
        journal: journalTitle,
        journalAbbr,
        volumeIssuePage: `${volume}${issue ? '(' + issue + ')' : ''}${pagination ? ':' + pagination : ''}`,
        authors: authorsStr,
        citation,
        doi,
        url,
        abstract: abstractText || '抄録なし (Abstract not available)',
        designRank,
        studyTypeLabel,
        sampleSize,
        isTargetJournal
      });
    } catch (err) {
      console.warn(`[PubMed Fetcher] 論文パースエラー:`, err.message);
    }
  }

  // 掲載順ソート:
  // 1. 研究デザイン (RCT:1 -> 前向き:2 -> 一般:3 -> 症例報告:99)
  // 2. 指定9主要誌優先
  // 3. 症例数(N)が多い順
  // 4. PMIDの新しい順
  resultPapers.sort((a, b) => {
    if (a.designRank !== b.designRank) {
      return a.designRank - b.designRank;
    }
    if (a.isTargetJournal !== b.isTargetJournal) {
      return b.isTargetJournal ? 1 : -1;
    }
    if (b.sampleSize !== a.sampleSize) {
      return b.sampleSize - a.sampleSize;
    }
    return b.pmid - a.pmid;
  });

  return resultPapers;
}
