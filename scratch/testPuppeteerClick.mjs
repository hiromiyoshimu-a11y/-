import puppeteer from 'puppeteer';
import fs from 'fs';

async function testClick() {
  const url = 'https://linkinghub.elsevier.com/retrieve/pii/S1547527126024525?showall=true';
  const executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2' });

    console.log('LinkingHub HTML loaded. Inspecting links...');
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText, href: a.href }));
    });
    console.log('Links on page:', links);

    // Click ClinicalKey or ScienceDirect link
    const targetLink = links.find(l => l.href.includes('clinicalkey') || l.href.includes('sciencedirect') || l.href.includes('playContent'));
    if (targetLink) {
      console.log('Navigating to target link:', targetLink.href);
      await page.goto(targetLink.href, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 6000));
      const text = await page.evaluate(() => document.body.innerText);
      console.log('Navigated Page Text length:', text.length);
      console.log('Snippet:', text.slice(0, 1000));
      fs.writeFileSync('scratch/clicked_full_text.txt', text, 'utf-8');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

testClick();
