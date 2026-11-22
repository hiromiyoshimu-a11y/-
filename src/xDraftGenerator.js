import fs from 'fs';
import path from 'path';

const NOTE_URL = 'https://note.com/dreamy_weasel596/n/n862b06f366b9';
const WEB_URL = 'https://hiromiyoshimu-a11y.github.io/-/';

/**
 * X (Twitter) の加重文字数を計算する（URL=23、ASCII=1、全角=2、上限280）
 */
export function xWeightedLength(text) {
  const urlRegex = /https?:\/\/\S+/g;
  const urls = text.match(urlRegex) || [];
  const withoutUrls = text.replace(urlRegex, '');
  let len = urls.length * 23;
  for (const ch of withoutUrls) {
    len += ch.charCodeAt(0) <= 0x7f ? 1 : 2;
  }
  return len;
}

/**
 * 指定加重文字数以内に文字列を丸める
 */
function truncateByWeighted(str, maxWeighted) {
  let out = '';
  let w = 0;
  for (const ch of String(str || '').trim()) {
    const cw = ch.charCodeAt(0) <= 0x7f ? 1 : 2;
    if (w + cw > maxWeighted - 2) {
      return out.trim() + '…';
    }
    out += ch;
    w += cw;
  }
  return out;
}

/**
 * summaryJa から X 向けの簡潔な臨床ポイントを抽出する
 */
function extractClinicalSnippet(paper) {
  const raw = String(paper.summaryJa || '')
    .replace(/【[^】]+】/g, '')
    .replace(/\([^)]*N\s*=\s*\d+[^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  const sentences = raw.split(/(?<=。)/).filter(Boolean);
  // 結論寄りの文または先頭文を優先
  const last = sentences[sentences.length - 1] || '';
  if (sentences.length >= 2 && last.length >= 15 && last.length <= 75) {
    return last.trim();
  }
  return sentences[0] ? sentences[0].trim() : raw;
}

function shortenJournal(paper) {
  const j = String(paper.journalAbbr || paper.journal || '').trim();
  if (/new england/i.test(j) || /^nejm/i.test(j)) return 'NEJM';
  if (/european heart/i.test(j)) return 'EHJ';
  if (/jacc.*electrophys/i.test(j)) return 'JACC EP';
  if (/circ.*arrhythm/i.test(j)) return 'Circ EP';
  if (/heart rhythm o2/i.test(j)) return 'Heart Rhythm O2';
  if (/heart rhythm case/i.test(j)) return 'HR Case Rep';
  if (/heart rhythm/i.test(j)) return 'Heart Rhythm';
  if (/europace/i.test(j)) return 'EP Europace';
  if (/cardiovascular electrophys/i.test(j)) return 'JCE';
  if (/interventional cardiac electrophys/i.test(j)) return 'JICE';
  if (/journal of arrhythmia/i.test(j)) return 'JoA';
  if (/circulation/i.test(j)) return 'Circulation';
  if (/jama/i.test(j)) return 'JAMA';
  return j.slice(0, 18);
}

/**
 * X 投稿向けの注目度スコアを算出
 */
function scorePaperForX(paper) {
  let score = 0;
  if (paper.isNew) score += 50;
  const designRank = Number(paper.designRank || 0);
  if (designRank >= 4) score += 30;
  else if (designRank === 3) score += 20;
  else if (designRank === 2) score += 10;

  const sample = Number(paper.sampleSize || 0);
  if (sample >= 1000) score += 20;
  else if (sample >= 100) score += 12;
  else if (sample >= 30) score += 6;

  const text = `${paper.title || ''} ${paper.titleJa || ''}`;
  if (/pulsed[- ]field|\bpfa\b|パルスフィールド/i.test(text)) score += 22;
  if (/atrial fibrillation|\baf\b|心房細動/i.test(text)) score += 8;
  if (/ventricular tachycardia|\bvt\b|心室頻拍/i.test(text)) score += 8;

  const j = String(paper.journal || '');
  if (/new england|circulation|european heart|jama|heart rhythm|europace|jacc/i.test(j)) {
    score += 12;
  }
  if (!paper.titleJa || !paper.summaryJa) score -= 100;
  return score;
}

function buildSinglePaperDraft(label, paper, url, tags) {
  const jShort = shortenJournal(paper);
  const header = `${label}（${jShort}）\n`;
  const footer = `\n\n日本語ポイント・抄録全訳👇\n${url}\n${tags}`;
  const remaining = 280 - xWeightedLength(header + footer) - 4;

  const titleMax = Math.min(110, Math.floor(remaining * 0.48));
  const titlePart = truncateByWeighted(paper.titleJa || paper.title, titleMax);

  const snippet = extractClinicalSnippet(paper);
  const pointMax = Math.max(40, remaining - xWeightedLength(titlePart) - 6);
  const pointPart = snippet ? `\n💡 ${truncateByWeighted(snippet, pointMax)}` : '';

  return `${header}${titlePart}${pointPart}${footer}`;
}

function buildDigestDraft(papers, url, tags) {
  const header = '今週の不整脈・EP主要誌ピックアップ⚡\n';
  const footer = `\n日本語ポイント＆全訳はこちら👇\n${url}\n${tags}`;
  const budget = 280 - xWeightedLength(header + footer) - 6;
  const perItem = Math.floor(budget / Math.max(1, papers.length));

  const lines = papers.map((p, idx) => {
    const prefix = `${['①', '②', '③'][idx] || `${idx + 1}.`}${shortenJournal(p)}：`;
    const body = truncateByWeighted(p.titleJa || p.title, Math.max(24, perItem - xWeightedLength(prefix) - 2));
    return `${prefix}${body}`;
  });
  return `${header}${lines.join('\n')}${footer}`;
}

/**
 * 論文配列から X 投稿用の半自動下書き3パターンを生成する
 * @param {Array} papers
 * @returns {{ text: string, drafts: Array<{title: string, body: string, weightedLength: number}> }}
 */
export function buildXPostDrafts(papers = []) {
  const ranked = [...papers]
    .filter((p) => p && p.titleJa && p.summaryJa)
    .sort((a, b) => scorePaperForX(b) - scorePaperForX(a));

  if (ranked.length === 0) {
    return { text: '', drafts: [] };
  }

  const pick1 = ranked[0];
  const pick2 = ranked.find((p) => p.pmid !== pick1.pmid && p.journal !== pick1.journal) || ranked[1] || pick1;
  const pick3 = ranked.find((p) => p.pmid !== pick1.pmid && p.pmid !== pick2.pmid) || ranked[2] || pick2;

  const drafts = [
    {
      title: '案1：注目論文 1本紹介（note記事誘導 / 火〜水曜向け）',
      body: buildSinglePaperDraft('【注目論文】', pick1, NOTE_URL, '#循環器内科 #不整脈 #アブレーション')
    },
    {
      title: '案2：今週の主要誌まとめ 3本（Web版誘導 / 木〜金曜向け）',
      body: buildDigestDraft([pick1, pick2, pick3], WEB_URL, '#循環器内科 #不整脈')
    },
    {
      title: '案3：別論文 1本紹介（デバイス・VT等 / 週末向け）',
      body: buildSinglePaperDraft('【EP論文ピック】', pick2, WEB_URL, '#循環器内科 #不整脈 #PFA')
    }
  ].map((d) => ({
    ...d,
    weightedLength: xWeightedLength(d.body)
  }));

  const text = [
    '====================================================',
    '📱 X（旧Twitter）投稿用 下書き（そのままコピーして使えます）',
    '====================================================',
    ...drafts.map((d) => `\n▼ ${d.title} [${d.weightedLength}/280]\n--------------------\n${d.body}\n--------------------`),
    ''
  ].join('\n');

  try {
    const outDir = path.resolve('outputs');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'x_post_drafts.txt'), text, 'utf-8');
  } catch {
    // outputs書き込み失敗時はスキップ
  }

  return { text, drafts };
}
