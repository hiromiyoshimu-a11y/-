import axios from 'axios';

async function testFetch() {
  try {
    const htmlRes = await axios.get('https://hiromiyoshimu-a11y.github.io/-/');
    console.log('--- HTML STATUS ---:', htmlRes.status);
    console.log('HTML snippet:', htmlRes.data.substring(0, 500));

    // JS ファイルの URL を抽出
    const jsMatch = htmlRes.data.match(/src="([^"]+\.js)"/);
    if (jsMatch) {
      const jsUrl = new URL(jsMatch[1], 'https://hiromiyoshimu-a11y.github.io/-/').href;
      console.log('JS URL:', jsUrl);
      const jsRes = await axios.get(jsUrl);
      console.log('JS status:', jsRes.status);
      console.log('JS snippet:', jsRes.data.substring(0, 500));
    }

    // papers.json の動作
    const jsonUrl = 'https://hiromiyoshimu-a11y.github.io/-/papers.json';
    const jsonRes = await axios.get(jsonUrl);
    console.log('JSON status:', jsonRes.status);
    console.log('JSON papers count:', jsonRes.data.papers ? jsonRes.data.papers.length : 'NO PAPERS FIELD');

  } catch (err) {
    console.error('Test Fetch Error:', err.message);
  }
}

testFetch();
