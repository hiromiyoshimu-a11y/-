import puppeteer from 'puppeteer';

async function testScienceDirect() {
  const url = 'https://doi.org/10.1016/j.hrthm.2026.05.051';
  console.log('Puppeteerで ScienceDirect / DOI にアクセス中:', url);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await new Promise(r => setTimeout(r, 5000));

    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('ScienceDirect テキスト長:', pageText.length);
    console.log('--- 先頭 1000 文字 ---');
    console.log(pageText.slice(0, 1000));

    return pageText;
  } catch (err) {
    console.error('Puppeteer エラー:', err.message);
  } finally {
    await browser.close();
  }
}

testScienceDirect();
