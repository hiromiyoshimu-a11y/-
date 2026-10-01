import axios from 'axios';

async function testFullArticleFetch() {
  const pii = 'S1547527126024525';
  const doi = '10.1016/j.hrthm.2026.05.051';

  console.log('=== Test 1: Elsevier Article API with different headers/params ===');
  const elsevierUrls = [
    `https://api.elsevier.com/content/article/pii/${pii}?view=FULL`,
    `https://api.elsevier.com/content/article/doi/${doi}?view=FULL`,
    `https://api.elsevier.com/content/article/pii/${pii}`,
    `https://api.elsevier.com/content/article/doi/${doi}`
  ];

  for (const u of elsevierUrls) {
    try {
      console.log('Fetching:', u);
      const res = await axios.get(u, {
        headers: {
          'Accept': 'application/xml, text/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      const text = res.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('Status:', res.status, 'Extracted text len:', text.length);
      if (text.length > 500) {
        console.log('Snippet:', text.slice(0, 400));
      }
    } catch (e) {
      console.log('Error:', e.response ? e.response.status : e.message);
    }
  }

  console.log('\n=== Test 2: ClinicalKey / ScienceDirect Landing Page Scraping ===');
  const webUrls = [
    `https://linkinghub.elsevier.com/retrieve/pii/${pii}?showall=true`,
    `https://www.clinicalkey.jp/service/content/playContent/1-s2.0-${pii}`,
    `https://www.sciencedirect.com/science/article/pii/${pii}`
  ];

  for (const u of webUrls) {
    try {
      console.log('Fetching:', u);
      const res = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });
      const text = res.data.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('Status:', res.status, 'HTML clean text len:', text.length);
      if (text.length > 500) {
        console.log('Snippet:', text.slice(0, 400));
      }
    } catch (e) {
      console.log('Error:', e.response ? e.response.status : e.message);
    }
  }
}

testFullArticleFetch();
