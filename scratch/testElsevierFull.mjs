import axios from 'axios';
import fs from 'fs';

async function testElsevierXml() {
  const pii = 'S1547527126024525';
  const url = `https://api.elsevier.com/content/article/pii/${pii}?httpAccept=text/xml`;

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    console.log('Elsevier XML status:', res.status);
    console.log('Elsevier XML len:', res.data.length);
    fs.writeFileSync('scratch/elsevier_response.xml', res.data, 'utf-8');
    console.log('Saved to scratch/elsevier_response.xml');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testElsevierXml();
