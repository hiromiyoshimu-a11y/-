import nodemailer from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

/**
 * 生成されたExcelレポートをメール送信
 * @param {string} filePath 添付するExcelファイルのパス
 * @param {number} paperCount 論文数
 */
export async function sendEmailNotification(filePath, paperCount) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFICATION_EMAIL } = process.env;
  const recipientEmail = NOTIFICATION_EMAIL || 'hiromiyoshimu@gmail.com';

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('[Mailer] SMTP設定未指定のため、メール送信をスキップします。(.env に SMTP 設定を追加してください)');
    return false;
  }

  console.log(`[Mailer] メールを送信中 (${recipientEmail} 宛)...`);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: parseInt(SMTP_PORT || '587', 10) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const filename = path.basename(filePath);
  const todayStr = new Date().toISOString().split('T')[0];

  const mailOptions = {
    from: `"PubMed Automation" <${SMTP_USER}>`,
    to: recipientEmail,
    subject: `【週次論文レポート】カテーテル/パルスフィールドアブレーション・不整脈最新論文 (${todayStr}) - ${paperCount}件`,
    text: `吉村様

お世話になっております。

過去3ヶ月にPubMedに掲載された「カテーテルアブレーション／パルスフィールドアブレーション（PFA）／不整脈」に関する最新論文レポート（計${paperCount}件）が作成されました。

【掲載順について】
- RCT（無作為化比較試験）および前向き研究で症例数（N）が多い順に上位掲載しています。
- 症例報告（Case Report）は下位に掲載しています。

添付のExcelファイルをご確認ください。各論文には日本語5行要約および引用用テキスト（Vancouver形式）、PubMed直リンクが含まれております。

--
自動送信システム (Antigravity PubMed Workflow)`,
    attachments: [
      {
        filename: filename,
        path: filePath
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] メール送信完了: MessageID=${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Mailer] メール送信失敗:`, err.message);
    return false;
  }
}
