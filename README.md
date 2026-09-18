# Trade Memo Private v4

เวอร์ชันนี้ต่อยอดจาก V3 สำหรับ Journal เทรดส่วนตัวแบบ local-first และเพิ่มระบบนำเข้า Order จำนวนมาก

## เพิ่มใน V4
- อ่านภาพ MT5 ได้หลายภาพในครั้งเดียวด้วย Gemini หรือ Claude โดยระบบแบ่งเป็นชุดอัตโนมัติแล้วรวมผลให้ตรวจสอบก่อนบันทึก
- รองรับ CSV และ Excel (.xlsx)
- รองรับ CSV ที่ใช้ comma, semicolon หรือ tab เป็นตัวคั่น
- รองรับชื่อคอลัมน์ MT5/อังกฤษ/ไทยหลายรูปแบบ เช่น Symbol, Type, Volume, Open Time, Close Time, Price, Profit, Commission, Swap, Ticket, S/L, T/P
- แปลง Symbol ที่ลงท้าย `c` ให้เป็น lowercase `c` เพื่อแยก Cent Portfolio เช่น `XAUUSDc`
- ปรับเวลา MT5 → เวลาไทยอัตโนมัติตอนนำเข้า Order และปรับวันที่ด้วยเมื่อข้ามเที่ยงคืน
- ค่าเริ่มต้นการปรับเวลาเป็น +7 ชั่วโมง และแก้ไขได้ที่ Settings
- เก็บเวลาเดิมก่อนปรับไว้ในข้อมูล Order (`rawEntryTime`, `rawExitTime`) พร้อมบันทึก `timeAdjustedMinutes` และ `importSource`
- กระจาย Order ลง Diary ตามวันที่หลังปรับเวลาอัตโนมัติ ไม่ได้ยัดทุก Order เข้าไปในวันที่ปัจจุบัน
- ตรวจสอบ/ติ๊กเลือก Order ก่อนบันทึก และข้ามรายการซ้ำจากการนำเข้าซ้ำ
- Google Drive sync / Backup JSON / Setup Manager / Standard vs Cent ยังคงทำงานต่อ

## วิธีใช้งานนำเข้า Order จำนวนมาก
1. เปิด Diary ของวันที่ต้องการ แล้วกด `📥 อ่านจาก MT5`
2. เลือก `📷 เลือกภาพหลายภาพ` แล้วกด Gemini หรือ Claude เพื่ออ่าน
3. หรือเลือก `🗂️ CSV` / `📊 Excel` เพื่ออ่านข้อมูลจากไฟล์
4. ระบบจะแสดง Preview พร้อมวันที่และเวลาหลังปรับเป็นเวลาไทย ให้ตรวจสอบแล้วกด `เพิ่มรายการที่เลือก`
5. ถ้าไฟล์มีหลายวัน ระบบจะสร้าง/อัปเดต Diary ให้ตรงกับวันที่ของแต่ละ Order

## รูปแบบข้อมูล CSV/Excel
ระบบพยายามจับคู่คอลัมน์จากชื่อที่พบบ่อย เช่น:
- Symbol / Asset / Instrument
- Type / Side / Direction
- Volume / Lot / Lots
- Open Time / Entry Time
- Close Time / Exit Time
- Open Price / Entry Price
- Close Price / Exit Price
- Profit / P&L / Net Profit
- Commission / Swap / Ticket / S/L / T/P / Comment

แนะนำให้ไฟล์ 1 แถว = 1 Order ที่อ่าน/คำนวณเป็นรายการที่ต้องการบันทึกแล้ว โดยเฉพาะถ้าไฟล์เป็นประวัติ Deal แบบแยก Open/Close คนละแถว อาจต้องทำไฟล์สรุปก่อน เพราะการจับคู่ Deal หลายแถวขึ้นกับโครงสร้าง Export ของ MT5 แต่ละแบบ

## เวลา MT5 → ไทย
ค่าเริ่มต้นคือ `+7 ชั่วโมง` และระบบจะปรับทั้งวันที่และเวลา ตัวอย่าง:
- MT5 `2026.09.18 20:30:00` → Journal `2026-09-19 03:30:00`
- MT5 `2026.09.18 23:50:00` → Journal `2026-09-19 06:50:00`

การปรับเป็น wall-clock arithmetic จึงไม่ขึ้นกับ timezone ของเครื่อง และรองรับกรณีข้ามวัน

## เปิดใช้บนเครื่อง
ใน Terminal:
```bash
python3 -m http.server 8765
```
แล้วเปิด `http://localhost:8765`

## Cloud hosting
แนะนำ GitHub Pages / Cloudflare Pages / Netlify จากบัญชีของคุณเอง

## สำคัญด้านข้อมูลและความเป็นส่วนตัว
- ข้อมูล Journal และรูปเก็บใน IndexedDB ของ browser เครื่องนั้นเป็นหลัก
- CSV/Excel ถูกอ่านใน browser ก่อนนำไปบันทึก
- ถ้าใช้ Gemini/Claude ภาพ MT5 ที่เลือกจะถูกส่งไป provider นั้นตามที่คุณกดใช้
- API keys ยังเก็บใน browser ตามโครงสร้างเดิมของแอป
- อย่าใส่ MT5 password, broker password, private key หรือ seed phrase

## หมายเหตุ Excel
ตัวอ่าน `.xlsx` จะโหลดไลบรารี SheetJS จาก CDN เมื่อผู้ใช้กดนำเข้า Excel เพื่อไม่เพิ่มขนาดไฟล์หลักของแอป
