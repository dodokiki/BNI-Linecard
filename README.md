# Line Card – นามบัตรดิจิทัล

เปิดไฟล์ `index.html` ในเบราว์เซอร์เพื่อดูนามบัตร (ดับเบิลคลิกหรือลากไปที่ Chrome/Edge)

## การ์ดหลายใบ

โปรเจกต์รองรับ**หลายการ์ด**ในหน้าเดียว:

- **หน้ารายการ** – แสดงการ์ดทั้งหมดเป็นรายการ กดเลือกเพื่อเปิดการ์ดนั้น
- **ลิงก์ตรงไปที่การ์ด** – ในเบราว์เซอร์ใช้ `index.html#รหัสการ์ด` เช่น `#dodo` ได้ แต่**เวลาแชร์ใน LINE ต้องใช้ลิงก์แบบ path** (เช่น `https://yoursite.com/dodo`) ถึงจะขึ้นเป็นการ์ด rich preview

ข้อมูลการ์ดอยู่ที่ **`cards-data.js`** แก้ไขหรือเพิ่มการ์ดในอาร์เรย์ `window.CARDS`

### เพิ่มการ์ดใหม่

1. เปิด `cards-data.js`
2. คัดลอกออบเจกต์การ์ดที่มีอยู่ (จาก `{ id: 'dodo', ... }` ถึง `}`)
3. วางต่อท้ายในอาร์เรย์ (ก่อน `];`) แล้วใส่เครื่องหมาย comma ที่การ์ดก่อนหน้า
4. เปลี่ยน `id` เป็นภาษาอังกฤษไม่ซ้ำ (ใช้ในลิงก์ เช่น `#เพื่อน`) และแก้ชื่อ ตำแหน่ง เบอร์ อีเมล ฯลฯ

ฟิลด์ที่ใช้ได้: `id`, `name`, `nickname`, `title`, `company`, `description`, `tags` (อาร์เรย์), `tel`, `telLink`, `email`, `web`, `webLabel`, `address`, `links` (อาร์เรย์ของ `{ label, url, class }`), `lineUrl`, `avatar` (URL รูป)

### ดึงข้อมูลสมาชิก BNI (บังคับรายชื่อจากเว็บ BNI)

1. ติดตั้ง Node.js แล้วในโฟลเดอร์โปรเจกต์รัน: `npm install`
2. รันสคริปต์ดึงข้อมูล: `npm run scrape`  
   - จะเปิดเบราว์เซอร์แบบ headless ไปที่ [รายชื่อสมาชิก BNI Bangkok Pavilion](https://bangkok.bnithailand.com/bangkok-pavilion/th/memberlist) แล้วเข้าแต่ละหน้ารายละเอียดสมาชิก  
   - ถ้าหน้า BNI ต้องล็อกอิน: รัน `set HEADLESS=false` (Windows) หรือ `HEADLESS=false` (Mac/Linux) แล้วรัน `node scrape-bni-members.js` อีกครั้ง เพื่อเปิดเบราว์เซอร์ให้เห็น แล้วล็อกอินในหน้า BNI ก่อน สคริปต์จะรอให้โหลดเสร็จ
3. หลังดึงเสร็จจะได้ไฟล์ `bni-members.json`
4. (ถ้ายังไม่มีรูป) รัน `npm run download-avatars` เพื่อเข้าแต่ละ `detailUrl` ดึงรูปโปรไฟล์มาเก็บใน `avatars/` แล้วอัปเดต `bni-members.json`
5. รัน `npm run build-cards` เพื่อรวมข้อมูล BNI เข้ากับการ์ดเดิมใน `cards-data.js`

จากนั้นเปิด `index.html` จะเห็นรายการการ์ดรวมทั้งคุณและสมาชิก BNI พร้อมรูป (แต่ละการ์ดมีลิงก์ไปโปรไฟล์ BNI)

## ส่งใน LINE เป็น Flex message (การ์ด rich preview)

เวลาส่งลิงก์ในแชท LINE แล้วให้ขึ้นเป็นการ์ดแบบ rich preview (หัวข้อ + คำอธิบาย + รูป) ต้อง **อัปโหลดขึ้นเว็บ** (แนะนำ Vercel) เพราะ LINE จะดึง Open Graph จากลิงก์นั้นมาแสดง

1. **ตั้งค่า URL เว็บที่ deploy แล้ว** ใน `cards-data.js` บรรทัด `window.LINE_CARD_BASE_URL` ให้ชี้ไปที่โดเมนจริง (เช่น `https://bni-linecard.vercel.app`) — ตอนแชร์หรือส่งไปที่ LINE จะใช้ URL นี้เสมอ จึงทำให้ใน LINE ขึ้นเป็นการ์ด Flex ได้แม้เปิดจาก localhost
2. **ใช้ลิงก์แบบ path:** `https://bni-linecard.vercel.app/dodo` (ไม่ใช้ `#dodo`) — เว็บมี API สำหรับ path แต่ละการ์ด เพื่อส่ง og:title, og:description, og:image ตามคนนั้น
3. ปุ่ม **「ส่งไปที่ LINE」** และ **「แชร์นามบัตรนี้」** จะแชร์ลิงก์รูปแบบ `https://yoursite.com/รหัสการ์ด` ให้คนรับเห็นการ์ดแบบ Flex
4. ถ้าการ์ดมี `avatar` (รูปในโฟลเดอร์ `avatars/`) จะถูกใช้เป็น og:image อัตโนมัติ การ์ดที่ไม่มีรูปจะใช้ `card-preview.png` (ใส่ไว้ที่ root ของโปรเจกต์ถ้าต้องการ)
5. ก่อน deploy ต้องมีไฟล์ **`cards.json`** (รัน `npm run build-cards` จะอัปเดตจาก cards-data.js และ bni-members.json)

### ถ้าใน LINE ยังไม่ขึ้นเป็นการ์ด (เห็นแค่ลิงก์ธรรมดา)

- **ตรวจสอบลิงก์ที่แชร์** ต้องเป็น `https://โดเมนคุณ/รหัสการ์ด` (ไม่มี `#` ด้านท้าย) เช่น `https://bni-linecard.vercel.app/ajcharaporn-chanchaew`
- **LINE แคช preview** – ลองแชร์ลิงก์ที่ต่อท้าย `?v=1` แล้วส่งใหม่ (เช่น `https://bni-linecard.vercel.app/ajcharaporn-chanchaew?v=1`) เพื่อให้ LINE ดึง meta ใหม่
- **ต้องมีรูป** – LINE จะแสดงเป็นการ์ดสวยขึ้นเมื่อมี `og:image` ดังนั้นการ์ดควรมี `avatar` หรือมีไฟล์ `card-preview.png` ที่ root

## แชร์

ปุ่ม "แชร์นามบัตรนี้" จะแชร์ลิงก์ของหน้านี้ (บนมือถือที่รองรับจะขึ้นเมนูแชร์) ถ้าเปิดอยู่ที่การ์ดใดการ์ดหนึ่ง ลิงก์ที่แชร์จะชี้ไปที่การ์ดนั้น
