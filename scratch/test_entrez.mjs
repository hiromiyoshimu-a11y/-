import axios from 'axios';

async function testEntrez() {
  const pmid = '42248313';
  
  // 1. esummary
  const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
  const sumRes = await axios.get(esummaryUrl);
  const result = sumRes.data.result[pmid];
  console.log('esummary result keys:', Object.keys(result));
  console.log('articleids:', result.articleids);
  console.log('pubtype:', result.pubtype);

  // 2. elink (LinkOut to FullText / Free FullText)
  const elinkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&id=${pmid}&cmd=prlinks&retmode=json`;
  const linkRes = await axios.get(elinkUrl);
  console.log('elink result:', JSON.stringify(linkRes.data, null, 2));
}

testEntrez();
