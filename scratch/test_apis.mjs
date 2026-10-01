import axios from 'axios';

async function testOpenAlexAndSemanticScholar() {
  const pmid = '42248313';
  const doi = '10.1016/j.hrthm.2026.05.051';

  console.log('=== Test 1: OpenAlex API ===');
  try {
    const res = await axios.get(`https://api.openalex.org/works/https://doi.org/${doi}`);
    console.log('OpenAlex title:', res.data.title);
    console.log('OpenAlex is_oa:', res.data.is_oa);
    if (res.data.abstract_inverted_index) {
      console.log('Found OpenAlex abstract inverted index!');
      // Reconstruct abstract from inverted index
      const words = [];
      for (const [word, positions] of Object.entries(res.data.abstract_inverted_index)) {
        for (const pos of positions) {
          words[pos] = word;
        }
      }
      const abstractText = words.join(' ');
      console.log('Reconstructed Abstract (' + abstractText.length + ' chars):');
      console.log(abstractText);
    } else {
      console.log('No abstract_inverted_index in OpenAlex');
    }
  } catch (e) {
    console.log('OpenAlex error:', e.message);
  }

  console.log('\n=== Test 2: Semantic Scholar API ===');
  try {
    const res = await axios.get(`https://api.semanticscholar.org/graph/v1/paper/PMID:${pmid}?fields=title,abstract,tldr,openAccessPdf`);
    console.log('Semantic Scholar Title:', res.data.title);
    console.log('Semantic Scholar Abstract:', res.data.abstract);
    console.log('Semantic Scholar TLDR:', res.data.tldr);
    console.log('Semantic Scholar PDF:', res.data.openAccessPdf);
  } catch (e) {
    console.log('Semantic Scholar error:', e.message);
  }

  console.log('\n=== Test 3: Europe PMC Search API ===');
  try {
    const res = await axios.get(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${pmid}&resultType=core&format=json`);
    const item = res.data.resultList?.result?.[0];
    console.log('Europe PMC item found:', !!item);
    if (item) {
      console.log('Europe PMC abstractText:', item.abstractText);
      console.log('Europe PMC fullTextIdList:', item.fullTextIdList);
    }
  } catch (e) {
    console.log('Europe PMC error:', e.message);
  }
}

testOpenAlexAndSemanticScholar();
