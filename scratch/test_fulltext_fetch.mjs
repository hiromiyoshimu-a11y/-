import axios from 'axios';

async function testFulltextFetch() {
  const pmid = '42248313';
  const doi = '10.1016/j.hrthm.2026.05.051';

  console.log('=== Test 1: Europe PMC fullTextXML ===');
  try {
    const epmcXmlUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/${pmid}/fullTextXML`;
    const res = await axios.get(epmcXmlUrl, { timeout: 5000 });
    const text = res.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('Europe PMC fullTextXML status:', res.status, 'Length:', text.length);
    if (text.length > 300) console.log('Snippet:', text.slice(0, 300));
  } catch (e) {
    console.log('Europe PMC fullTextXML error:', e.message);
  }

  console.log('\n=== Test 2: Unpaywall + Publisher HTML / ClinicalKey / ScienceDirect ===');
  try {
    const unpayRes = await axios.get(`https://api.unpaywall.org/v2/${doi}?email=hiromiyoshimu@gmail.com`);
    const oaUrl = unpayRes.data.best_oa_location?.url;
    console.log('Unpaywall OA URL:', oaUrl);
    if (oaUrl) {
      // Try fetching with browser user agent and headers
      const res = await axios.get(oaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        maxRedirects: 10,
        timeout: 10000
      });
      console.log('Publisher page fetch status:', res.status, 'HTML length:', res.data.length);
      const text = res.data.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('Clean text length:', text.length);
      if (text.length > 500) console.log('Snippet:', text.slice(0, 400));
    }
  } catch (e) {
    console.log('Publisher fetch error:', e.message);
  }

  console.log('\n=== Test 3: NCBI E-utilities elink check for free resource ===');
  try {
    const elinkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&id=${pmid}&cmd=prlinks&retmode=json`;
    const res = await axios.get(elinkUrl);
    const objurls = res.data.linksets?.[0]?.idurllist?.[0]?.objurls || [];
    const isFree = objurls.some(u => 
      (u.attributes && u.attributes.includes('free resource')) || 
      (u.iconurl && u.iconurl.value.includes('elsevieroa')) ||
      (u.iconurl && /free|oa|open/i.test(u.iconurl.value))
    );
    console.log('Is Free Article from elink:', isFree);
    if (isFree) {
      console.log('Direct free URL:', objurls[0]?.url?.value);
    }
  } catch (e) {
    console.log('elink error:', e.message);
  }
}

testFulltextFetch();
