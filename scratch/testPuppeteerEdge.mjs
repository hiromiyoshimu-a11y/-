import puppeteer from 'puppeteer';
import fs from 'fs';

async function testEdge() {
  const targetUrl = 'https://www.clinicalkey.jp/#!/content/playContent/1-s2.0-S1547527126024525';
  console.log('ローカルEdgeで ClinicalKey を開きます:', targetUrl);

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ];

  let executablePath = null;
  for (const p of edgePaths) {
    if (fs.existsSync(p)) {
      executablePath = p;
      break;
    }
  }

  console.log('使用ブラウザパス:', executablePath);

  const browser = await puppeteer.launch({
    executablePath: executablePath || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('ページ遷移成功。レンダリングを待機中 (5秒)...');
    await new Promise(r => setTimeout(r, 5000));

    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('✅ テキスト抽出完了！ 文字数:', pageText.length);
    fs.writeFileSync('scratch/clinicalkey_full_text.txt', pageText, 'utf-8');
    console.log('Saved to scratch/clinicalkey_full_text.txt');
    console.log('--- 抜粋 ---');
    console.log(pageText.slice(0, 1000));
  } catch (err) {
    console.error('エラー:', err.message);
  } finally {
    await browser.close();
  }
}

testEdge();
