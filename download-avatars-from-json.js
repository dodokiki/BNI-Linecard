/**
 * อ่าน bni-members.json แล้วเข้าแต่ละ detailUrl ดึงรูปโปรไฟล์มาเก็บใน avatars/
 * แล้วอัปเดต bni-members.json ให้แต่ละคนมี avatar: 'avatars/xxx.jpg'
 *
 * วิธีใช้: node download-avatars-from-json.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const JSON_PATH = path.join(__dirname, 'bni-members.json');
const AVATARS_DIR = path.join(__dirname, 'avatars');
const DELAY_MS = 600;

function slug(str) {
  if (!str || typeof str !== 'string') return 'member';
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0e00-\u0e7f\-]/g, '')
    .slice(0, 30) || 'member';
}

function downloadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    if (!imageUrl || imageUrl.startsWith('data:')) {
      reject(new Error('Invalid URL'));
      return;
    }
    try {
      const u = new URL(imageUrl);
      const client = u.protocol === 'https:' ? https : http;
      const req = client.get(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadImage(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    } catch (e) {
      reject(e);
    }
  });
}

(async () => {
  if (!fs.existsSync(JSON_PATH)) {
    console.log('ไม่พบ bni-members.json รัน npm run scrape ก่อน');
    process.exit(1);
  }

  const members = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false' ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const usedNames = new Set();
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (m.error || !m.detailUrl) continue;
    const name = m.name || m.nameFromList || '';
    let baseId = slug(name) || ('member-' + i);
    let filename = baseId;
    let n = 0;
    while (usedNames.has(filename)) {
      n++;
      filename = baseId + '-' + n;
    }
    usedNames.add(filename);

    process.stdout.write(`[${i + 1}/${members.length}] ${name || m.detailUrl.slice(-40)} ... `);
    try {
      await page.goto(m.detailUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 1200));

      const imageUrl = await page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.querySelector('.content') || document.body;
        const imgs = main ? main.querySelectorAll('img') : [];
        for (const img of imgs) {
          const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
          if (!src || src.length < 15) continue;
          if (/logo|icon|cookie|pixel|1x1|spacer/i.test(src)) continue;
          try {
            return new URL(src, window.location.href).href;
          } catch (e) {}
        }
        return imgs.length ? (imgs[0].src || null) : null;
      });

      if (imageUrl) {
        const { buffer, contentType } = await downloadImage(imageUrl);
        const ext = (contentType && contentType.indexOf('png') >= 0) ? 'png' : 'jpg';
        const filepath = path.join(AVATARS_DIR, filename + '.' + ext);
        fs.writeFileSync(filepath, buffer);
        m.avatar = 'avatars/' + filename + '.' + ext;
        console.log('OK (รูปบันทึกแล้ว)');
      } else {
        console.log('ไม่พบรูปในหน้า');
      }
    } catch (e) {
      console.log('ล้มเหลว:', e.message);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await browser.close();
  fs.writeFileSync(JSON_PATH, JSON.stringify(members, null, 2), 'utf8');
  console.log('อัปเดต bni-members.json แล้ว');
  const withAvatar = members.filter(m => m.avatar && m.avatar.startsWith('avatars/')).length;
  console.log('รวมรูปใน avatars/', withAvatar, 'ไฟล์');
})();
