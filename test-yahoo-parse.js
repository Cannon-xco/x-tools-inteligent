const cheerio = require('cheerio');
async function test() {
  const url = `https://search.yahoo.com/search?p=favehotel+kuta+bali`;
  const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  $('a').each((_, el) => {
    const raw = $(el).attr('href');
    if (raw && raw.includes('favehotels.com')) {
       console.log('Yahoo encoded link:', raw);
    }
  });
}
test();
