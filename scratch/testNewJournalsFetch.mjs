import axios from 'axios';

async function testFetchNewJournals() {
  const newJournals = [
    'Journal of Arrhythmia[Journal] OR J Arrhythm[Journal]',
    'Circulation[Journal]',
    'European Heart Journal[Journal] OR Eur Heart J[Journal]',
    'Shin-denzu[Journal] OR Japanese Journal of Electrocardiology[Journal] OR Shinzo[Journal]'
  ];

  const keyword = '("catheter ablation" OR "pulsed field ablation" OR "arrhythmia" OR "arrhythmias" OR "atrial fibrillation" OR "ventricular tachycardia")';

  for (const j of newJournals) {
    console.log(`\n=== Testing journal query: ${j} ===`);
    const term = `(${j}) AND ${keyword}`;
    const url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
    try {
      const res = await axios.get(url, {
        params: {
          db: 'pubmed',
          term: term,
          reldate: 180, // 過去6ヶ月
          datetype: 'pdat',
          retmax: 20,
          retmode: 'json'
        }
      });
      const ids = res.data.esearchresult?.idlist || [];
      console.log(`ヒット数: ${res.data.esearchresult?.count}件 (取得ID: ${ids.length}件)`);
      if (ids.length > 0) {
        // Fetch details of first 3
        const sumUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
        const sumRes = await axios.get(sumUrl, {
          params: { db: 'pubmed', id: ids.slice(0, 5).join(','), retmode: 'json' }
        });
        const result = sumRes.data.result;
        ids.slice(0, 5).forEach(id => {
          const p = result[id];
          if (p) {
            console.log(`- PMID ${id} | ${p.source} | ${p.title.slice(0, 60)}...`);
          }
        });
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

testFetchNewJournals();
