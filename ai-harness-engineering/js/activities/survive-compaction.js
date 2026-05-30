/* Ch6 · "Survive the Compaction" — simulate-and-predict.
 *
 * A finite context window (capacity 100) fills with fact-cards. Each card can be
 * PINNED (written to external memory) or CLEARED (context-edited away). When the
 * window overflows, COMPACT collapses everything in-window into one lossy summary —
 * and ONLY pinned facts survive. A quiz then asks for a fact: it is answerable iff
 * the learner pinned it. Shows compaction (lossy cliff) vs context-editing (surgical).
 *
 * Mount point: <div class="survive-compaction"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var CAP = 100;
  var SEED = [
    { id: 'rule',  txt: 'กติกา: ห้ามจองทับช่วงซ่อมบำรุง', cost: 8,  color: '#2ee6c8', durable: true },
    { id: 'scrape',txt: 'วางผังตารางทั้งเทอม 40KB ลง context', cost: 55, color: '#fb7185', bulky: true },
    { id: 'slot',  txt: 'Lab 3 ว่างศุกร์ 9:00 (ดึงจากระบบจอง)', cost: 4, color: '#a78bfa', refetch: true },
    { id: 'pref',  txt: 'ผู้ใช้ต้องการห้องความจุ ≥ 30 ที่นั่ง', cost: 6, color: '#34d399', durable: true },
    { id: 'chat1', txt: 'คุยเล่นเรื่องอากาศวันนี้', cost: 14, color: '#5f6570' },
    { id: 'chat2', txt: 'ทักทายเปิดบทสนทนา', cost: 16, color: '#5f6570' }
  ];

  function build(el) {
    var cards = SEED.map(function (c) { return Object.assign({ pinned: false, cleared: false }, c); });
    var compacted = false;

    el.innerHTML =
      '<div class="cmp-grid">' +
        '<div class="cmp-barwrap"><div class="cmp-bar"></div><div class="cmp-cap"></div></div>' +
        '<div><div class="cmp-cards"></div></div>' +
      '</div>' +
      '<div class="cmp-actions">' +
        '<button type="button" class="cmp-compact" disabled>⟱ COMPACT (สรุปแล้วล้าง window)</button>' +
        '<button type="button" class="sib-btn ghost" data-act="reset">↺ เริ่มใหม่</button>' +
      '</div>' +
      '<div class="cmp-ext" style="display:none"></div>' +
      '<div class="cmp-quiz" style="display:none"></div>';

    var bar   = el.querySelector('.cmp-bar');
    var cap   = el.querySelector('.cmp-cap');
    var list  = el.querySelector('.cmp-cards');
    var cBtn  = el.querySelector('.cmp-compact');
    var ext   = el.querySelector('.cmp-ext');
    var quiz  = el.querySelector('.cmp-quiz');

    cBtn.addEventListener('click', function () { if (!cBtn.disabled) { compacted = true; render(); } });
    el.querySelector('[data-act="reset"]').addEventListener('click', function () {
      cards = SEED.map(function (c) { return Object.assign({ pinned: false, cleared: false }, c); });
      compacted = false; render();
    });

    function inWindow() { return cards.filter(function (c) { return !c.cleared; }); }
    function sum() { return inWindow().reduce(function (a, c) { return a + c.cost; }, 0); }

    function render() {
      var total = sum();
      var over = total > CAP;

      // --- bar ---
      bar.innerHTML = '';
      bar.classList.toggle('over', over && !compacted);
      if (compacted) {
        var seg = document.createElement('div');
        seg.className = 'cmp-seg';
        seg.style.height = '16%';
        seg.style.background = '#2a2f3a';
        seg.textContent = 'สรุป';
        bar.appendChild(seg);
        cap.textContent = 'หลัง compact · ~16 / 100';
      } else {
        inWindow().forEach(function (c) {
          var seg = document.createElement('div');
          seg.className = 'cmp-seg';
          seg.style.height = (c.cost / CAP * 100) + '%';
          seg.style.background = c.color;
          bar.appendChild(seg);
        });
        cap.textContent = total + ' / 100' + (over ? ' ⚠ ล้น' : '');
      }

      // --- cards ---
      list.innerHTML = '';
      cards.forEach(function (c) {
        var row = document.createElement('div');
        row.className = 'cmp-card' + (c.cleared ? ' cleared' : '');
        var tags = (c.refetch ? ' <span class="cmp-cost">· ดึงใหม่จากระบบได้</span>' :
                    c.bulky ? ' <span class="cmp-cost">· ก้อนใหญ่</span>' : '');
        row.innerHTML = '<span class="cmp-txt">' + c.txt + tags + '</span>' +
          '<span class="cmp-cost">' + c.cost + '</span>' +
          '<button type="button" class="cmp-tog' + (c.pinned ? ' on' : '') + '" data-pin="' + c.id + '">📌 pin</button>' +
          '<button type="button" class="cmp-tog clr' + (c.cleared ? ' on' : '') + '" data-clr="' + c.id + '">🧹 clear</button>';
        list.appendChild(row);
      });
      list.querySelectorAll('[data-pin]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (compacted) return;
          var c = cards.find(function (x) { return x.id === b.dataset.pin; }); c.pinned = !c.pinned; render();
        });
      });
      list.querySelectorAll('[data-clr]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (compacted) return;
          var c = cards.find(function (x) { return x.id === b.dataset.clr; }); c.cleared = !c.cleared; render();
        });
      });

      cBtn.disabled = compacted;
      cBtn.classList.toggle('ready', over && !compacted);

      // --- external memory + quiz (after compaction) ---
      if (compacted) {
        var pinned = cards.filter(function (c) { return c.pinned && !c.cleared; });
        ext.style.display = '';
        ext.innerHTML = '<h5>External memory (MEMORY.md / Postgres) — รอดจากการ compact</h5>' +
          (pinned.length ? '<ul>' + pinned.map(function (c) { return '<li>' + c.txt + '</li>'; }).join('') + '</ul>'
                         : '<p style="margin:0;color:var(--ink-faint)">— ไม่ได้ pin อะไรไว้เลย ทุกอย่างถูกย่อเป็น “สรุป” —</p>');

        var rule = cards.find(function (c) { return c.id === 'rule'; });
        var slot = cards.find(function (c) { return c.id === 'slot'; });
        quiz.style.display = '';
        var q1ok = rule.pinned && !rule.cleared;
        quiz.innerHTML =
          '<div class="q">ถามผู้ช่วยภายหลัง: “กติกาเรื่องช่วงซ่อมบำรุงคืออะไร?”</div>' +
          '<div class="a ' + (q1ok ? 'ok' : 'bad') + '">' + (q1ok
            ? '✅ “ห้ามจองทับช่วงซ่อมบำรุง” — เรียกคืนจาก external memory ได้'
            : '❌ “ผมไม่มีข้อมูลนั้นแล้ว ขอถามใหม่ได้ไหม” — ไม่ได้ pin จึงหายไปกับ “สรุป”') + '</div>' +
          '<div class="q" style="margin-top:10px">ถามต่อ: “Lab 3 ว่างศุกร์ 9:00 ไหม?”</div>' +
          '<div class="a ok">✅ ตอบได้เสมอ — ค่านี้ <b>ดึงใหม่จากระบบจอง</b>ได้ (แหล่งความจริงอยู่นอก context) ' +
          'จึงไม่ต้องพึ่งความจำในบทสนทนา</div>';
      } else {
        ext.style.display = 'none';
        quiz.style.display = 'none';
      }
    }

    render();
  }

  function init() { document.querySelectorAll('.survive-compaction').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
