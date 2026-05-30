/* Ch5 · "Feed the Right Context" — toggle-and-observe.
 *
 * The assistant is asked "Is Lab 3 free Thursday 13:00?". The booking table alone
 * shows no booking -> a naive "free". The learner feeds in the rules that actually
 * govern the room (class block-times, holidays, the maintenance window) and watches
 * a confidently-wrong "free" become a correct "not free". Lesson: feed the right
 * rules, not everything — and never omit the load-bearing ones.
 *
 * Mount point: <div class="context-toggle"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var RULES = [
    { key: 'class', t: 'ตารางคาบเรียน', sub: 'พฤหัส 13:00–15:00 มีคาบสอนใช้ Lab 3 อยู่',
      reason: 'มีคาบเรียนใช้ห้องช่วง 13:00–15:00' },
    { key: 'holiday', t: 'ปฏิทินวันหยุด/กิจกรรม', sub: 'พฤหัสนี้เป็นวันหยุดพิเศษของคณะ',
      reason: 'ตรงกับวันหยุดพิเศษ — อาคารปิด' },
    { key: 'maint', t: 'ช่วงซ่อมบำรุงประจำสัปดาห์', sub: 'พฤหัสบ่ายเป็นช่วงปิดปรับปรุงห้องแล็บ',
      reason: 'อยู่ในช่วงซ่อมบำรุงประจำสัปดาห์' }
  ];

  function build(el) {
    var on = { class: false, holiday: false, maint: false };

    el.innerHTML =
      '<div class="sh-scenario" style="margin-bottom:12px">ถาม: <b>“Lab 3 ว่างพฤหัส 13:00 ไหม?”</b> — ' +
        'ตารางการจองไม่มีใครจองช่วงนั้น แต่นั่นไม่ใช่เรื่องทั้งหมด เปิด “กติกา” ที่ควรป้อนเข้าไป:</div>' +
      '<div class="tg-list"></div>' +
      '<div class="tg-out"></div>' +
      '<button type="button" class="sh-reset">↺ เอากติกาออกทั้งหมด (เห็นแค่ตารางจอง)</button>';

    var list = el.querySelector('.tg-list');
    var out  = el.querySelector('.tg-out');

    RULES.forEach(function (r) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'tg-row';
      row.dataset.k = r.key;
      row.innerHTML = '<span class="tg-txt">ป้อนกติกา: ' + r.t + '<small>' + r.sub + '</small></span><span class="tg-sw"></span>';
      row.addEventListener('click', function () { on[r.key] = !on[r.key]; render(); });
      list.appendChild(row);
    });

    el.querySelector('.sh-reset').addEventListener('click', function () {
      on.class = on.holiday = on.maint = false; render();
    });

    function render() {
      list.querySelectorAll('.tg-row').forEach(function (row) {
        row.classList.toggle('on', on[row.dataset.k]);
      });
      var seen = RULES.filter(function (r) { return on[r.key]; });
      var lines = ['<li class="muted">ตารางการจอง: ช่วง 13:00 ไม่มีใครจอง</li>'];

      if (seen.length === 0) {
        out.className = 'tg-out bad';
        lines.push('<li class="bad">ผู้ช่วยเห็น “แค่ตารางจอง” จึงตอบ <b>“ว่าง ✅”</b> — มั่นใจแต่ <b>ผิด</b></li>');
        out.innerHTML = '<div class="tg-status">⚠️ ตอบผิด — ไม่ได้ป้อน “กติกา” ที่ควบคุมห้องจริง ๆ</div>' +
          '<ul class="tg-trace">' + lines.join('') + '</ul>' +
          '<div class="tg-ground"><b>บทเรียน:</b> โมเดลไม่ได้โง่ — เราแค่ไม่ได้ป้อนกฎที่จำเป็น ' +
          'การให้ “บริบทที่ถูก” สำคัญกว่าการให้ “บริบทเยอะ”</div>';
      } else {
        out.className = 'tg-out ok';
        seen.forEach(function (r) { lines.push('<li class="ok">เห็นกติกา: ' + r.t + ' → ' + r.reason + '</li>'); });
        var complete = seen.length === RULES.length;
        lines.push('<li class="' + (complete ? 'ok' : 'warn') + '">ตอบ: <b>“ไม่ว่าง”</b> — ' +
          (complete ? 'พร้อมเหตุผลครบทุกข้อ' : 'ถูกต้องขึ้น แต่ยังเห็นเหตุผลไม่ครบ') + '</li>');
        out.innerHTML = '<div class="tg-status">' + (complete
          ? '✅ ตอบถูกและครบ — ป้อนกติกาที่จำเป็นครบแล้ว'
          : '🟡 ตอบถูกขึ้น — แต่ยังขาดบางกติกา') + '</div>' +
          '<ul class="tg-trace">' + lines.join('') + '</ul>';
      }
    }

    render();
  }

  function init() { document.querySelectorAll('.context-toggle').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
