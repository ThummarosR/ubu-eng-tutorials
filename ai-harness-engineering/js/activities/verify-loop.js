/* Ch3 · "Verify the Loop" — toggle-and-observe activity.
 *
 * One fixed agent task — "move the booking so it doesn't clash with a class".
 * Two switches:
 *   - VERIFY step (default ON): the check comes from the real booking system.
 *   - "let the MODEL self-check instead" (a trap): routes the check back inside
 *     the model — and still ships the wrong answer.
 * Same loop shape every time; the learner sees that deleting the ENVIRONMENTAL
 * verify turns a self-correcting agent into a confident liar.
 *
 * Mount point: <div class="verify-loop"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  function build(el) {
    var verifyOn = true;
    var selfCheck = false;

    el.innerHTML =
      '<div class="tg-list">' +
        '<button type="button" class="tg-row" data-k="verify"><span class="tg-txt">ขั้น VERIFY จาก “ระบบจริง”' +
          '<small>ถาม booking system ว่าจองได้จริงไหม แล้วป้อนผลกลับเข้าลูป</small></span><span class="tg-sw"></span></button>' +
        '<button type="button" class="tg-row danger" data-k="self"><span class="tg-txt">กับดัก: ให้ “โมเดลตรวจงานตัวเอง” แทน' +
          '<small>โมเดลอ่านคำตอบของตัวเองแล้วบอกว่าโอเค — ยังอยู่ “ในหัว” ไม่แตะโลกจริง</small></span><span class="tg-sw"></span></button>' +
      '</div>' +
      '<div class="tg-out"></div>' +
      '<button type="button" class="sh-reset">↺ คืนค่าเริ่มต้น (VERIFY เปิด)</button>';

    var rowV = el.querySelector('[data-k="verify"]');
    var rowS = el.querySelector('[data-k="self"]');
    var out  = el.querySelector('.tg-out');

    rowV.addEventListener('click', function () { verifyOn = !verifyOn; render(); });
    rowS.addEventListener('click', function () { selfCheck = !selfCheck; render(); });
    el.querySelector('.sh-reset').addEventListener('click', function () {
      verifyOn = true; selfCheck = false; render();
    });

    function render() {
      rowV.classList.toggle('on', verifyOn);
      rowS.classList.toggle('on', selfCheck);

      var L = ['<li class="muted">งาน: <b>“ขยับการจองไม่ให้ชนคาบเรียน”</b></li>',
               '<li class="ok">GATHER → อ่านการจอง + ตารางสอน</li>',
               '<li class="ok">ACT → ลองจอง Lab 3 พฤหัส <b>13:00</b></li>'];
      var ok, head, ground = '';

      if (verifyOn) {
        L.push('<li class="warn">VERIFY (จากระบบจริง) → “13:00 <b>ชนคาบเรียน</b> — FAIL” ป้อนผลกลับเข้าลูป</li>');
        L.push('<li class="ok">REPEAT → เห็น FAIL จึงเลื่อนเป็น <b>15:00</b></li>');
        L.push('<li class="ok">VERIFY → “15:00 ว่าง — OK” ระบบยืนยันจริง</li>');
        ok = true; head = '✅ จองสำเร็จจริง — ลูปแก้ตัวเองได้ เพราะ “ความจริง” มาจากระบบ ไม่ใช่จากคำพูดของโมเดล';
        if (selfCheck) L.push('<li class="muted">(การ “ตรวจเอง” ไม่มีผล — ระบบจริงตัดสินไปแล้ว)</li>');
      } else if (selfCheck) {
        L.push('<li class="warn">ข้าม VERIFY จากระบบ → ให้ “โมเดลตรวจงานตัวเอง” แทน</li>');
        L.push('<li class="bad">โมเดลอ่านคำตอบตัวเองแล้วสรุป “ผมตรวจแล้ว เรียบร้อยดี ไม่ชน”</li>');
        ok = false; head = '⚠️ ยังพังเหมือนเดิม — การตรวจที่อยู่ “ในหัวโมเดล” มองไม่เห็นโลกจริง';
        ground = 'จริง ๆ 13:00 <b>ยังชนคาบเรียนอยู่</b> — ห้องถูกจองทับคาบสอน การ reflection ไม่ใช่ verification';
      } else {
        L.push('<li class="warn">ข้าม VERIFY — ไม่ถามระบบจริงเลย กระโดดจาก ACT ไป REPEAT</li>');
        L.push('<li class="bad">ประกาศ “เรียบร้อย! จองให้แล้ว 13:00” แล้วจบลูป</li>');
        ok = false; head = '⚠️ “Done!” ที่เป็นคำโกหก — แบนเนอร์เขียว แต่งานไม่จริง';
        ground = 'จริง ๆ 13:00 <b>ยังชนคาบเรียน</b> — และไม่มีอะไรในคำตอบของโมเดลเตือนคุณเลย';
      }

      out.className = 'tg-out ' + (ok ? 'ok' : 'bad');
      out.innerHTML = '<div class="tg-status">' + head + '</div>' +
        '<ul class="tg-trace">' + L.join('') + '</ul>' +
        (ground ? '<div class="tg-ground"><b>ความจริงจากสภาพแวดล้อม:</b> ' + ground + '</div>' : '');
    }

    render();
  }

  function init() { document.querySelectorAll('.verify-loop').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
