import axios from 'axios';

async function testScienceDirectApi() {
  const pii = 'S1547527126024525';
  const url = `https://www.sciencedirect.com/science/article/pii/${pii}`;
  console.log(`Fetching ScienceDirect Page: ${url}`);
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log(`Status: ${res.status}, HTML Length: ${res.data.length}`);

    // 本文テキストの抽出 (Para-His periaortic VT ablation)
    const text = res.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (text.includes('pulsed-field') || text.includes('catheter') || text.includes('ablation')) {
      console.log(`Successfully extracted article content (${text.length} chars)!`);
      const sample = text.indexOf('Para-His');
      if (sample !== -1) {
        console.log(text.slice(sample, sample + 800));
      } else {
        console.log(text.slice(0, 800));
      }
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

testScienceDirectApi();
