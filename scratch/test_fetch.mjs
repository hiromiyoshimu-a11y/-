import axios from 'axios';

async function test() {
  const pmid = '42248313';
  const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('PubMed HTML status:', res.status);
    
    // Check "Free article" badge
    const isFree = /Free article/i.test(res.data) || /Free PMC article/i.test(res.data) || /full-text-links/i.test(res.data);
    console.log('Is Free Article in PubMed:', isFree);

    // Look for full text provider links
    const matches = [...res.data.matchAll(/class="[^\"]*full-text[^\"]*"[^\>]*href="([^\"]+)"/gi)].map(m => m[1]);
    console.log('Full text links:', matches);

    const linkContainer = res.data.match(/<div class="full-text-links-list">([\s\S]*?)<\/div>/i);
    if (linkContainer) {
      console.log('Link container HTML:', linkContainer[1]);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
