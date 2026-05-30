/* Ch2 · "Prompt-and-Pray" — toggle-and-observe activity.
 *
 * A single LLM call answers "Is Lab 3 free Thursday 13:00?" purely from a snapshot
 * of bookings pasted into its prompt. No tools, no loop, no memory. The learner
 * injects realistic faults and watches the SAME confident answer become wrong —
 * not because the model got dumber, but because it can't look anything up.
 *
 * Mount point: <div class="prompt-and-pray"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var FAULTS = [
    { key: 'changed', t: 'ข้อมูลจริงเปลี่ยนหลังจากแปะ',
      sub: 'มีคนจอง Lab 3 เมื่อเช้า — แต่ก้อนที่แปะไว้ยังเป็นภาพเก่า' },
    { key: 'missing', t: 'ห้องที่ถามไม่อยู่ในก้อนที่แปะ',
      sub: 'snapshot มีแค่ Lab 1–2 ไม่มีข้อมูล Lab 3 เลย' },
    { key: 'followup', t: 'ถามต่อว่า “แล้วพรุ่งนี้ล่ะ?”',
      sub: 'คำถามต่อยอดที่อ้างถึงบทสนทนาก่อนหน้า' }
  ];

  function build(el) {
    var f = { changed: false, missing: false, followup: false };

    el.innerHTML =
      '<div class="tg-list"></div>' +
      '<div class="tg-out"></div>' +
      '<button type="button" class="sh-reset">↺ เอา fault ออกทั้งหมด</button>';

    var list = el.querySelector('.tg-list');
    var out  = el.querySelector('.tg-out');

    FAULTS.forEach(function (x) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'tg-row danger';
      row.innerHTML = '<span class="tg-txt">' + x.t + '<small>' + x.sub + '</small></span><span class="tg-sw"></span>';
      row.addEventListener('click', function () { f[x.key] = !f[x.key]; render(); });
      list.appendChild(row);
    });

    el.querySelector('.sh-reset').addEventListener('click', function () {
      f.changed = f.missing = f.followup = false; render();
    });

    function render() {
      var rows = list.querySelectorAll('.tg-row');
      rows[0].classList.toggle('on', f.changed);
      rows[1].classList.toggle('on', f.missing);
      rows[2].classList.toggle('on', f.followup);

      var lines = [];
      lines.push('<li class="muted">ผู้ใช้ถาม: <b>“Lab 3 ว่างพฤหัส 13:00 ไหม?”</b></li>');

      var bad = f.changed || f.missing || f.followup;

      if (f.followup) {
        lines.push('<li class="bad">ถามต่อ “แล้วพรุ่งนี้ล่ะ?” → <b>ไม่มีความจำ</b> ไม่รู้ว่า “พรุ่งนี้” เทียบกับวันไหน ตอบมั่ว</li>');
      }
      if (f.missing) {
        lines.push('<li class="bad">ก้อนที่แปะมีแค่ Lab 1–2 → <b>ไม่มีข้อมูล Lab 3</b> แต่มันก็ <b>เดาว่า “ว่าง”</b> ออกมาแบบมั่นใจ</li>');
      } else if (f.changed) {
        lines.push('<li class="bad">จริง ๆ Lab 3 ถูกจองไปแล้วเมื่อเช้า → มันตอบจาก <b>ภาพเก่า</b> ว่า “ว่าง” = <b>ผิด</b></li>');
      } else {
        lines.push('<li class="ok">ตอบ: “Lab 3 ว่างพฤหัส 13:00” — บังเอิญตรงกับ snapshot</li>');
        lines.push('<li class="muted">…แต่มัน <b>ไม่ได้ค้นอะไรเลย</b> — แค่ท่องจากก้อนที่เราแปะให้ ถ้าโลกจริงต่างจากนั้นเมื่อไหร่ก็พังทันที</li>');
      }

      out.className = 'tg-out ' + (bad ? 'bad' : 'ok');
      out.innerHTML =
        '<div class="tg-status">' + (bad
          ? '⚠️ ตอบผิดอย่างมั่นใจ — โมเดลเท่าเดิม แต่ไม่มีมือไปค้น ไม่มีรอบให้แก้ตัว'
          : '🟡 “ดูเหมือนถูก” ในเดโม — แต่นี่คือ prompt-and-pray') + '</div>' +
        '<ul class="tg-trace">' + lines.join('') + '</ul>' +
        (bad ? '<div class="tg-ground"><b>บทเรียน:</b> ปัญหาไม่ใช่ “โมเดลไม่ฉลาดพอ” — ' +
          'มันแค่ <b>ไม่มีเครื่องมือไปดูของจริง ไม่มีลูปให้ทำซ้ำ และไม่มีความจำ</b> ' +
          'ทางแก้คือเพิ่มสิ่งเหล่านั้น ไม่ใช่เปลี่ยนเป็นโมเดลที่แพงกว่า</div>' : '');
    }

    render();
  }

  function init() { document.querySelectorAll('.prompt-and-pray').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
