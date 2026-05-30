/* Ch7 · "Trust but Verify: Catch the Lie" — decision-game.
 *
 * Each round shows a confident agent claim that is secretly false. The learner
 * picks ONE verification source to check it; only a source that INDEPENDENTLY
 * touches the environment reliably catches the lie. A strength bar fills by source
 * so the learner sees self-report/screenshot are weak and a real read-back is strong.
 *
 * Mount point: <div class="catch-the-lie"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  // fixed source order; per-round verdicts vary
  var SRC = [
    { k: 'self',   label: '🗣️ ถามผู้ช่วยซ้ำ (self-report)' },
    { k: 'read',   label: '🔎 อ่านสถานะจริงจากระบบ/ฐานข้อมูล' },
    { k: 'test',   label: '🧪 รัน unit test' },
    { k: 'shot',   label: '📸 ดูภาพ success toast' }
  ];
  var STRENGTH = { no: 12, partial: 60, yes: 100 };

  var ROUNDS = [
    { claim: 'จองห้องให้แล้ว: Lab 3 พฤหัส 13:00',
      v: { self:['no','ผู้ช่วยพูดซ้ำคำเดิมของตัวเอง — ไม่ได้แตะระบบจอง'],
           read:['yes','อ่านสถานะการจองจริง → “ชนคาบเรียน ไม่ได้จอง” จับโกหกได้'],
           test:['partial','เทสต์เช็ครูปแบบคำขอ ไม่ได้เช็คสถานะจริงในระบบ'],
           shot:['no','toast เด้งใน handler ก่อนระบบตอบกลับ — ความมั่นใจลวง'] } },
    { claim: 'สร้าง event ในปฏิทินเรียบร้อย ส่งเชิญแล้ว',
      v: { self:['no','เล่าซ้ำว่า “สร้างแล้ว” โดยไม่เคยถามปฏิทินจริง'],
           read:['yes','ดึงรายการ event จริง → ไม่พบ event นั้น จับได้'],
           test:['partial','เทสต์ผ่าน local แต่ไม่ได้ยิงเข้าปฏิทินจริง'],
           shot:['no','เห็นหน้าจอ “สำเร็จ” แต่ invite ไม่เคยถูกส่งจริง'] } },
    { claim: 'ไม่มีนักศึกษาในรุ่น 70 (0 คน)',
      v: { self:['no','ยืนยันเลขที่ตัวเองเดามา'],
           read:['yes','ดู schema/รายการรุ่นจริง → “ไม่มีรุ่น 70” รุ่นล่าสุดคือ 68 — ที่ถูกคือ “รุ่นนี้ยังไม่มี” ไม่ใช่ “0 คน”'],
           test:['partial','เทสต์ไม่รู้ว่ารุ่น 70 มีจริงไหม'],
           shot:['no','ไม่มีหน้าจอให้ดู เป็นการกรองที่ไม่มีผลลัพธ์'] } },
    { claim: 'บันทึกเกรดแล้ว 24 รายการ',
      v: { self:['no','สรุปจากข้อความเดิมของตัวเอง'],
           read:['yes','SELECT COUNT จริง → เขียนไม่สำเร็จเพราะ constraint จับได้ทันที'],
           test:['partial','เทสต์เช็ค logic ไม่ใช่ผลเขียนจริงในตาราง'],
           shot:['no','ไม่มี toast / หรือ toast เด้งก่อนเขียนเสร็จ'] } },
    { claim: 'ส่งอีเมลแจ้งเจ้าหน้าที่เรียบร้อย',
      v: { self:['no','พูดซ้ำว่า “ส่งแล้ว”'],
           read:['yes','ตรวจ log การส่งจริง → ไม่มีรายการส่งออก จับได้'],
           test:['partial','เทสต์ mock การส่ง ไม่ได้ส่งจริง'],
           shot:['no','toast “ส่งแล้ว” เด้งก่อน SMTP ตอบกลับ'] } }
  ];

  function build(el) {
    var idx = 0, caught = 0, missed = 0, answered = false;

    el.innerHTML =
      '<div class="cl-claim"></div>' +
      '<div class="cl-sources"></div>' +
      '<div class="cl-verdict"></div>' +
      '<div class="cl-strength"><div class="lab">ความแรงของการตรวจสอบ (verification strength)</div>' +
        '<div class="cl-strack"><div class="cl-sfill"></div></div></div>' +
      '<div class="cl-foot"><button type="button" class="sib-btn" data-act="next" style="display:none">รอบถัดไป →</button>' +
        '<span class="cl-score"></span></div>';

    var claimEl = el.querySelector('.cl-claim');
    var srcWrap = el.querySelector('.cl-sources');
    var verdict = el.querySelector('.cl-verdict');
    var sfill   = el.querySelector('.cl-sfill');
    var nextBtn = el.querySelector('[data-act="next"]');
    var score   = el.querySelector('.cl-score');

    nextBtn.addEventListener('click', function () {
      idx++;
      if (idx >= ROUNDS.length) { renderDone(); return; }
      answered = false; renderRound();
    });

    function renderRound() {
      var r = ROUNDS[idx];
      claimEl.innerHTML = '<span class="who">ผู้ช่วยรายงานอย่างมั่นใจ · รอบ ' + (idx + 1) + '/' + ROUNDS.length + '</span>“' + r.claim + '”';
      srcWrap.innerHTML = '';
      SRC.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'cl-src'; b.textContent = s.label;
        b.addEventListener('click', function () { pick(s.k); });
        srcWrap.appendChild(b);
      });
      verdict.className = 'cl-verdict';
      sfill.style.width = '0';
      nextBtn.style.display = 'none';
      score.textContent = 'จับโกหกได้ ' + caught + ' · พลาด ' + missed;
    }

    function pick(k) {
      if (answered) return;
      answered = true;
      var r = ROUNDS[idx];
      var res = r.v[k]; var catches = res[0], blurb = res[1];
      if (catches === 'yes') caught++; else missed++;
      verdict.className = 'cl-verdict show ' + catches;
      var head = catches === 'yes' ? '✅ จับโกหกได้!' : catches === 'partial' ? '🟡 จับได้บางส่วน' : '❌ จับไม่ได้';
      verdict.innerHTML = '<b>' + head + '</b> ' + blurb;
      var st = STRENGTH[catches];
      sfill.style.width = st + '%';
      sfill.style.background = catches === 'yes' ? 'var(--green)' : catches === 'partial' ? 'var(--amber)' : 'var(--red)';
      srcWrap.querySelectorAll('.cl-src').forEach(function (b) { b.disabled = true; });
      nextBtn.style.display = '';
      nextBtn.textContent = (idx + 1 >= ROUNDS.length) ? 'ดูสรุป →' : 'รอบถัดไป →';
      score.textContent = 'จับโกหกได้ ' + caught + ' · พลาด ' + missed;
    }

    function renderDone() {
      claimEl.innerHTML = '<span class="who">สรุป</span>คุณจับโกหกได้ <b>' + caught + '/' + ROUNDS.length + '</b> รอบ';
      srcWrap.innerHTML = '';
      verdict.className = 'cl-verdict show yes';
      verdict.innerHTML = '<b>บทเรียน:</b> เฉพาะแหล่งที่ <b>ไปแตะโลกจริงเอง</b> (อ่านสถานะ/ฐานข้อมูลกลับมา) ' +
        'ที่จับ “มั่นใจแต่ผิด” ได้เสมอ — คำพูดซ้ำของผู้ช่วยและภาพ success toast โกหกได้ ' +
        'unit test จับบั๊กรูปแบบได้ แต่ไม่จับความจริงที่เพี้ยนใน production';
      sfill.style.width = '100%'; sfill.style.background = 'var(--green)';
      nextBtn.style.display = 'none';
      score.textContent = 'จบเกม · จับได้ ' + caught + ' · พลาด ' + missed;
    }

    renderRound();
  }

  function init() { document.querySelectorAll('.catch-the-lie').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
