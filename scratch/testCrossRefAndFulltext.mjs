import axios from 'axios';

async function testCrossref(doi) {
  const url = `https://api.crossref.org/works/${doi}`;
  console.log(`Fetching CrossRef: ${url}`);
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'PubMedAblationApp/1.0 (mailto:hiromiyoshimu@gmail.com)'
      }
    });
    const work = res.data?.message;
    if (work) {
      console.log(`Title:`, work.title);
      console.log(`Abstract:`, work.abstract ? work.abstract.slice(0, 200) : 'なし');
      console.log(`Link:`, work.link);
      console.log(`Assertion:`, work.assertion);
    }
  } catch (err) {
    console.error(`CrossRef Error:`, err.message);
  }
}

async function testSemanticScholar(pmid) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/PMID:${pmid}?fields=title,abstract,isOpenAccess,openAccessPdf,tldr,body`;
  console.log(`Fetching Semantic Scholar: ${url}`);
  try {
    const res = await axios.get(url);
    console.log(`Semantic Scholar Result:`);
    console.log(`Title:`, res.data.title);
    console.log(`Abstract:`, res.data.abstract ? res.data.abstract.slice(0, 200) : 'なし');
    console.log(`TLDR:`, res.data.tldr);
    console.log(`isOpenAccess:`, res.data.isOpenAccess);
    console.log(`openAccessPdf:`, res.data.openAccessPdf);
  } catch (err) {
    console.error(`Semantic Scholar Error:`, err.message);
  }
}

async function main() {
  await testCrossref('10.1016/j.hrthm.2026.05.051');
  await testSemanticScholar('42248313');
}

main();
