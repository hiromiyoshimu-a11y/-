import axios from 'axios';

async function testElsevierTextApi() {
  const urls = [
    `https://api.elsevier.com/content/article/PII:S1547527126024525?httpAccept=text/plain`,
    `https://api.elsevier.com/content/article/PII:S1547527126024525?httpAccept=text/xml`,
    `https://api.elsevier.com/content/article/doi/10.1016/j.hrthm.2026.05.051?httpAccept=text/plain`,
    `https://api.elsevier.com/content/article/doi/10.1016/j.hrthm.2026.05.051?httpAccept=application/json`
  ];

  for (const url of urls) {
    console.log(`Trying Elsevier Text API: ${url}`);
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      console.log(`Success! Response status: ${res.status}, data length: ${typeof res.data === 'string' ? res.data.length : JSON.stringify(res.data).length}`);
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      console.log(text.slice(0, 500));
      return text;
    } catch (err) {
      console.warn(`Failed (${url}):`, err.response?.status || err.message);
    }
  }
}

testElsevierTextApi();
