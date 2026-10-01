import axios from 'axios';

async function testEuropePmc(pmid) {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${pmid}&resultType=core&format=json`;
  try {
    const res = await axios.get(url);
    const result = res.data?.resultList?.result?.[0];
    if (result) {
      console.log(`PMID ${pmid} in Europe PMC:`);
      console.log(`Title:`, result.title);
      console.log(`isOpenAccess:`, result.isOpenAccess);
      console.log(`inEPMC:`, result.inEPMC);
      console.log(`hasTextMinedTerms:`, result.hasTextMinedTerms);
      console.log(`abstractText:`, result.abstractText ? result.abstractText.slice(0, 100) : 'なし');
      console.log(`fullTextUrlList:`, result.fullTextUrlList);
      
      // PMC ID があれば PMC 本文を取得
      if (result.pmcid) {
        console.log(`PMCID:`, result.pmcid);
      }
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

testEuropePmc('42248313');
testEuropePmc('42663303');
