# Trade Memo Private v6

## V6 เพิ่ม/แก้
- Order ใน Diary และตอน Import จะเรียงตามวัน-เวลาเข้าออเดอร์จากเก่า → ใหม่ ทำให้เห็นลำดับการออกไม้ต่อเนื่อง แม้เพิ่มทีละรอบ
- ราคาเข้าและราคาออกถูกตัดทศนิยมที่เกิน 3 ตำแหน่งตอนบันทึก (ไม่ปัดขึ้น) และแสดง 3 ตำแหน่ง

## V5 เพิ่ม/แก้
- Gemini เท่านั้นสำหรับอ่านภาพ MT5 หลายภาพ
- ใช้ Structured JSON Output เพื่อลด JSON parse error
- Gemini models: 3.5 Flash-Lite (`gemini-3.5-flash-lite`), 3.6 Flash (`gemini-3.6-flash`), 3.1 Pro (`gemini-3.1-pro-preview`)
- รองรับ CSV/Excel และ MT5 Export จริง โดยเฉพาะ `opening_time_utc`, `closing_time_utc`, `type`, `lots`, `original_position_size`, `symbol`, `opening_price`, `closing_price`, `stop_loss`, `take_profit`, `commission`, `swap`, `profit`, `equity`, `margin_level`, `close_reason`, `ticket`
- ปรับเวลา MT5/UTC → เวลาไทย +7 ชั่วโมงตอนนำเข้า/บันทึก และรองรับข้ามวัน
- แยก Cent symbol ที่ลงท้าย `c`
- Google Drive sync ผสาน Order ระดับรายการ, Plan/Review แยก timestamp และรองรับ tombstone สำหรับการลบ Order
- แก้ `saveScalarSetting` ที่หายไป ซึ่งทำให้ V4 ขึ้น `saveScalarSetting is not defined`

## Import
Diary → `📥 อ่านจาก MT5` → เลือกหลายภาพ → `Gemini อ่านภาพ` หรือเลือก CSV/Excel → ตรวจสอบ Preview → เพิ่มรายการที่เลือก

## Google Drive
ใส่ OAuth Client ID เดิมและใช้ `☁️ ซิงค์เดี๋ยวนี้`. ระบบอ่านข้อมูลจาก Drive ก่อน แล้ว merge ข้อมูลในเครื่องกับข้อมูลบน Drive จากนั้นอัปโหลดชุดข้อมูลที่รวมแล้วกลับขึ้น Drive.

## เวลา
ค่าเริ่มต้น +7 ชั่วโมง ตัวอย่าง `2026-09-18 23:50:00` → `2026-09-19 06:50:00`.
