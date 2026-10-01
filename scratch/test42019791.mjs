import axios from 'axios';
import puppeteer from 'puppeteer';

async function testFetch42019791() {
  const pmid = '42019791';
  const doi = '10.1016/j.hrthm.2026.04.008';
  const title = 'Reversible epicardial near-field electrical silencing after endocardial pulsed field ablation';

  console.log('=== Method 1: OpenAlex by DOI ===');
  try {
    const res = await axios.get(`https://api.openalex.org/works/https://doi.org/${doi}`);
    console.log('OpenAlex by DOI title:', res.data.title);
    if (res.data.abstract_inverted_index) {
      const words = [];
      for (const [word, positions] of Object.entries(res.data.abstract_inverted_index)) {
        for (const pos of positions) words[pos] = word;
      }
      console.log('Found index len:', words.join(' ').length);
      console.log('Snippet:', words.join(' ').slice(0, 300));
    } else {
      console.log('No inverted index in OpenAlex by DOI');
    }
  } catch (e) {
    console.log('OpenAlex error:', e.message);
  }

  console.log('\n=== Method 2: Semantic Scholar ===');
  try {
    const res = await axios.get(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=title,abstract,tldr`);
    console.log('Semantic Scholar abstract:', res.data.abstract);
  } catch (e) {
    console.log('Semantic Scholar error:', e.message);
  }

  console.log('\n=== Method 3: Puppeteer on ClinicalKey / DOI redirect ===');
  const executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(`https://doi.org/${doi}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000));
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('Puppeteer Page Text len:', pageText.length);
    if (pageText.length > 300) {
      console.log('Snippet:', pageText.slice(0, 400));
    }
  } catch (e) {
    console.log('Puppeteer error:', e.message);
  } finally {
    await browser.close();
  }
}

testFetch42019791();
