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
 * PubMed APIから過去3ヶ月の指定主要雑誌（Heart Rhythm, Europace, JACC EP, Circ EP, JCE, Circulation, Eur Heart J, J Arrhythm, 心電図 等）の論文をバランス良く取得
 */
export async function fetchCatheterAblationPapers(daysPast = 90, maxResults = 150) {
  const keywordTerm = `("catheter ablation"[Title/Abstract] OR "pulsed field ablation"[Title/Abstract] OR "arrhythmia"[Title/Abstract] OR "arrhythmias"[Title/Abstract] OR "catheter ablation"[MeSH Terms] OR "pulsed field ablation"[MeSH Terms] OR "arrhythmias, cardiac"[MeSH Terms])`;

  // 各主要雑誌グループ (全12グループ)
  const journalGroups = [
    { name: 'European Heart Journal (EHJ)', query: '("European Heart Journal"[Journal] OR "Eur Heart J"[Journal])' },
    { name: 'Circulation', query: '("Circulation"[Journal])' },
    { name: 'Journal of Arrhythmia (JoA)', query: '("Journal of Arrhythmia"[Journal] OR "J Arrhythm"[Journal])' },
    { name: 'Heart Rhythm', query: '("Heart Rhythm"[Journal] OR "Heart Rhythm O2"[Journal])' },
    { name: 'EP Europace', query: '("Europace"[Journal])' },
    { name: 'JACC EP', query: '("JACC Clin Electrophysiol"[Journal])' },
    { name: 'Circ EP', query: '("Circ Arrhythm Electrophysiol"[Journal])' },
    { name: 'JCE', query: '("J Cardiovasc Electrophysiol"[Journal])' },
    { name: 'JICE', query: '("J Interv Card Electrophysiol"[Journal])' },
    { name: 'Heart Rhythm Case Rep', query: '("Heart Rhythm Case Rep"[Journal])' },
    { name: 'NEJM / Nat Med', query: '("N Engl J Med"[Journal] OR "Nat Med"[Journal])' },
    { name: '和文誌 心電図', query: '("Shin-denzu"[Journal] OR "Japanese Journal of Electrocardiology"[Journal] OR "Shinzo"[Journal])' }
  ];

  console.log(`[PubMed Fetcher] 全${journalGroups.length}の対象主要雑誌から過去${daysPast}日間の論文を各誌10本ずつ均等に収集します...`);

  let allIds = [];
  const searchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';

  for (const group of journalGroups) {
    try {
      const searchTerm = `${keywordTerm} AND ${group.query}`;
      const res = await axios.get(searchUrl, {
        params: {
          db: 'pubmed',
          term: searchTerm,
          reldate: daysPast,
          datetype: 'pdat',
          sort: 'pub_date',
          retmax: 10,
          retmode: 'json'
        }
      });
      const ids = res.data?.esearchresult?.idlist || [];
      console.log(`[PubMed Fetcher] ${group.name}: ${ids.length}件ヒット`);
      allIds.push(...ids);
    } catch (err) {
      console.warn(`[PubMed Fetcher] ${group.name} 取得エラー:`, err.message);
    }
    // NCBI API レートリミット (429 Error) 回避のため短いウェイトを挿入
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  // 重複IDの除去
  let idList = Array.from(new Set(allIds));

  // ヒットが少ない場合の全体補完
  if (idList.length < 30) {
    console.log(`[PubMed Fetcher] 各誌個別のヒット合計 (${idList.length}件) のため、全体補完検索を実施...`);
    const allJournalQuery = `("Europace"[Journal] OR "Heart Rhythm"[Journal] OR "Heart Rhythm O2"[Journal] OR "J Interv Card Electrophysiol"[Journal] OR "JACC Clin Electrophysiol"[Journal] OR "Circ Arrhythm Electrophysiol"[Journal] OR "Heart Rhythm Case Rep"[Journal] OR "J Cardiovasc Electrophysiol"[Journal] OR "Nat Med"[Journal] OR "N Engl J Med"[Journal] OR "Journal of Arrhythmia"[Journal] OR "J Arrhythm"[Journal] OR "Circulation"[Journal] OR "European Heart Journal"[Journal] OR "Eur Heart J"[Journal])`;
    const fallbackRes = await axios.get(searchUrl, {
      params: { db: 'pubmed', term: `${keywordTerm} AND ${allJournalQuery}`, reldate: daysPast, datetype: 'pdat', sort: 'pub_date', retmax: maxResults, retmode: 'json' }
    });
    const fallbackIds = fallbackRes.data?.esearchresult?.idlist || [];
    idList = Array.from(new Set([...idList, ...fallbackIds]));
  }

  idList = idList.slice(0, maxResults);
  console.log(`[PubMed Fetcher] 最終収集論文数: ${idList.length}件`);

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

      // 書簡・手紙・コメント・Editorial (Letter, Response, Reply, Comment等) の厳格除外判定
      const pubTypesRaw = article.PublicationTypeList?.PublicationType;
      const pubTypes = Array.isArray(pubTypesRaw) ? pubTypesRaw : (pubTypesRaw ? [pubTypesRaw] : []);
      const pubTypeNames = pubTypes.map(pt => extractTextContent(pt).toLowerCase());
      const lowerTitle = title.toLowerCase();

      const isLetterOrComment = pubTypeNames.some(pt => 
        pt.includes('letter') || pt.includes('comment') || pt.includes('editorial') || 
        pt.includes('erratum') || pt.includes('reply') || pt.includes('news') || pt.includes('correspondence')
      ) || 
      lowerTitle.startsWith('letter ') || lowerTitle.startsWith('letter:') || lowerTitle.includes('letter by ') || lowerTitle.includes('letter regarding') || lowerTitle.includes('letter to') ||
      lowerTitle.startsWith('response ') || lowerTitle.startsWith('response:') || lowerTitle.includes('response by ') || lowerTitle.includes('response to ') || lowerTitle.includes('in response') ||
      lowerTitle.startsWith('reply ') || lowerTitle.startsWith('reply:') || lowerTitle.includes('reply to ') || lowerTitle.includes('reply by ') || lowerTitle.includes('author reply') || lowerTitle.includes("author's reply") || lowerTitle.includes("authors' reply") ||
      lowerTitle.startsWith('comment ') || lowerTitle.includes('comment on ') || lowerTitle.includes('comments on ') || lowerTitle.startsWith('editorial') || lowerTitle.includes('corrigendum');

      if (isLetterOrComment) {
        console.log(`[PubMed Fetcher] 🚫 書簡/手紙/回答/コメント論文を除外しました: PMID ${pmid} - ${title.slice(0, 50)}...`);
        continue;
      }

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

      // 指定主要誌 (EP Europace, Heart Rhythm, JICE, JACC EP, Circ EP, Heart Rhythm Case Reports, JCE, Nature Medicine, NEJM, Journal of Arrhythmia, Circulation, European Heart Journal, 心電図/Shinzo) の判定
      const lowerJournal = journalTitle.toLowerCase();
      const lowerAbbr = journalAbbr.toLowerCase();
      const isTargetJournal = [
        'europace', 'heart rhythm', 'interventional cardiac electrophysiology',
        'jacc', 'circulation', 'cardiovascular electrophysiology',
        'nature medicine', 'nat med', 'new england journal', 'n engl j med', 'nejm',
        'journal of arrhythmia', 'j arrhythm', 'european heart journal', 'eur heart j',
        'shin-denzu', 'shinzo', 'electrocardiology', '心電図'
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
