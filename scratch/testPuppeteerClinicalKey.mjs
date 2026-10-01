import puppeteer from 'puppeteer';

async function fetchFullTextWithPuppeteer() {
  const targetUrl = 'https://www.clinicalkey.jp/#!/content/playContent/1-s2.0-S1547527126024525';
  console.log('Puppeteerで ClinicalKey にアクセス中:', targetUrl);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // ページの本文要素の読み込み完了を待機
    await new Promise(r => setTimeout(r, 4000));

    // innerText の取得
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('抽出成功！ テキスト長:', pageText.length);
    console.log('--- 先頭 1000 文字 ---');
    console.log(pageText.slice(0, 1000));
    console.log('--- 末尾 1000 文字 ---');
    console.log(pageText.slice(-1000));

    return pageText;
  } catch (err) {
    console.error('Puppeteer エラー:', err.message);
  } finally {
    await browser.close();
  }
}

fetchFullTextWithPuppeteer();
