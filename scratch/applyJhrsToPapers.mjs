import fs from 'fs';
import { normalizeJhrsTerms } from '../src/jhrsTermsHelper.js';
import { removeDesuMasuStrict } from '../src/summarizer.js';

console.log('Applying JHRS terminology normalization to papers.json...');

const publicPath = 'public/papers.json';
const outputsPath = 'outputs/papers.json';

if (!fs.existsSync(publicPath)) {
  console.error('public/papers.json not found!');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(publicPath, 'utf-8'));
let updatedCount = 0;

data.papers.forEach(paper => {
  const oldTitle = paper.titleJa || '';
  const oldSummary = paper.summaryJa || '';
  const oldAbstract = paper.abstractJa || '';

  paper.titleJa = normalizeJhrsTerms(removeDesuMasuStrict(oldTitle));
  paper.summaryJa = normalizeJhrsTerms(removeDesuMasuStrict(oldSummary));
  paper.abstractJa = normalizeJhrsTerms(oldAbstract);

  if (oldTitle !== paper.titleJa || oldSummary !== paper.summaryJa || oldAbstract !== paper.abstractJa) {
    updatedCount++;
  }
});

console.log(`Normalized JHRS terms in ${updatedCount} / ${data.papers.length} papers.`);

fs.writeFileSync(publicPath, JSON.stringify(data, null, 2), 'utf-8');
if (fs.existsSync('outputs')) {
  fs.writeFileSync(outputsPath, JSON.stringify(data, null, 2), 'utf-8');
}

console.log('Successfully saved updated papers with JHRS terminology!');
