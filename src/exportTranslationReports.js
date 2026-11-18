import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';

const NTFY_TOPIC = 'ep_pfa_translation_reports_y3liigs4';
const OUTPUT_DIR = path.resolve('outputs');
const JSON_PATH = path.join(OUTPUT_DIR, 'translation_reports.json');
const XLSX_PATH = path.join(OUTPUT_DIR, 'translation_reports.xlsx');

function formatJst(isoStr) {
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return String(isoStr || '');
    return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  } catch {
    return String(isoStr || '');
  }
}

async function fetchNtfyReports() {
  const url = `https://ntfy.sh/${NTFY_TOPIC}/json?poll=1&since=all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ntfy fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const reports = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      if (evt.event !== 'message' || !evt.message) continue;
      const payload = JSON.parse(evt.message);
      if (payload && payload.originalEn && payload.suggestedJa) {
        reports.push({
          id: String(payload.id || evt.id || `${evt.time}_${payload.originalEn}`),
          createdAt: payload.createdAt || new Date((evt.time || Date.now() / 1000) * 1000).toISOString(),
          originalEn: String(payload.originalEn).trim(),
          suggestedJa: String(payload.suggestedJa).trim(),
          note: String(payload.note || '').trim(),
          pmid: String(payload.pmid || '').trim(),
          titleJa: String(payload.titleJa || '').trim(),
          status: '未対応',
        });
      }
    } catch {
      // Ignore non-JSON or non-report messages
    }
  }
  return reports;
}

async function generateExcel(reports) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('翻訳報告一覧');

  ws.columns = [
    { header: '報告日時 (JST)', key: 'createdAtJst', width: 22 },
    { header: 'もとの英単語・フレーズ', key: 'originalEn', width: 34 },
    { header: '正しい日本語（提案）', key: 'suggestedJa', width: 34 },
    { header: '補足メモ', key: 'note', width: 28 },
    { header: 'PMID', key: 'pmid', width: 14 },
    { header: '対象論文タイトル', key: 'titleJa', width: 42 },
    { header: 'ステータス', key: 'status', width: 12 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (const r of reports) {
    ws.addRow({
      createdAtJst: formatJst(r.createdAt),
      originalEn: r.originalEn,
      suggestedJa: r.suggestedJa,
      note: r.note,
      pmid: r.pmid,
      titleJa: r.titleJa,
      status: r.status || '未対応',
    });
  }

  ws.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.alignment = { vertical: 'top', wrapText: true };
    }
  });

  await wb.xlsx.writeFile(XLSX_PATH);
}

async function sendNotificationIfNeeded(newCount, totalCount) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFICATION_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !NOTIFICATION_EMAIL || newCount <= 0) {
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({
    from: SMTP_USER,
    to: NOTIFICATION_EMAIL,
    subject: `[EP & PFA Papers] 新規翻訳報告 ${newCount}件（累計 ${totalCount}件）`,
    text: `ユーザーから新しい翻訳修正の報告が ${newCount}件 届きました。\n添付の Excel ファイル（translation_reports.xlsx）をご確認ください。`,
    attachments: [{ filename: 'translation_reports.xlsx', path: XLSX_PATH }],
  });
  console.log(`Notification email sent to ${NOTIFICATION_EMAIL}`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  let existing = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    } catch {
      existing = [];
    }
  }

  const byId = new Map(existing.map(r => [String(r.id), r]));
  let incoming = [];
  try {
    incoming = await fetchNtfyReports();
  } catch (err) {
    console.warn('Could not fetch from ntfy.sh:', err.message);
  }

  let newCount = 0;
  for (const r of incoming) {
    if (!byId.has(r.id)) {
      byId.set(r.id, r);
      newCount++;
    }
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  fs.writeFileSync(JSON_PATH, JSON.stringify(merged, null, 2) + '\n');
  await generateExcel(merged);
  console.log(`Exported ${merged.length} translation reports (${newCount} new) -> ${XLSX_PATH}`);

  await sendNotificationIfNeeded(newCount, merged.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
