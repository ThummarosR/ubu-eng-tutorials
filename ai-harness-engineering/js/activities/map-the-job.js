/* Ch1 · "Map the Job" — sort-into-buckets activity.
 *
 * The learner sorts everyday Lab-Operations questions into two buckets:
 *   - answered by a plain lookup / query  (no AI needed)
 *   - needs interpretation, language or synthesis  (an LLM might earn its place)
 *
 * Teaches the course's restraint thesis on page one: most "AI work" is honestly a query.
 * Click a card to select it, then click a bucket to drop it there (touch-friendly,
 * no HTML5 drag-and-drop). Vanilla JS, no deps, works offline.
 *
 * Mount point: <div class="map-the-job"></div>
 */
(function () {
  'use strict';

  var CARDS = [
    { id: 'free',   t: 'ห้องไหนว่างบ้าง พฤหัส 13:00?',            bucket: 'lookup',
      v: 'ตารางการจองตอบได้ตรง ๆ — เป็นข้อเท็จจริง ไม่ใช่ความเห็น' },
    { id: 'overdue',t: 'เครื่องมือ #A12 เลยกำหนดคืน/สอบเทียบไหม?',  bucket: 'lookup',
      v: 'เทียบวันที่ในทะเบียนเครื่องมือกับวันนี้ — คำนวณได้แน่นอน' },
    { id: 'clash',  t: 'การจองนี้ชนกับคาบเรียนหรือเปล่า?',          bucket: 'lookup',
      v: 'เทียบช่วงเวลากับตารางสอน = เลขคณิตของช่วงเวลา ไม่ต้องเดา' },
    { id: 'count',  t: 'เดือนที่แล้วมีการจองกี่ครั้ง?',             bucket: 'lookup',
      v: 'นับแถวในฐานข้อมูล — SQL ทำได้ในบรรทัดเดียว' },
    { id: 'note',   t: 'เขียนข้อความไทยสุภาพ อธิบายว่าทำไมจองไม่ได้', bucket: 'judge',
      v: 'ต้องเรียบเรียงภาษาให้เหมาะกับคน — นี่แหละงานที่ LLM คุ้มค่า' },
    { id: 'summary',t: 'สรุปการใช้งานแล็บสัปดาห์นี้เป็นย่อหน้ารายงาน', bucket: 'judge',
      v: 'สังเคราะห์ตัวเลขหลายตัวเป็นเรื่องเล่า — ภาษา+การย่อความ = งานของ LLM' }
  ];

  var BUCKETS = {
    lookup: { label: 'ตอบด้วยการ "ค้น/คำนวณ"', sub: 'lookup · ไม่ต้องใช้ AI' },
    judge:  { label: 'ต้อง "ตีความ/ใช้ภาษา"',   sub: 'judgment · LLM อาจคุ้ม' }
  };

  function build(el) {
    var placed = {};          // id -> bucketKey
    var selected = null;      // currently selected card id
    var checked = false;

    el.innerHTML =
      '<div class="sib">' +
        '<div class="sib-traylabel">การ์ดคำถาม (คลิกเลือก แล้วคลิกถังที่ใช่)</div>' +
        '<div class="sib-tray" data-zone="tray"></div>' +
        '<div class="sib-buckets">' +
          '<div class="sib-bucket" data-zone="lookup"><h5>' + BUCKETS.lookup.label +
            ' <span style="color:var(--green)">· ' + BUCKETS.lookup.sub + '</span></h5><div class="drop"></div></div>' +
          '<div class="sib-bucket" data-zone="judge"><h5>' + BUCKETS.judge.label +
            ' <span style="color:var(--cyan)">· ' + BUCKETS.judge.sub + '</span></h5><div class="drop"></div></div>' +
        '</div>' +
        '<div class="sib-actions">' +
          '<button type="button" class="sib-btn" data-act="check">ตรวจคำตอบ</button>' +
          '<button type="button" class="sib-btn ghost" data-act="reset">↺ เริ่มใหม่</button>' +
          '<span class="sib-tally"></span>' +
        '</div>' +
        '<div class="sib-banner"></div>' +
      '</div>';

    var tray     = el.querySelector('[data-zone="tray"]');
    var zones    = { lookup: el.querySelector('[data-zone="lookup"] .drop'),
                     judge:  el.querySelector('[data-zone="judge"] .drop') };
    var buckets  = el.querySelectorAll('.sib-bucket');
    var tally    = el.querySelector('.sib-tally');
    var banner   = el.querySelector('.sib-banner');

    function cardEl(c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sib-card';
      b.dataset.id = c.id;
      b.innerHTML = '<span>' + c.t + '</span>';
      b.addEventListener('click', function () { onCard(c.id); });
      return b;
    }

    function onCard(id) {
      if (checked) return;
      selected = (selected === id) ? null : id;
      render();
    }
    function onZone(key) {
      if (checked || !selected) return;
      placed[selected] = key;
      selected = null;
      render();
    }

    buckets.forEach(function (bk) {
      bk.addEventListener('click', function () { onZone(bk.dataset.zone); });
    });

    el.querySelector('[data-act="check"]').addEventListener('click', function () {
      if (Object.keys(placed).length < CARDS.length) {
        tally.textContent = 'วางการ์ดให้ครบทั้ง ' + CARDS.length + ' ใบก่อนนะ';
        return;
      }
      checked = true; render();
    });
    el.querySelector('[data-act="reset"]').addEventListener('click', function () {
      placed = {}; selected = null; checked = false; banner.className = 'sib-banner'; render();
    });

    function render() {
      tray.innerHTML = ''; zones.lookup.innerHTML = ''; zones.judge.innerHTML = '';
      buckets.forEach(function (bk) {
        bk.classList.toggle('armed', !!selected && !checked);
      });

      CARDS.forEach(function (c) {
        var where = placed[c.id];
        var node = cardEl(c);
        if (selected === c.id) node.classList.add('sel');
        if (checked) {
          var ok = where === c.bucket;
          node.classList.add(ok ? 'correct' : 'wrong');
          node.innerHTML = '<span>' + (ok ? '✅ ' : '⚠️ ') + c.t + '</span>' +
            '<span class="sib-v">' + (ok ? '' : '<b>ที่ถูกคือ ' +
              (c.bucket === 'lookup' ? '“ค้น/คำนวณ”' : '“ตีความ/ภาษา”') + '.</b> ') + c.v + '</span>';
          node.style.cursor = 'default';
        }
        (where ? zones[where] : tray).appendChild(node);
      });

      if (checked) {
        var right = CARDS.filter(function (c) { return placed[c.id] === c.bucket; }).length;
        tally.textContent = 'ถูก ' + right + ' / ' + CARDS.length;
        var nLookup = CARDS.filter(function (c) { return c.bucket === 'lookup'; }).length;
        banner.className = 'sib-banner show';
        banner.innerHTML = '<b>เห็นไหม — ' + nLookup + ' ใน ' + CARDS.length +
          ' คำถามตอบได้ด้วยการ “ค้น/คำนวณ” ล้วน ๆ ไม่ต้องใช้ AI เลย</b> ' +
          'AI จะคุ้มก็ต่อเมื่อต้อง <em>ใช้ภาษา</em> หรือ <em>สังเคราะห์</em> สิ่งที่ query ทำแทนไม่ได้ — ' +
          'นี่คือแก่นของคอร์สนี้: <b>พิสูจน์ขั้นที่ง่ายกว่าก่อนเสมอ</b> แล้วค่อยเติม AI เฉพาะจุดที่จำเป็นจริง ๆ';
      } else {
        tally.textContent = selected ? 'เลือกแล้ว — คลิกถังที่ใช่' :
          (Object.keys(placed).length + ' / ' + CARDS.length + ' วางแล้ว');
      }
    }

    render();
  }

  function init() { document.querySelectorAll('.map-the-job').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
