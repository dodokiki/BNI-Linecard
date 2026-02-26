/**
 * อ่าน bni-members.json (ผลจาก scrape-bni-members.js) แล้วรวมกับการ์ดเดิม
 * สร้าง/อัปเดต cards-data.js
 */
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'bni-members.json');
const CARDS_DATA_PATH = path.join(__dirname, 'cards-data.js');

const EXISTING_CARDS = [
  {
    id: 'dodo',
    name: 'วัชรพล ลิมป์ธรรมเลิศ',
    nickname: '"โดโด้" (Dodo)',
    title: 'Software & AI Consultant',
    company: 'Co-founder Dodo Software | เจ้าของ AI Trainer Thailand',
    description: '"สอน AI เพื่อธุรกิจ | อบรม ChatGPT, Midjourney และเครื่องมือ AI ระดับองค์กร"',
    tags: ['AI', 'ChatGPT', 'Software', 'Consulting', 'Training'],
    tel: '080-159-0824',
    telLink: '0801590824',
    email: 'watcharapollimthammalert@gmail.com',
    web: 'https://www.aitrainerthailand.com/',
    webLabel: 'www.aitrainerthailand.com',
    address: null,
    links: [
      { label: 'Facebook - AI Trainer Thailand', url: 'https://www.facebook.com/AITrainerThailand/', class: 'link-fb' },
      { label: 'AI Trainer Thailand - เรียน AI เพื่อธุรกิจ', url: 'https://www.aitrainerthailand.com/', class: 'link-line' }
    ],
    lineUrl: null
  }
];

function slug(str) {
  if (!str || typeof str !== 'string') return 'member';
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0e00-\u0e7f\-]/g, '')
    .slice(0, 30) || 'member';
}

function escapeJs(str) {
  if (str == null) return 'null';
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
}

function parseRawLines(rawLines) {
  if (!rawLines || !Array.isArray(rawLines)) return {};
  const skip = new Set([
    'By continuing to use this website', 'I understand', 'Region Website BNI International',
    'Account Login', 'Pavilion', 'CHAPTER MEMBERS', 'GALLERY', 'My Business',
    '© 2025 BNI Global LLC. All Rights Reserved.', 'Ideal Referral', 'EN:', 'TH:'
  ]);
  const isFooter = (s) => /© \d{4} BNI|All Rights Reserved|trademarks or service marks/i.test(s);
  const lines = rawLines
    .map(s => (s || '').trim())
    .filter(s => s && !skip.has(s) && !isFooter(s));
  let name = '';
  let company = '';
  let title = '';
  const addressLines = [];
  let description = '';
  let afterMyBusiness = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(Mr|Mrs|Miss)\s+/i.test(line)) {
      if (!name) name = line.replace(/^(Mr|Mrs|Miss)\s+/i, '').trim();
      continue;
    }
    if (/บริษัท|บจ\.|จำกัด|Co\.|Ltd\.|CO\.|LTD|\(Head Office\)/i.test(line) && line.length < 120) {
      if (!company) company = line;
      else if (!title && line !== company) title = line;
      continue;
    }
    if (/\d+\s*(\/|หมู่|ม\.|ซ\.|ถ\.|ถนน)|แขวง|เขต|กรุงเทพ|จังหวัด|\d{5}$/.test(line) || (addressLines.length > 0 && addressLines.length < 8)) {
      if (!afterMyBusiness) addressLines.push(line);
      continue;
    }
    if (line === 'My Business' || (i > 2 && line.length > 20 && !company && !/^[A-Za-z\s]+$/.test(line))) {
      if (line === 'My Business') afterMyBusiness = true;
      else if (afterMyBusiness && line.length > 10) description = (description ? description + ' ' : '') + line;
      continue;
    }
    if (i === 0 && line.length < 60) name = name || line;
    else if (!company && line.length > 2 && line.length < 100) company = company || line;
    else if (afterMyBusiness && line.length > 15) description = (description ? description + ' ' : '') + line;
  }
  return {
    name: name || undefined,
    company: company || undefined,
    title: title || undefined,
    address: addressLines.length ? addressLines.join(', ') : undefined,
    description: description || undefined
  };
}

function toCard(m, index) {
  const raw = parseRawLines(m.rawLines);
  const badCompany = !m.company || /© \d{4} BNI|All Rights Reserved/i.test(m.company || '');
  const name = m.name || raw.name || m.nameFromList || 'สมาชิก BNI';
  const company = badCompany ? (raw.company || null) : m.company;
  const title = m.title || raw.title || null;
  const address = m.address || raw.address || null;
  const description = raw.description || null;
  const id = slug(name) || 'member-' + index;
  const links = [];
  if (m.detailUrl) links.push({ label: 'โปรไฟล์ BNI', url: m.detailUrl, class: 'link-line' });
  return {
    id: id,
    name: name,
    nickname: null,
    title: title,
    company: company,
    description: description ? '"' + description.slice(0, 200) + (description.length > 200 ? '...' : '') + '"' : null,
    tags: [],
    tel: m.tel || null,
    telLink: m.tel ? m.tel.replace(/\D/g, '') : null,
    email: m.email || null,
    web: m.web || null,
    webLabel: m.web ? (m.web.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').slice(0, 40)) : null,
    address: address,
    links: links.length ? links : null,
    lineUrl: null,
    avatar: m.avatar || null
  };
}

function cardToJs(c) {
  const parts = [];
  parts.push('  {');
  parts.push('    id: ' + escapeJs(c.id) + ',');
  parts.push('    name: ' + escapeJs(c.name) + ',');
  parts.push('    nickname: ' + (c.nickname == null ? 'null' : escapeJs(c.nickname)) + ',');
  parts.push('    title: ' + (c.title == null ? 'null' : escapeJs(c.title)) + ',');
  parts.push('    company: ' + (c.company == null ? 'null' : escapeJs(c.company)) + ',');
  parts.push('    description: ' + (c.description == null ? 'null' : escapeJs(c.description)) + ',');
  parts.push('    tags: ' + (c.tags && c.tags.length ? '[' + c.tags.map(t => escapeJs(t)).join(', ') + ']' : '[]') + ',');
  parts.push('    tel: ' + (c.tel == null ? 'null' : escapeJs(c.tel)) + ',');
  parts.push('    telLink: ' + (c.telLink == null ? 'null' : escapeJs(c.telLink)) + ',');
  parts.push('    email: ' + (c.email == null ? 'null' : escapeJs(c.email)) + ',');
  parts.push('    web: ' + (c.web == null ? 'null' : escapeJs(c.web)) + ',');
  parts.push('    webLabel: ' + (c.webLabel == null ? 'null' : escapeJs(c.webLabel)) + ',');
  parts.push('    address: ' + (c.address == null ? 'null' : escapeJs(c.address)) + ',');
  parts.push('    avatar: ' + (c.avatar == null ? 'null' : escapeJs(c.avatar)) + ',');
  if (c.links && c.links.length) {
    parts.push('    links: [');
    c.links.forEach(l => {
      parts.push('      { label: ' + escapeJs(l.label) + ', url: ' + escapeJs(l.url) + (l.class ? ", class: " + escapeJs(l.class) : '') + ' },');
    });
    parts.push('    ],');
  } else {
    parts.push('    links: null,');
  }
  parts.push('    lineUrl: ' + (c.lineUrl == null ? 'null' : escapeJs(c.lineUrl)));
  parts.push('  }');
  return parts.join('\n');
}

let bni = [];
if (fs.existsSync(JSON_PATH)) {
  bni = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  bni = bni.filter(m => !m.error);
}

const allCards = [...EXISTING_CARDS, ...bni.map((m, i) => toCard(m, i))];

const usedIds = new Set();
const uniqueCards = allCards.map(c => {
  let id = c.id;
  let n = 0;
  while (usedIds.has(id)) id = c.id + '-' + (++n);
  usedIds.add(id);
  return { ...c, id };
});

const js = `/**
 * ข้อมูลนามบัตรทั้งหมด
 * สร้างจาก scrape-bni-members.js + build-cards-from-json.js (BNI) และการ์ดเดิม
 */
window.CARDS = [
` + uniqueCards.map(cardToJs).join(',\n') + `
];
`;

fs.writeFileSync(CARDS_DATA_PATH, js, 'utf8');
console.log('เขียน', CARDS_DATA_PATH, 'แล้ว รวม', uniqueCards.length, 'การ์ด');
if (bni.length === 0 && !fs.existsSync(JSON_PATH)) {
  console.log('ยังไม่มี bni-members.json — รัน npm run scrape ก่อน');
}
