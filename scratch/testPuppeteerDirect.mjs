import puppeteer from 'puppeteer';
import fs from 'fs';

async function testDirectUrls() {
  const urls = [
    'https://linkinghub.elsevier.com/retrieve/pii/S1547527126024525?showall=true',
    'https://doi.org/10.1016/j.hrthm.2026.05.051',
    'https://www.sciencedirect.com/science/article/pii/S1547527126024525'
  ];

  const executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const url of urls) {
      console.log('--- Testing URL ---:', url);
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise(r => setTimeout(r, 4000));
        const pageText = await page.evaluate(() => document.body.innerText);
        console.log('Final URL:', page.url());
        console.log('Text len:', pageText.length);
        if (pageText.length > 500) {
          console.log('Snippet:', pageText.slice(0, 500));
          fs.writeFileSync('scratch/direct_extracted.txt', pageText, 'utf-8');
          break;
        }
      } catch (e) {
        console.log('Error:', e.message);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

testDirectUrls();
