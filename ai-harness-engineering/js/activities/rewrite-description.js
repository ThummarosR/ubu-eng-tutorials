/* Ch4 · "Rewrite the Description, Watch the Model Re-pick" — before-after-rewrite.
 *
 * Three near-duplicate Lab tools, each with an EDITABLE description. A toy keyword
 * scorer (stand-in for the model's tool choice) re-scores on every keystroke and
 * moves the confidence bars + "model's pick" badge live. The learner discovers the
 * description — not the tool name, not the code — is the prompt that drives selection.
 *
 * Mount point: <div class="rewrite-description"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var REQUEST = 'Lab 3 ว่างพฤหัสบ่าย 13:00 ไหม?';
  var KEYS = ['ว่าง', 'ห้อง', 'lab', 'พฤหัส', '13:00', 'เวลา', 'จอง', 'สรุป', 'ใช้งาน', 'ภาพรวม', 'ทั้งหมด'];
  var DIRECTIVE = /(ค่าเริ่มต้น|default|เฉพาะเมื่อ|use only|เรียกก่อน|call first)/i;

  // start deliberately vague + near-identical -> a 3-way tie
  var CARDS = [
    { name: 'room.availability', d: 'ข้อมูลของห้องแล็บ' },
    { name: 'room.bookings',     d: 'ข้อมูลของห้องแล็บ' },
    { name: 'lab.utilization',   d: 'ข้อมูลของห้องแล็บ' }
  ];

  function reqKeys() {
    var r = REQUEST.toLowerCase();
    return KEYS.filter(function (k) { return r.indexOf(k.toLowerCase()) >= 0; });
  }

  function build(el) {
    var rk = reqKeys();

    el.innerHTML =
      '<div class="rw-req">คำขอจากผู้ใช้ (ตายตัว): <b>' + REQUEST + '</b></div>' +
      '<div class="rw-cards"></div>' +
      '<div class="rw-note" style="display:none"></div>' +
      '<button type="button" class="sib-btn ghost" data-act="reset" style="margin-top:12px">↺ คืนค่าเป็นคำอธิบายกำกวม</button>';

    var wrap = el.querySelector('.rw-cards');
    var note = el.querySelector('.rw-note');

    CARDS.forEach(function (c, i) {
      var card = document.createElement('div');
      card.className = 'rw-card';
      card.innerHTML =
        '<div class="rw-head"><span class="rw-name">' + c.name + '</span><span class="rw-pick">—</span></div>' +
        '<textarea class="rw-ta" rows="2"></textarea>' +
        '<div class="rw-track"><div class="rw-fill"></div></div>' +
        '<div class="rw-pct">ความมั่นใจ 33%</div>';
      var ta = card.querySelector('.rw-ta');
      ta.value = c.d;
      ta.addEventListener('input', function () { c.d = ta.value; render(); });
      wrap.appendChild(card);
    });

    el.querySelector('[data-act="reset"]').addEventListener('click', function () {
      CARDS.forEach(function (c) { c.d = 'ข้อมูลของห้องแล็บ'; });
      el.querySelectorAll('.rw-ta').forEach(function (ta, i) { ta.value = CARDS[i].d; });
      render();
    });

    function score(c) {
      var d = c.d.toLowerCase();
      var base = rk.filter(function (k) { return d.indexOf(k.toLowerCase()) >= 0; }).length;
      var bonus = DIRECTIVE.test(c.d) ? 4 : 0;
      return base + bonus + 0.15; // epsilon so an all-vague set still sums > 0
    }

    function render() {
      var scores = CARDS.map(score);
      var sum = scores.reduce(function (a, b) { return a + b; }, 0);
      var max = Math.max.apply(null, scores);
      var leaders = scores.filter(function (s) { return s === max; }).length;
      var cards = wrap.querySelectorAll('.rw-card');

      cards.forEach(function (card, i) {
        var pct = Math.round(scores[i] / sum * 100);
        card.querySelector('.rw-fill').style.width = pct + '%';
        card.querySelector('.rw-pct').textContent = 'ความมั่นใจ ' + pct + '%';
        var isWin = scores[i] === max && leaders === 1;
        card.classList.toggle('win', isWin);
        card.querySelector('.rw-pick').textContent = isWin ? '◀ โมเดลเลือกอันนี้' : '—';
      });

      // spread = how decisive the lead is
      var sorted = scores.slice().sort(function (a, b) { return b - a; });
      var decisive = leaders === 1 && (sorted[0] - sorted[1]) >= 2;
      if (decisive) {
        var winIdx = scores.indexOf(max);
        note.style.display = '';
        note.innerHTML = 'คำในคำขอไปตรงกับคำอธิบายของ <b>' + CARDS[winIdx].name +
          '</b> — โมเดลเปลี่ยนตัวเลือกแล้ว โดย <b>ไม่ต้องแก้โค้ดหรือเปลี่ยนชื่อ tool เลย</b> ' +
          'แค่ประโยคสั่ง (เช่น “ค่าเริ่มต้นเมื่อถามว่าห้องว่างไหม”) ก็ชี้ทางได้เด็ดขาด';
      } else if (leaders > 1) {
        note.style.display = '';
        note.innerHTML = 'ตอนนี้คำอธิบาย <b>กำกวมและคล้ายกัน</b> — คะแนนเสมอกัน ' +
          (leaders) + ' ทาง โมเดลเดาสุ่ม ลองพิมพ์ประโยคสั่งลงในใบใดใบหนึ่งสิ';
      } else {
        note.style.display = 'none';
      }
    }

    render();
  }

  function init() { document.querySelectorAll('.rewrite-description').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
