import axios from 'axios';
import fs from 'fs';

async function testPubmedHtml() {
  const url = 'https://pubmed.ncbi.nlm.nih.gov/42248313/';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`Status: ${res.status}`);
    fs.writeFileSync('scratch/pubmed_42248313.html', res.data, 'utf-8');
    console.log(`Saved HTML to scratch/pubmed_42248313.html (${res.data.length} bytes)`);

    // 無料・Free文言の検査
    const isFree = /free article/i.test(res.data) ||
                   /free text/i.test(res.data) ||
                   /full text link/i.test(res.data) ||
                   /open access/i.test(res.data) ||
                   res.data.includes('full-text');

    console.log(`isFree match result: ${isFree}`);

    // DOI / Full text link の抽出
    const links = res.data.match(/href="([^"]+)"/g) || [];
    const doiLinks = links.filter(l => l.includes('doi.org') || l.includes('sciencedirect') || l.includes('elsevier') || l.includes('full-text'));
    console.log(`DOI / Fulltext Links:`, doiLinks);

  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

testPubmedHtml();
