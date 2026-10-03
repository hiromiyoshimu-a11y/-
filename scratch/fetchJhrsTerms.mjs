import axios from 'axios';
import fs from 'fs';

async function fetchJhrsWords() {
  console.log('Fetching JHRS pages with Shift_JIS decoding...');
  
  // Let's check total pages first
  const res1 = await axios.get('https://new.jhrs.or.jp/contents_jse/words/list.php', {
    responseType: 'arraybuffer'
  });
  
  const decoder = new TextDecoder('shift-jis');
  const html1 = decoder.decode(res1.data);
  
  // Find max page
  const pageMatches = [...html1.matchAll(/page=(\d+)/g)].map(m => parseInt(m[1]));
  const maxPage = Math.max(...pageMatches, 1);
  console.log(`Max page detected: ${maxPage}`);

  const allTerms = [];

  for (let page = 1; page <= maxPage; page++) {
    const url = `https://new.jhrs.or.jp/contents_jse/words/list.php?page=${page}&s=word_eng&o=`;
    console.log(`Fetching page ${page}/${maxPage}...`);
    
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      const html = decoder.decode(res.data);
      
      const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const tr of trMatches) {
        const tds = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
          .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
        if (tds.length >= 2 && tds[0] && tds[1]) {
          // Skip header row
          if (tds[0].includes('検索範囲') || tds[0].includes('用語') || tds[1].includes('日本語')) continue;
          allTerms.push({ en: tds[0], ja: tds[1] });
        }
      }
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e.message);
    }
  }

  console.log(`Successfully fetched ${allTerms.length} terms from JHRS!`);
  console.log('Sample decoded terms:');
  console.log(allTerms.slice(0, 20));

  fs.writeFileSync('src/jhrsTerms.json', JSON.stringify(allTerms, null, 2), 'utf-8');
  console.log('Saved to src/jhrsTerms.json');
}

fetchJhrsWords().catch(console.error);
