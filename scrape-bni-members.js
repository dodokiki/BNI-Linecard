/**
 * ดึงรายชื่อและข้อมูลสมาชิก BNI จาก
 * https://bangkok.bnithailand.com/bangkok-pavilion/th/memberlist
 * และแต่ละ memberdetails แล้วบันทึกเป็น bni-members.json
 *
 * วิธีใช้: npm install แล้วรัน node scrape-bni-members.js
 * (ถ้าหน้า BNI ต้องล็อกอิน ให้รันแบบ headed แล้วล็อกอินก่อน)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const MEMBER_LIST_URL = 'https://bangkok.bnithailand.com/bangkok-pavilion/th/memberlist';
const OUTPUT_JSON = path.join(__dirname, 'bni-members.json');
const AVATARS_DIR = path.join(__dirname, 'avatars');
const WAIT_AFTER_LOAD_MS = 3000;
const DELAY_BETWEEN_MEMBERS_MS = 800;

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
    const u = new URL(imageUrl);
    const client = u.protocol === 'https:' ? https : http;
    const req = client.get(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }, timeout: 15000 }, (res) => {
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

(async () => {
  const headless = process.env.HEADLESS !== 'false';
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
    console.log('กำลังโหลดหน้ารายชื่อสมาชิก...');
    await page.goto(MEMBER_LIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, WAIT_AFTER_LOAD_MS));

    const memberLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="memberdetails"]'));
      return links.map(a => ({
        url: a.href,
        nameFromList: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100)
      }));
    });

    const uniqueByUrl = new Map();
    memberLinks.forEach(m => { if (m.url) uniqueByUrl.set(m.url, m); });
    const list = Array.from(uniqueByUrl.values());
    console.log('พบลิงก์สมาชิกประมาณ', list.length, 'คน');

    if (list.length === 0) {
      console.log('ไม่พบลิงก์ memberdetails อาจเป็นเพราะหน้าโหลดด้วย JS หรือต้องล็อกอิน');
      console.log('ลองรันแบบเปิดเบราว์เซอร์: HEADLESS=false node scrape-bni-members.js แล้วล็อกอินก่อน');
    }

    const members = [];
    const usedAvatarNames = new Set();
    for (let i = 0; i < list.length; i++) {
      const { url, nameFromList } = list[i];
      process.stdout.write(`[${i + 1}/${list.length}] ${nameFromList || url.slice(-30)} ... `);
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1500));

        const detail = await page.evaluate((baseUrl) => {
          const resolveUrl = (url) => {
            if (!url || url.startsWith('data:')) return url;
            try { return new URL(url, baseUrl).href; } catch (e) { return url; }
          };
          const getText = (sel) => {
            const el = document.querySelector(sel);
            return el ? el.textContent.trim() : '';
          };
          const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.querySelector('.content') || document.body;
          const fullText = main ? main.innerText : document.body.innerText;
          const lines = fullText.split(/\n/).map(s => s.trim()).filter(Boolean);

          let name = getText('h1') || getText('h2') || getText('.member-name') || getText('[class*="memberName"]') || getText('[class*="name"]') || lines[0] || '';
          let company = getText('.company') || getText('[class*="company"]') || '';
          let title = getText('.title') || getText('[class*="title"]') || getText('[class*="position"]') || '';
          let tel = '';
          let email = '';
          let address = '';

          const telLink = document.querySelector('a[href^="tel:"]');
          if (telLink) tel = (telLink.getAttribute('href') || '').replace(/^tel:/i, '').trim();
          const mailLink = document.querySelector('a[href^="mailto:"]');
          if (mailLink) email = (mailLink.getAttribute('href') || '').replace(/^mailto:/i, '').split('?')[0].trim();
          let web = '';
          const webLinks = document.querySelectorAll('main a[href^="http"]');
          for (const a of webLinks) {
            const h = (a.getAttribute('href') || '').trim();
            if (h && !h.includes('bnithailand.com') && !h.includes('tel:') && !h.includes('mailto:')) {
              web = h;
              break;
            }
          }

          for (const line of lines) {
            if (!tel && /\d[\d\s\-]{8,}/.test(line) && /โทร|tel|phone|เบอร์|มือถือ|ติดต่อ/i.test(line)) tel = line.replace(/^[^0-9]*/, '').trim();
            if (!email && /@/.test(line)) email = (line.match(/[\w.+-]+@[\w.-]+\.\w+/) || [])[0] || '';
            if (/ที่อยู่|address|ที่ตั้ง|addr/i.test(line)) address = line;
            if (!company && (/\b(co\.|company|บริษัท|จำกัด|Co\.|Ltd)/i.test(line))) company = line;
            if (!title && (/\b(director|manager|founder|ceo|consultant|position|ตำแหน่ง)/i.test(line))) title = line;
          }

          let avatar = null;
          const mainImgs = main ? main.querySelectorAll('img') : [];
          for (const img of mainImgs) {
            const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
            if (!src || src.includes('logo') || src.includes('icon') || src.includes('cookie') || src.length < 10) continue;
            avatar = resolveUrl(src);
            break;
          }
          if (!avatar && mainImgs.length > 0) {
            const first = mainImgs[0];
            const src = (first.getAttribute('src') || first.getAttribute('data-src') || '').trim();
            if (src && src.length >= 10) avatar = resolveUrl(src);
          }

          return {
            name: name || undefined,
            company: company || undefined,
            title: title || undefined,
            tel: tel || undefined,
            email: email || undefined,
            address: address || undefined,
            avatar: avatar || undefined,
            web: web || undefined,
            rawLines: lines.slice(0, 40)
          };
        }, page.url());

        const name = detail.name || nameFromList || '';
        let baseId = slug(name) || ('member-' + i);
        let avatarFilename = baseId;
        let n = 0;
        while (usedAvatarNames.has(avatarFilename)) {
          n++;
          avatarFilename = baseId + '-' + n;
        }
        usedAvatarNames.add(avatarFilename);
        let avatarPath = null;
        if (detail.avatar) {
          try {
            const { buffer, contentType } = await downloadImage(detail.avatar);
            const ext = (contentType.indexOf('png') >= 0) ? 'png' : 'jpg';
            const filename = avatarFilename + '.' + ext;
            const filepath = path.join(AVATARS_DIR, filename);
            fs.writeFileSync(filepath, buffer);
            avatarPath = 'avatars/' + filename;
          } catch (e) {
            avatarPath = detail.avatar;
          }
        }

        members.push({
          detailUrl: url,
          nameFromList: nameFromList || undefined,
          ...detail,
          avatar: avatarPath || detail.avatar
        });
        console.log(avatarPath ? 'OK (มีรูป)' : 'OK');
      } catch (e) {
        console.log('ล้มเหลว:', e.message);
        members.push({
          detailUrl: url,
          nameFromList: nameFromList || undefined,
          error: e.message
        });
      }
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_MEMBERS_MS));
    }

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(members, null, 2), 'utf8');
    console.log('บันทึกแล้วที่', OUTPUT_JSON);
    const withAvatar = members.filter(m => m.avatar && m.avatar.startsWith('avatars/')).length;
    if (withAvatar) console.log('ดาวน์โหลดรูปแล้ว', withAvatar, 'รูป ในโฟลเดอร์ avatars/');
  } finally {
    await browser.close();
  }
})();
