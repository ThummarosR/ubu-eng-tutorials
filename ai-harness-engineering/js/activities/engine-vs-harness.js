/* Theory 0·1 · "Engine vs. Harness" — sort-into-buckets activity.
 *
 * The learner sorts capabilities we want from the Lab-Ops Assistant into two buckets:
 *   - the ENGINE (the bare model) can do this on its own
 *   - the model CANNOT — it needs the HARNESS (tools / context / memory / verify / permissions)
 *
 * Teaches the page-0·1 thesis: reliability is engineered around the model, not bought with it —
 * and the engine/harness line *is* the syllabus. Click a card to select it, then click a bucket
 * to drop it there (touch-friendly, no HTML5 drag-and-drop). Reuses the .sib-* styles from
 * activities.css. Vanilla JS, no deps, works offline.
 *
 * Mount point: <div class="engine-vs-harness"></div>
 */
(function () {
  'use strict';

  var CARDS = [
    { id: 'phrase',  t: 'เรียบเรียงประโยคไทยสุภาพ อธิบายว่าทำไมจองไม่ได้', bucket: 'engine',
      v: 'งานภาษา/การเรียบเรียงล้วน ๆ — นี่คือสิ่งที่เครื่องยนต์เก่งโดยกำเนิด' },
    { id: 'summ',    t: 'สรุปเหตุผลของคำตอบให้กระชับ',                    bucket: 'engine',
      v: 'การสังเคราะห์และย่อความ = ความสามารถของตัวโมเดลเอง' },
    { id: 'plan',    t: 'แตกคำถามกว้าง ๆ ออกเป็นขั้นตอนย่อย',             bucket: 'engine',
      v: 'การวางแผน/ให้เหตุผลเป็นของเครื่องยนต์ — ตราบใดที่ไม่ต้องใช้ข้อมูลจริง' },
    { id: 'live',    t: 'รู้ว่าห้อง A เพิ่งถูกจองเมื่อ 5 นาทีก่อน',        bucket: 'harness',
      v: 'ข้อมูลปัจจุบันที่โมเดลไม่เคยเห็น — ต้องมี Tools ไปดึงของจริง' },
    { id: 'mem',     t: 'จำสิ่งที่ผู้ใช้บอกไว้เมื่อวานมาใช้วันนี้',         bucket: 'harness',
      v: 'เครื่องยนต์ลืมทุกอย่างเมื่อจบรอบ — ต้องมี Memory นอก context' },
    { id: 'ground',  t: 'ไม่แต่งห้องที่ไม่มีอยู่จริงขึ้นมาตอบ',            bucket: 'harness',
      v: 'โมเดลมั่นใจเท่ากันทั้งตอนถูกและตอนแต่งเรื่อง — ต้องมี Grounding/Verify' },
    { id: 'gate',    t: 'ถาม “ว่างไหม” ต้องไม่ไปแอบจองให้เอง',           bucket: 'harness',
      v: 'การกั้นสิ่งที่ย้อนไม่ได้เป็นเรื่องของ Permissions ไม่ใช่ความฉลาด' }
  ];

  var BUCKETS = {
    engine:  { label: 'เครื่องยนต์ทำเองได้',  sub: 'engine · ตัวโมเดล' },
    harness: { label: 'ต้องมี harness เติมให้', sub: 'harness · scaffolding' }
  };

  function build(el) {
    var placed = {};          // id -> bucketKey
    var selected = null;      // currently selected card id
    var checked = false;

    el.innerHTML =
      '<div class="sib">' +
        '<div class="sib-traylabel">การ์ดความสามารถ (คลิกเลือก แล้วคลิกถังที่ใช่)</div>' +
        '<div class="sib-tray" data-zone="tray"></div>' +
        '<div class="sib-buckets">' +
          '<div class="sib-bucket" data-zone="engine"><h5>' + BUCKETS.engine.label +
            ' <span style="color:var(--violet)">· ' + BUCKETS.engine.sub + '</span></h5><div class="drop"></div></div>' +
          '<div class="sib-bucket" data-zone="harness"><h5>' + BUCKETS.harness.label +
            ' <span style="color:var(--cyan)">· ' + BUCKETS.harness.sub + '</span></h5><div class="drop"></div></div>' +
        '</div>' +
        '<div class="sib-actions">' +
          '<button type="button" class="sib-btn" data-act="check">ตรวจคำตอบ</button>' +
          '<button type="button" class="sib-btn ghost" data-act="reset">↺ เริ่มใหม่</button>' +
          '<span class="sib-tally"></span>' +
        '</div>' +
        '<div class="sib-banner"></div>' +
      '</div>';

    var tray    = el.querySelector('[data-zone="tray"]');
    var zones   = { engine:  el.querySelector('[data-zone="engine"] .drop'),
                    harness: el.querySelector('[data-zone="harness"] .drop') };
    var buckets = el.querySelectorAll('.sib-bucket');
    var tally   = el.querySelector('.sib-tally');
    var banner  = el.querySelector('.sib-banner');

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
      tray.innerHTML = ''; zones.engine.innerHTML = ''; zones.harness.innerHTML = '';
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
              (c.bucket === 'engine' ? '“เครื่องยนต์”' : '“ต้องมี harness”') + '.</b> ') + c.v + '</span>';
          node.style.cursor = 'default';
        }
        (where ? zones[where] : tray).appendChild(node);
      });

      if (checked) {
        var right = CARDS.filter(function (c) { return placed[c.id] === c.bucket; }).length;
        tally.textContent = 'ถูก ' + right + ' / ' + CARDS.length;
        var nHarness = CARDS.filter(function (c) { return c.bucket === 'harness'; }).length;
        banner.className = 'sib-banner show';
        banner.innerHTML = '<b>เห็นเส้นแบ่งไหม — ' + nHarness + ' ใน ' + CARDS.length +
          ' ความสามารถนี้ เครื่องยนต์ทำเองไม่ได้เลย</b> ' +
          'ไม่ใช่เพราะมัน “ไม่ฉลาดพอ” แต่เพราะมันต้อง <em>เข้าถึงโลกจริง · จำ · ตรวจ · ถูกกั้นสิทธิ์</em> — ' +
          'ทั้งหมดนี้คือ <b>งานของ harness</b> และคือสิ่งที่ทั้งคอร์สนี้พาคุณสร้างทีละชิ้น';
      } else {
        tally.textContent = selected ? 'เลือกแล้ว — คลิกถังที่ใช่' :
          (Object.keys(placed).length + ' / ' + CARDS.length + ' วางแล้ว');
      }
    }

    render();
  }

  function init() { document.querySelectorAll('.engine-vs-harness').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
