import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

function cleanString(str) {
  if (!str) return '';
  let s = String(str);
  if (s.includes('{"_":') || s.includes('{ "_":')) {
    try {
      const parsed = JSON.parse(s);
      if (parsed) {
        if (parsed._) s = parsed._;
        else s = Object.values(parsed).filter(v => typeof v === 'string').join(' ');
      }
    } catch {
      s = s.replace(/\{\s*"_"\s*:\s*"([^"]+)"[^\}]*\}/g, '$1');
    }
  }
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 論文データ配列からExcelファイルを生成
 * @param {Array} papers 論文データ
 * @param {string} outputFilePath 出力ファイルパス
 * @returns {Promise<string>} 生成されたファイルの絶対パス
 */
export async function generateExcelReport(papers, outputFilePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Catheter Ablation & PFA Paper Summarizer';
  workbook.lastModifiedBy = 'Auto System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('最新論文一覧', {
    views: [{ showGridLines: true }]
  });

  // 1. タイトル & メタデータブロック
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = '⚡ カテーテル / パルスフィールドアブレーション & 不整脈 最新論文要約レポート';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: '1F4E78' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 30;

  const todayStr = new Date().toISOString().split('T')[0];
  worksheet.getCell('A2').value = `作成日: ${todayStr} | 過去3ヶ月のPubMed論文 | 並び順: RCT/前向き(症例数順) ＞ 一般論文 ＞ 症例報告 | 該当数: ${papers.length}件`;
  worksheet.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: '595959' } };
  worksheet.getRow(2).height = 18;

  // 空白行
  worksheet.getRow(3).height = 8;

  // 2. テーブルヘッダーの定義
  const headers = [
    { header: 'No.', key: 'no', width: 6 },
    { header: '掲載日', key: 'pubDate', width: 13 },
    { header: '論文タイトル (日本語訳 / 原題英語)', key: 'title', width: 42 },
    { header: '日本語抄録要約 (臨床要点5行)', key: 'summaryJa', width: 90 },
    { header: '雑誌名・巻号', key: 'journalInfo', width: 24 },
    { header: '研究デザイン / 症例数(N)', key: 'studyType', width: 25 },
    { header: '参考論文用 出典フォーマット (Vancouver形式)', key: 'citation', width: 45 },
    { header: 'PubMed URL', key: 'url', width: 35 }
  ];

  const headerRowNumber = 4;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNum = idx + 1;
    const cell = headerRow.getCell(colNum);
    cell.value = h.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F4E78' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: '1F4E78' } },
      bottom: { style: 'medium', color: { argb: '0F283D' } },
      left: { style: 'thin', color: { argb: '335C85' } },
      right: { style: 'thin', color: { argb: '335C85' } }
    };

    worksheet.getColumn(colNum).width = h.width;
  });

  // 3. データ行の書き込み
  papers.forEach((paper, idx) => {
    const rowNum = headerRowNumber + 1 + idx;
    const row = worksheet.getRow(rowNum);

    const isEven = idx % 2 === 1;
    let rowBgColor = isEven ? 'F9FAFB' : 'FFFFFF';

    let badgeColor = 'E2E8F0';
    if (paper.designRank === 1) {
      badgeColor = 'D1FAE5'; // RCT: 薄い緑
    } else if (paper.designRank === 2) {
      badgeColor = 'E0F2FE'; // 前向き: 薄い青
    } else if (paper.designRank === 99) {
      badgeColor = 'FEE2E2'; // 症例報告: 薄い赤
    }

    // 1: No.
    const cellNo = row.getCell(1);
    cellNo.value = idx + 1;
    cellNo.alignment = { vertical: 'top', horizontal: 'center' };

    // 2: 掲載日
    const cellPubDate = row.getCell(2);
    cellPubDate.value = paper.pubDate;
    cellPubDate.alignment = { vertical: 'top', horizontal: 'center' };

    // 3: 論文タイトル (日本語訳 + 英語原題) ➔ 個別シートへ内部ハイパーリンクジャンプ
    const detailSheetName = `P${idx + 1}_${paper.pmid}`.slice(0, 30);
    const cellTitle = row.getCell(3);
    const rawJa = cleanString(paper.titleJa || paper.title);
    const rawEn = cleanString(paper.title);
    const titleCombinedText = rawJa !== rawEn 
      ? `${rawJa}\n(${rawEn})`
      : `${rawJa}`;

    cellTitle.value = {
      text: titleCombinedText,
      hyperlink: `#'${detailSheetName}'!A1`,
      tooltip: 'クリックして個別抄録・日本語全訳シートへ移動'
    };
    cellTitle.font = { name: 'Calibri', size: 10, color: { argb: '0563C1' }, underline: true, bold: true };
    cellTitle.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

    // 4: 日本語抄録要約
    const cellSummary = row.getCell(4);
    cellSummary.value = paper.summaryJa || '（要約処理中）';
    cellSummary.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    cellSummary.font = { name: '游ゴシック', size: 9.5 };

    // 5: 雑誌名・巻号
    const cellJournal = row.getCell(5);
    cellJournal.value = `${paper.journalAbbr || paper.journal}\n${paper.volumeIssuePage}`;
    cellJournal.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

    // 6: 研究デザイン / 症例数
    const cellType = row.getCell(6);
    const nStr = paper.sampleSize > 0 ? `N = ${paper.sampleSize.toLocaleString()}例` : '症例数: 不明';
    cellType.value = `${paper.studyTypeLabel}\n${nStr}`;
    cellType.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
    cellType.font = { name: 'Calibri', size: 9.5, bold: paper.designRank <= 2 };

    // 7: 出典フォーマット
    const cellCitation = row.getCell(7);
    cellCitation.value = paper.citation;
    cellCitation.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    cellCitation.font = { name: 'Calibri', size: 9.5, italic: true };

    // 8: PubMed URL
    const cellUrl = row.getCell(8);
    cellUrl.value = paper.url;
    cellUrl.alignment = { vertical: 'top', horizontal: 'left' };
    cellUrl.font = { name: 'Calibri', size: 9.5, color: { argb: '0563C1' } };

    // 行スタイル一括適用（背景色・罫線）
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c === 6 ? badgeColor : rowBgColor }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
      if (c !== 3 && c !== 4 && c !== 7) {
        cell.font = cell.font || { name: 'Calibri', size: 10 };
      }
    }

    // 行高計算
    const summaryText = paper.summaryJa || '';
    const explicitLines = summaryText.split('\n');
    let totalLinesNeeded = 0;
    explicitLines.forEach(line => {
      totalLinesNeeded += Math.ceil(line.length / 42) || 1;
    });

    const titleText = titleCombinedText || '';
    const titleLinesNeeded = Math.ceil(titleText.length / 24) || 1;
    const actualLines = Math.max(totalLinesNeeded, titleLinesNeeded);
    row.height = Math.max(55, Math.min(220, actualLines * 16.0 + 4));

    // ------------------------------------------------------------------
    // 4. 個別論文詳細シート (抄録全訳・英語原文・メタデータ) の自動生成
    // ------------------------------------------------------------------
    const detailSheet = workbook.addWorksheet(detailSheetName, {
      views: [{ showGridLines: true }]
    });

    // 列幅設定
    detailSheet.getColumn(1).width = 18;
    detailSheet.getColumn(2).width = 85;

    // A1: 戻るボタン
    const backCell = detailSheet.getCell('A1');
    backCell.value = {
      text: '⬅ 最新論文一覧に戻る',
      hyperlink: "#'最新論文一覧'!A4",
      tooltip: 'メインの最新論文一覧シートに戻ります'
    };
    backCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '0563C1' }, underline: true };
    detailSheet.getRow(1).height = 24;

    // A3:H3 タイトルブロック
    detailSheet.mergeCells('A3:B3');
    const titleHeaderCell = detailSheet.getCell('A3');
    titleHeaderCell.value = `📄 [No.${idx + 1}] ${rawJa}\n(${rawEn})`;
    titleHeaderCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFF' } };
    titleHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
    titleHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    detailSheet.getRow(3).height = 45;

    // メタデータ行群
    const metaData = [
      ['掲載日', paper.pubDate],
      ['雑誌名・巻号', `${paper.journal} (${paper.journalAbbr}) ${paper.volumeIssuePage}`],
      ['研究デザイン / 症例数', `${paper.studyTypeLabel} (N = ${paper.sampleSize > 0 ? paper.sampleSize.toLocaleString() + '例' : '不明'})`],
      ['著者', paper.authors],
      ['DOI', paper.doi || 'N/A'],
      ['PubMed URL', paper.url],
      ['出典 (Vancouver)', paper.citation]
    ];

    let currRow = 5;
    metaData.forEach(([label, val]) => {
      const labelCell = detailSheet.getCell(`A${currRow}`);
      const valCell = detailSheet.getCell(`B${currRow}`);

      labelCell.value = label;
      labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1F4E78' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      labelCell.alignment = { vertical: 'top', horizontal: 'left' };

      if (label === 'PubMed URL') {
        valCell.value = { text: val, hyperlink: val };
        valCell.font = { name: 'Calibri', size: 10, color: { argb: '0563C1' }, underline: true };
      } else {
        valCell.value = val;
        valCell.font = { name: 'Calibri', size: 10 };
      }
      valCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

      labelCell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
      valCell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

      detailSheet.getRow(currRow).height = Math.max(22, Math.ceil(String(val).length / 70) * 16 + 4);
      currRow++;
    });

    currRow++; // 空白行

    // 臨床要約 (4項目) Block
    detailSheet.mergeCells(`A${currRow}:B${currRow}`);
    const sumHeaderCell = detailSheet.getCell(`A${currRow}`);
    sumHeaderCell.value = '💡 臨床ポイント要約 (概要・方法・結果・結論)';
    sumHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '1F4E78' } };
    sumHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    detailSheet.getRow(currRow).height = 24;
    currRow++;

    detailSheet.mergeCells(`A${currRow}:B${currRow}`);
    const sumContentCell = detailSheet.getCell(`A${currRow}`);
    sumContentCell.value = paper.summaryJa;
    sumContentCell.font = { name: '游ゴシック', size: 10 };
    sumContentCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    sumContentCell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    
    const sumLines = (paper.summaryJa || '').split('\n').length;
    detailSheet.getRow(currRow).height = Math.max(70, sumLines * 18 + 10);
    currRow += 2;

    // 抄録 (Abstract) 日本語全訳 Block
    detailSheet.mergeCells(`A${currRow}:B${currRow}`);
    const absJaHeaderCell = detailSheet.getCell(`A${currRow}`);
    absJaHeaderCell.value = '🇯🇵 抄録 (Abstract) 日本語全訳 (全文直訳)';
    absJaHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '1F4E78' } };
    absJaHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    detailSheet.getRow(currRow).height = 24;
    currRow++;

    detailSheet.mergeCells(`A${currRow}:B${currRow}`);
    const absJaContentCell = detailSheet.getCell(`A${currRow}`);
    absJaContentCell.value = paper.abstractJa || '抄録の日本語訳処理中...';
    absJaContentCell.font = { name: '游ゴシック', size: 10 };
    absJaContentCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    absJaContentCell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

    const absJaText = paper.abstractJa || '';
    const absJaSplit = absJaText.split('\n');
    let totalAbsJaLines = 0;
    absJaSplit.forEach(line => {
      totalAbsJaLines += Math.ceil(line.length / 46) || 1;
    });
    detailSheet.getRow(currRow).height = Math.max(90, totalAbsJaLines * 19 + 25);
    currRow += 2;

    // 抄録 (Abstract) 英語原文 Block
    detailSheet.mergeCells(`A${currRow}:B${currRow}`);
    const absEnHeaderCell = detailSheet.getCell(`A${currRow}`);
    absEnHeaderCell.value = '🔤 抄録 (Abstract) 英語原文';
    absEnHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '1F4E78' } };
    absEnHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    detailSheet.getRow(currRow).height = 24;
    currRow++;

    detailSheet.mergeCells(`A${currRow}:B${currRow}`);
    const absEnContentCell = detailSheet.getCell(`A${currRow}`);
    absEnContentCell.value = paper.abstract || 'No abstract available.';
    absEnContentCell.font = { name: 'Calibri', size: 10, italic: true };
    absEnContentCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    absEnContentCell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

    const absEnText = paper.abstract || '';
    const absEnSplit = absEnText.split('\n');
    let totalAbsEnLines = 0;
    absEnSplit.forEach(line => {
      totalAbsEnLines += Math.ceil(line.length / 60) || 1;
    });
    detailSheet.getRow(currRow).height = Math.max(90, totalAbsEnLines * 18 + 25);
    currRow += 2;

    // 論文本文 (Full Text) 案内
    detailSheet.mergeCells(`A${currRow}:B${currRow}`);
    const ftCell = detailSheet.getCell(`A${currRow}`);
    ftCell.value = `ℹ️ 論文本文 (Full Text) や図表の全ページ閲覧は、上記の PubMed URL (${paper.url}) または DOI リンク先の出版社公式サイトからアクセスできます。`;
    ftCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '475569' } };
    ftCell.alignment = { vertical: 'middle', horizontal: 'left' };
    detailSheet.getRow(currRow).height = 24;
  });

  const dir = path.dirname(outputFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await workbook.xlsx.writeFile(outputFilePath);
  console.log(`[Excel Generator] 個別抄録・全訳シート付きExcelファイルを正常に生成しました: ${outputFilePath}`);
  return outputFilePath;
}
