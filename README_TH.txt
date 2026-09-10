# Trade Memo Private v2

เวอร์ชันนี้ทำหน้าตา/โครงสร้างและ workflow ให้ใกล้ Trade Memo ต้นแบบมากขึ้น แต่เป็นโค้ดแยกของคุณเองและ local-first

## มีให้แล้ว
- Diary + week strip
- Pre-trade plan: Bias / Setup / Entry-Exit / Risk-News
- รูป plan / MT5 / review
- เพิ่ม/แก้ไข/ลบ trade
- Symbol / side / lot / entry / exit / SL / TP / P&L / commission / swap / ticket / notes
- Dashboard: day / week / month / year / all
- Winrate / Net P&L / Profit Factor / Expectancy / R:R / Max Drawdown / Best/Worst / Streak / Lots
- Equity curve / P&L bar chart
- Monthly calendar
- Breakdown ตามช่วงเวลา / symbol / side / weekday
- Backup/Restore JSON รวมรูป
- Optional Claude/Gemini screenshot extraction
- Optional Google Drive sync ด้วย Drive API scope drive.file
- ไม่มี analytics ในตัวแอป
- IndexedDB เป็น storage หลัก
- Responsive / PWA structure

## เปิดใช้บน Mac
ใน Terminal:
python3 -m http.server 8765

แล้วเปิด:
http://localhost:8765

## Cloud hosting
แนะนำ GitHub Pages / Cloudflare Pages / Netlify จากบัญชีของคุณเอง
Google Drive และ OneDrive ใช้เก็บ backup ได้ แต่ไม่ควรใช้เป็น web host

## สำคัญ
- ห้ามใส่ MT5 password / broker password / API secret / private key / seed phrase
- ถ้าใช้ Claude/Gemini ภาพ MT5 ที่เลือกจะถูกส่งไป provider นั้นโดยตรง
- Google Drive sync ส่งข้อมูล/รูปขึ้น Drive ของ Google account ที่คุณ authorize


## V3 additions
- Setup dropdown: QM, Double Top, Double Bottom, M Pattern, W Pattern, Liquidity Sweep, BOS / CHoCH
- Setup Manager: เพิ่ม/ลบแผนเองได้
- Dashboard: Setup statistics และ Asset × Setup
- Mobile camera capture
- Gemini default: gemini-3.8-flash (GA as of Sep 2026)
- AI confirmation before sending screenshot

V3.1 final: merged local+remote image metadata so downloaded images retain diary date/type.
