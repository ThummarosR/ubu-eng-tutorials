========================================================
  Ripes Tutorial Bundle - คู่มือการใช้งาน Ripes
========================================================

ภายในโฟลเดอร์นี้มี 3 อย่าง:
  1. เว็บคู่มือภาษาไทย (ไฟล์ HTML)
  2. โปรแกรม Ripes v2.2.6 พร้อมใช้งาน (ไม่ต้องติดตั้ง)
  3. RISC-V GCC toolchain สำหรับ compile โค้ดภาษา C
     (SiFive Freedom Tools v2020.04.0)

------------------------------------------
วิธีเริ่มต้นใช้งาน
------------------------------------------
1. ดับเบิลคลิกที่ไฟล์  เริ่ม.bat  (หรือ START.bat)
2. เว็บคู่มือจะเปิดในเบราว์เซอร์
3. โปรแกรม Ripes จะเปิดมาพร้อมกัน
4. อ่านคู่มือไปพร้อมกับลองใช้ Ripes

------------------------------------------
การตั้งค่า C Compiler (ทำครั้งแรกครั้งเดียว)
------------------------------------------
หากใน Ripes กดเลือก Input type เป็น "C" แล้วขึ้นว่า
"set a valid compiler" ให้ทำดังนี้:

  1. เมนู  Edit > Settings
  2. แท็บ  Editor (หรือ Compiler)
  3. กด Browse ตรงช่อง Compiler path
  4. เลือกไฟล์:
       toolchain\bin\riscv64-unknown-elf-gcc.exe
  5. เมื่อ path เป็นสีเขียว = ตั้งค่าเรียบร้อย
  6. กด OK และกลับไปแท็บ Editor เปลี่ยน Input type
     เป็น C ได้แล้ว

หมายเหตุ: ทำแค่ครั้งเดียว Ripes จะจำการตั้งค่าไว้
         เว้นแต่ย้ายโฟลเดอร์ bundle ไปที่ใหม่

------------------------------------------
โครงสร้างโฟลเดอร์
------------------------------------------
  index.html         - หน้าแรกของคู่มือ (มีวิธีตั้ง C compiler)
  editor.html        - แท็บ Editor
  processor.html     - แท็บ Processor
  memory.html        - แท็บ Memory
  cache.html         - แท็บ Cache
  io.html            - แท็บ I/O
  ecalls.html        - System Calls (ecall)
  examples/          - ตัวอย่างประกอบ (factorial, leds, matmul)
  ripes/             - โปรแกรม Ripes (Ripes.exe)
  toolchain/         - RISC-V GCC compiler (สำหรับ C)
  เริ่ม.bat           - คลิกเพื่อเริ่ม
  START.bat          - launcher แบบเงียบ (สำรอง)

------------------------------------------
ขนาดของชุด Bundle
------------------------------------------
ประมาณ 840 MB
- Ripes binary:     ~ 40 MB
- Tutorial HTML:    ~ 1 MB
- Toolchain:        ~ 800 MB

------------------------------------------
ต้องการอะไรเพิ่มเติม?
------------------------------------------
- หากเปิด Ripes แล้วขึ้น error msvcp140.dll ให้ติดตั้ง
  Microsoft Visual C++ Redistributable ก่อน
- รองรับ Windows 10 / 11 (x64)
- เปิดคู่มือผ่านเบราว์เซอร์ใดก็ได้ (Chrome, Edge, Firefox)

------------------------------------------
ข้อมูลเพิ่มเติม
------------------------------------------
- Ripes โดย Morten Borup Petersen (MIT License)
  https://github.com/mortbopet/Ripes
- SiFive Freedom Tools toolchain (BSD/GPL License)
  https://github.com/sifive/freedom-tools
- คู่มือฉบับภาษาไทย เรียบเรียงสำหรับวิชาสถาปัตยกรรมคอมพิวเตอร์
  สาขา B.Eng. Mechatronics and Automation Engineering
  มหาวิทยาลัยอุบลราชธานี