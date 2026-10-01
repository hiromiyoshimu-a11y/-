import axios from 'axios';
import { fetchFreeArticleFullText, summarizeFromFullText } from '../src/freeArticleFetcher.js';
import dotenv from 'dotenv';
dotenv.config();

async function testFullTextPipeline() {
  const paper = {
    pmid: '42248313',
    title: 'Para-His periaortic VT ablation with focal pulsed-field energy.',
    doi: '10.1016/j.hrthm.2026.05.051',
    studyTypeLabel: '症例報告 (Case Report)',
    sampleSize: 1
  };

  console.log('--- Step 1: OpenAlex / EuropePMC / Unpaywall Text Fetch ---');
  let fullText = null;

  // Try OpenAlex API
  try {
    console.log('Fetching OpenAlex API...');
    const res = await axios.get(`https://api.openalex.org/works/pmid:${paper.pmid}`);
    if (res.data && res.data.abstract_inverted_index) {
      const words = [];
      for (const [word, positions] of Object.entries(res.data.abstract_inverted_index)) {
        for (const pos of positions) {
          words[pos] = word;
        }
      }
      fullText = words.join(' ');
      console.log(`[OpenAlex] 本文テキスト抽出成功 (${fullText.length}文字)`);
    }
  } catch (e) {
    console.log('OpenAlex error:', e.message);
  }

  if (!fullText) {
    fullText = await fetchFreeArticleFullText(paper.pmid, paper.doi);
  }

  console.log('FullText length:', fullText ? fullText.length : 0);
  if (fullText) {
    console.log('FullText snippet:', fullText);

    console.log('\n--- Step 2: Gemini AI Summarization ---');
    const result = await summarizeFromFullText(paper, fullText);
    console.log('\n=== SummaryJa ===\n', result?.summaryJa);
    console.log('\n=== AbstractJa ===\n', result?.abstractJa);
  }
}

testFullTextPipeline();
