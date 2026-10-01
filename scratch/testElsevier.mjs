import axios from 'axios';

async function testFetchDoi(doi) {
  // ScienceDirect API / DOI リダイレクト経由でのオープンアクセス取得
  const doiUrl = `https://doi.org/${doi}`;
  console.log(`Fetching DOI redirect: ${doiUrl}`);
  try {
    const res = await axios.get(doiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxRedirects: 5
    });

    console.log(`Redirect status: ${res.status}`);
    console.log(`Final URL:`, res.request?.res?.responseUrl || res.config?.url);

    const html = res.data;
    console.log(`HTML size:`, html.length);

    // ScienceDirect / Elsevier のオープンアクセス文章・セクションの抽出
    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`Cleaned text sample (${cleanText.length} chars):`);
    console.log(cleanText.slice(0, 500));

    return cleanText;
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

testFetchDoi('10.1016/j.hrthm.2026.05.051');
