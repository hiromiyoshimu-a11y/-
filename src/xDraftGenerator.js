import fs from 'fs';
import path from 'path';

const NOTE_URL = 'https://note.com/dreamy_weasel596/n/n862b06f366b9';

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
 * 指定加重文字数以内に文字列を丸める（どうしても収まらない極長タイトル用の最終フォールバック）
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

/**
 * 1本紹介ドラフト（タイトルを途中で切らずに全文入れる）
 */
function buildSinglePaperDraft(label, paper, tags) {
  const jShort = shortenJournal(paper);
  const header = `${label}（${jShort}）\n`;
  const title = String(paper.titleJa || paper.title || '').trim();

  const footers = [
    `\n\n日本語ポイント・抄録全訳👇\n${NOTE_URL}\n${tags}`,
    `\n\n詳細・全訳👇\n${NOTE_URL}\n#循環器内科 #不整脈`,
    `\n\n${NOTE_URL}\n#循環器内科`
  ];

  for (const footer of footers) {
    const candidate = `${header}${title}${footer}`;
    if (xWeightedLength(candidate) <= 280) {
      return candidate;
    }
  }

  const minFooter = footers[footers.length - 1];
  const remaining = 280 - xWeightedLength(header + minFooter);
  return `${header}${truncateByWeighted(title, Math.max(40, remaining))}${minFooter}`;
}

/**
 * まとめ紹介ドラフト（途中で切れない本数だけ、各論文のフルタイトルを入れる）
 */
function buildDigestDraft(papers, tags) {
  const header = '今週の不整脈・EP主要誌ピックアップ⚡\n';
  const footer = `\n\n日本語ポイント・抄録全訳👇\n${NOTE_URL}\n${tags}`;
  const budget = 280 - xWeightedLength(header + footer);
  const bullets = ['①', '②', '③'];

  const selectedLines = [];
  let used = 0;

  for (const p of papers) {
    if (selectedLines.length >= 3) break;
    const title = String(p.titleJa || p.title || '').trim();
    const line = `${bullets[selectedLines.length]}${shortenJournal(p)}：${title}`;
    const lineCost = xWeightedLength(line) + (selectedLines.length > 0 ? 1 : 0);
    if (used + lineCost <= budget) {
      selectedLines.push(line);
      used += lineCost;
    }
  }

  // 1本も入らなかった場合のフォールバック
  if (selectedLines.length === 0 && papers.length > 0) {
    return buildSinglePaperDraft('【今週のピックアップ】', papers[0], tags);
  }

  return `${header}${selectedLines.join('\n')}${footer}`;
}

/**
 * 論文配列から X 投稿用の半自動下書き3パターンを生成する（リンクはすべて note に統一）
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
      title: '案1：注目論文 1本紹介（火〜水曜向け）',
      body: buildSinglePaperDraft('【注目論文】', pick1, '#循環器内科 #不整脈 #アブレーション')
    },
    {
      title: '案2：今週の主要誌ピックアップ（木〜金曜向け）',
      body: buildDigestDraft([pick1, pick2, pick3], '#循環器内科 #不整脈')
    },
    {
      title: '案3：別論文 1本紹介（週末向け）',
      body: buildSinglePaperDraft('【EP論文ピック】', pick2, '#循環器内科 #不整脈 #PFA')
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
