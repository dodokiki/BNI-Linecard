const fs = require('fs');
const path = require('path');

const CARDS_PATH = path.join(__dirname, '..', 'cards.json');
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function getCards() {
  try {
    const raw = fs.readFileSync(CARDS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = function handler(req, res) {
  let cardId = (req.query && req.query.cardId) || '';
  if (!cardId && req.url) {
    const pathname = req.url.split('?')[0] || '';
    cardId = pathname.replace(/^\//, '').split('/')[0] || '';
  }
  if (!cardId) {
    res.status(404).send('Not found');
    return;
  }

  const cards = getCards();
  const card = cards.find(c => c.id === cardId);
  if (!card) {
    res.status(404).send('Card not found');
    return;
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
        ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
        : 'https://bni-linecard.vercel.app');
  const pageUrl = `${baseUrl}/${cardId}`;
  const title = `${card.name} | นามบัตรดิจิทัล`;
  const desc = [card.title, card.company, card.description].filter(Boolean).map(s => (s || '').replace(/^"|"$/g, '')).join(' · ').slice(0, 200) || 'ดูนามบัตรดิจิทัล';
  // LINE ต้องมี og:image (absolute URL) ถึงจะแสดงเป็นการ์ดแบบ rich preview
  const imageUrl = card.avatar
    ? (card.avatar.startsWith('http') ? card.avatar : `${baseUrl}/${card.avatar}`)
    : `${baseUrl}/card-preview.png`;

  let html;
  try {
    html = fs.readFileSync(INDEX_PATH, 'utf8');
  } catch (e) {
    res.status(500).send('Error');
    return;
  }

  const replacements = [
    [/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}">`],
    [/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}">`],
    [/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${pageUrl}">`],
    [/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${imageUrl.replace(/"/g, '&quot;')}">`],
    [/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">`],
    [/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}">`],
    [/<title>[^<]*<\/title>/, `<title>${title.replace(/</g, '&lt;')}</title>`],
  ];

  replacements.forEach(([regex, replacement]) => {
    if (replacement) html = html.replace(regex, replacement);
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  res.status(200).send(html);
}
