import axios from 'axios';

async function testClinicalKey() {
  const pii = 'S1547527126024525';
  const urls = [
    `https://www.clinicalkey.jp/service/content/playContent/1-s2.0-${pii}`,
    `https://www.clinicalkey.com/service/content/playContent/1-s2.0-${pii}`,
    `https://www.sciencedirect.com/science/article/pii/${pii}?via%3Dihub`,
    `https://api.elsevier.com/content/article/pii/${pii}?view=FULL`
  ];

  for (const url of urls) {
    try {
      console.log('Testing URL:', url);
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/html, text/xml'
        },
        timeout: 8000
      });
      console.log('Status:', res.status, 'Data type:', typeof res.data, 'Data length:', typeof res.data === 'string' ? res.data.length : JSON.stringify(res.data).length);
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (text.includes('ablation') || text.includes('catheter') || text.includes('pulsed-field') || text.includes('VT')) {
        console.log('SUCCESS! Found paper keywords in response!');
        console.log('Snippet:', text.slice(0, 500));
      }
    } catch (e) {
      console.log('Error:', e.response ? e.response.status : e.message);
    }
  }
}

testClinicalKey();
