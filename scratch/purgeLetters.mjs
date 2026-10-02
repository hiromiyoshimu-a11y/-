import fs from 'fs';

function purgeLetters(filePath) {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data && Array.isArray(data.papers)) {
      const initialCount = data.papers.length;
      data.papers = data.papers.filter(p => {
        const title = (p.title || '').toLowerCase();
        const titleJa = (p.titleJa || '').toLowerCase();

        const isLetter = 
          title.startsWith('letter ') || title.startsWith('letter:') || title.includes('letter by ') || title.includes('letter regarding') || title.includes('letter to the editor') ||
          title.startsWith('response ') || title.startsWith('response:') || title.includes('response by ') || title.includes('response to ') ||
          title.startsWith('reply ') || title.startsWith('reply:') || title.includes('reply to ') || title.includes('reply by ') ||
          title.startsWith('comment ') || title.includes('comment on ') || title.includes("author's reply") ||
          titleJa.includes('書簡') || titleJa.includes('回答') || titleJa.includes('手紙') || titleJa.includes('コメント');

        return !isLetter;
      });
      console.log(`Purged ${initialCount - data.papers.length} Letter/Response entries from ${filePath}. Remaining: ${data.papers.length}`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
  }
}

purgeLetters('public/papers.json');
purgeLetters('outputs/papers.json');
