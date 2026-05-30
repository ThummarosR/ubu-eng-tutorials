/* Ch15 · "Pick the Right Rung" — sort tasks onto the complexity ladder.
 *
 * Four rungs: 1 single LLM call · 2 deterministic workflow · 3 single agent ·
 * 4 multi-agent. The learner feels BOTH failure modes — over-engineering (AQI on
 * rung 4) and under-engineering (live TQF3 on rung 1) — plus the bonus: some "AI
 * tasks" need no LLM at all (the fixed-column CSV). A cost/predictability meter
 * climbs as cards land on higher rungs.
 *
 * Mount point: <div class="pick-the-rung"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var CARDS = [
    { id:'translate', t:'แปลชื่อบทหนึ่งบทเป็นอังกฤษ', ans:1 },
    { id:'aqi',       t:'ดึงค่าฝุ่น AQI ของวิทยาเขตทุก 30 นาที', ans:2 },
    { id:'csv',       t:'ทุกวัน: อ่าน CSV คอลัมน์ตายตัว แล้วส่งตารางจัดรูปทางอีเมล', ans:2 },
    { id:'tqf3',      t:'ล็อกอิน portal สด แล้วกรอก+ส่ง TQF3 หลายขั้นที่ขึ้นกับสิ่งที่ portal ตอบ', ans:3 },
    { id:'research',  t:'วิจัยคำถามคลุมเครือข้ามหลายเว็บ แล้วเขียนรายงานมีอ้างอิง', ans:4 }
  ];
  var RUNGS = [
    { r:1, label:'1 · LLM call เดียว' },
    { r:2, label:'2 · workflow ตายตัว' },
    { r:3, label:'3 · agent เดี่ยว' },
    { r:4, label:'4 · multi-agent' }
  ];
  var VERDICT = {
    'aqi@4':'Over-engineered: AQI ระบุขั้นตอนล่วงหน้าได้ → rung 2 (cron) ไม่ใช่ฝูง agent',
    'aqi@3':'Over-engineered: เส้นทางไม่เคยเปลี่ยน → rung 2 พอ',
    'tqf3@1':'Under-engineered: portal สดหลายขั้น ทำในครั้งเดียวไม่ได้ → rung 3 agent',
    'tqf3@2':'เส้นทางขึ้นกับสิ่งที่ portal ตอบ ระบุล่วงหน้าไม่ได้ → ต้อง rung 3',
    'csv@1':'ผิดเครื่องมือ ไม่ใช่แค่ผิดขั้น: คอลัมน์ตายตัวเข้า ตารางตายตัวออก — ไม่ต้องใช้ LLM เลย → rung 2',
    'csv@3':'เกินจำเป็นมาก: นี่คือ SELECT + เทมเพลต ไม่ต้องมี agent → rung 2',
    'csv@4':'เกินจำเป็นสุด ๆ: งานนี้ไม่ต้องมี LLM ในเส้นทางเลย → rung 2',
    'research@1':'Under-engineered: เปิดหลายเว็บแล้วสังเคราะห์ ทำครั้งเดียวไม่ได้ → rung 4',
    'research@2':'เส้นทางไม่ตายตัว (ขึ้นกับสิ่งที่เจอ) → สูงกว่า rung 2',
    'translate@2':'เกินจำเป็น: แปลครั้งเดียวจบ ไม่ต้องมี workflow → rung 1'
  };

  function build(el) {
    var placed = {}, selected = null, checked = false;

    el.innerHTML =
      '<div class="sib">' +
        '<div class="sib-traylabel">คลิกการ์ดเพื่อเลือก แล้วคลิกขั้นบันไดที่ใช่</div>' +
        '<div class="sib-tray" data-zone="tray"></div>' +
        '<div class="pr-buckets"></div>' +
        '<div class="pr-meter-lab"><span>ต้นทุน &amp; ความไม่แน่นอน</span><b data-meterlab>ถูก/คาดเดาได้</b></div>' +
        '<div class="pr-track"><div class="pr-fill" data-meter></div></div>' +
        '<div class="sib-actions">' +
          '<button type="button" class="sib-btn" data-act="check">ตรวจคำตอบ</button>' +
          '<button type="button" class="sib-btn ghost" data-act="reset">↺ เริ่มใหม่</button>' +
          '<span class="sib-tally"></span></div>' +
        '<div class="sib-banner"></div>' +
      '</div>';

    var tray = el.querySelector('[data-zone="tray"]');
    var bWrap = el.querySelector('.pr-buckets');
    RUNGS.forEach(function (rg) {
      var d = document.createElement('div'); d.className = 'sib-bucket'; d.dataset.zone = rg.r;
      d.innerHTML = '<h5>' + rg.label + '</h5><div class="drop"></div>';
      d.addEventListener('click', function () { onZone(rg.r); });
      bWrap.appendChild(d);
    });
    var zones = {}; RUNGS.forEach(function (rg) { zones[rg.r] = bWrap.querySelector('[data-zone="' + rg.r + '"] .drop'); });
    var tally = el.querySelector('.sib-tally');
    var banner = el.querySelector('.sib-banner');
    var meter = el.querySelector('[data-meter]');
    var meterLab = el.querySelector('[data-meterlab]');

    function onCard(id) { if (checked) return; selected = (selected === id) ? null : id; render(); }
    function onZone(r) { if (checked || !selected) return; placed[selected] = r; selected = null; render(); }

    el.querySelector('[data-act="check"]').addEventListener('click', function () {
      if (Object.keys(placed).length < CARDS.length) { tally.textContent = 'วางให้ครบ ' + CARDS.length + ' ใบก่อน'; return; }
      checked = true; render();
    });
    el.querySelector('[data-act="reset"]').addEventListener('click', function () {
      placed = {}; selected = null; checked = false; banner.className = 'sib-banner'; render();
    });

    function cardEl(c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sib-card'; b.dataset.id = c.id;
      if (selected === c.id) b.classList.add('sel');
      if (checked) {
        var ok = placed[c.id] === c.ans;
        b.classList.add(ok ? 'correct' : 'wrong');
        var v = ok ? '' : (VERDICT[c.id + '@' + placed[c.id]] || ('ที่ถูกคือ rung ' + c.ans));
        b.innerHTML = '<span>' + (ok ? '✅ ' : '⚠️ ') + c.t + '</span>' + (ok ? '' : '<span class="sib-v">' + v + '</span>');
      } else {
        b.innerHTML = '<span>' + c.t + '</span>';
        b.addEventListener('click', function () { onCard(c.id); });
      }
      return b;
    }

    function render() {
      tray.innerHTML = ''; Object.keys(zones).forEach(function (k) { zones[k].innerHTML = ''; });
      el.querySelectorAll('.sib-bucket').forEach(function (bk) { bk.classList.toggle('armed', !!selected && !checked); });
      CARDS.forEach(function (c) { (placed[c.id] ? zones[placed[c.id]] : tray).appendChild(cardEl(c)); });

      // cost meter = sum of placed rung values
      var sum = 0, cnt = 0;
      CARDS.forEach(function (c) { if (placed[c.id]) { sum += placed[c.id]; cnt++; } });
      var maxSum = cnt * 4, minSum = cnt * 1;
      var pct = cnt ? ((sum - minSum) / Math.max(1, maxSum - minSum)) * 100 : 10;
      meter.style.width = Math.max(8, pct) + '%';
      meter.style.background = pct < 40 ? 'linear-gradient(90deg,var(--green),#5eead4)' : pct < 70 ? 'linear-gradient(90deg,var(--amber),#fbbf24)' : 'linear-gradient(90deg,var(--red),#fb7185)';
      meterLab.textContent = pct < 40 ? 'ถูก/คาดเดาได้' : pct < 70 ? 'ปานกลาง' : 'แพง/ไม่แน่นอน';

      if (checked) {
        var right = CARDS.filter(function (c) { return placed[c.id] === c.ans; }).length;
        tally.textContent = 'ถูก ' + right + ' / ' + CARDS.length;
        if (right === CARDS.length) {
          banner.className = 'sib-banner show';
          banner.innerHTML = '<b>กฎ:</b> ถ้า “ระบุ control flow ล่วงหน้าได้” → เขียนเป็นโค้ด (ไม่ใช่ prompt) · ' +
            'ขึ้นบันไดทีละขั้น <b>เฉพาะเมื่อขั้นล่างพังให้เห็น ๆ</b> — และบางงาน (CSV) ไม่ต้องใช้ LLM เลย';
        } else { banner.className = 'sib-banner'; }
      } else {
        tally.textContent = selected ? 'เลือกแล้ว — คลิกขั้นบันได' : (Object.keys(placed).length + ' / ' + CARDS.length);
      }
    }

    render();
  }

  function init() { document.querySelectorAll('.pick-the-rung').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
