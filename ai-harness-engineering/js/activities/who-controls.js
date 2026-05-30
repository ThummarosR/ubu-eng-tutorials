/* Ch11 · "Who's in Control?" — sort capabilities into Tools / Resources / Prompts.
 *
 * The dividing line between MCP's three primitives is WHO is in control (model /
 * app / user), NOT whether it writes. The trap: a read-only TOOL that learners
 * misfile as a resource. On Reveal, non-tool cards get a "not implemented here"
 * stamp and a banner shows the live shape: tools-only (e.g. 56 tools / 0 / 0).
 *
 * Mount point: <div class="who-controls"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var CARDS = [
    { id:'cevent', t:'calendar.create_event — เขียน event ลงปฏิทิน', b:'tool', impl:true },
    { id:'avail',  t:'room.availability — อ่านสถานะห้องว่าง (read-only!)', b:'tool', impl:true,
      hint:'read-only ≠ resource — โมเดลยังต้อง “ตัดสินใจเรียก” เอง นั่นทำให้มันเป็น tool · เส้นแบ่งคือ “ใครคุม” ไม่ใช่ “อ่านหรือเขียน”' },
    { id:'handbook', t:'คู่มือนักศึกษา (PDF) — เอกสารอ้างอิง read-only', b:'resource', impl:false },
    { id:'plograph', t:'ผัง PLO→CLO→LLO ของหลักสูตร — กราฟอ้างอิง read-only', b:'resource', impl:false },
    { id:'grades', t:'grades.push — ปล่อยเกรด', b:'tool', impl:true },
    { id:'tpl1', t:'เทมเพลต: “สรุปใบเกรดนี้ นับ F/W”', b:'prompt', impl:false },
    { id:'tpl2', t:'เทมเพลต: “ร่าง TQF3 หมวด 1 จากรหัสวิชา”', b:'prompt', impl:false },
    { id:'docret', t:'documents.retrieve — vector-search คู่มือ', b:'tool', impl:true,
      link:true }
  ];
  var BUCKETS = [
    { k:'tool',     label:'TOOLS', sub:'โมเดลตัดสินใจเรียก' },
    { k:'resource', label:'RESOURCES', sub:'แอปแนบ context read-only' },
    { k:'prompt',   label:'PROMPTS', sub:'ผู้ใช้เลือกเทมเพลต' }
  ];

  function build(el) {
    var placed = {}, selected = null, checked = false, revealed = false;

    el.innerHTML =
      '<div class="sib">' +
        '<div class="sib-traylabel">คลิกการ์ดเพื่อเลือก แล้วคลิกถังที่ใช่</div>' +
        '<div class="sib-tray" data-zone="tray"></div>' +
        '<div class="wc-buckets"></div>' +
        '<div class="sib-actions">' +
          '<button type="button" class="sib-btn" data-act="check">ตรวจคำตอบ</button>' +
          '<button type="button" class="sib-btn" data-act="reveal" style="display:none">เผยว่าเซิร์ฟเวอร์จริงทำอะไร</button>' +
          '<button type="button" class="sib-btn ghost" data-act="reset">↺ เริ่มใหม่</button>' +
          '<span class="sib-tally"></span>' +
        '</div>' +
        '<div class="sib-banner"></div>' +
        '<div class="wc-link"></div>' +
      '</div>';

    var tray = el.querySelector('[data-zone="tray"]');
    var bWrap = el.querySelector('.wc-buckets');
    BUCKETS.forEach(function (b) {
      var d = document.createElement('div');
      d.className = 'sib-bucket'; d.dataset.zone = b.k;
      d.innerHTML = '<h5>' + b.label + ' <span style="color:var(--ink-dim)">· ' + b.sub + '</span></h5><div class="drop"></div>';
      d.addEventListener('click', function () { onZone(b.k); });
      bWrap.appendChild(d);
    });
    var zones = {}; BUCKETS.forEach(function (b) { zones[b.k] = bWrap.querySelector('[data-zone="' + b.k + '"] .drop'); });
    var tally = el.querySelector('.sib-tally');
    var banner = el.querySelector('.sib-banner');
    var link = el.querySelector('.wc-link');
    var checkBtn = el.querySelector('[data-act="check"]');
    var revealBtn = el.querySelector('[data-act="reveal"]');

    function onCard(id) { if (checked) return; selected = (selected === id) ? null : id; render(); }
    function onZone(k) { if (checked || !selected) return; placed[selected] = k; selected = null; render(); }

    checkBtn.addEventListener('click', function () {
      if (Object.keys(placed).length < CARDS.length) { tally.textContent = 'วางให้ครบ ' + CARDS.length + ' ใบก่อน'; return; }
      checked = true; revealBtn.style.display = ''; render();
    });
    revealBtn.addEventListener('click', function () { revealed = true; render(); });
    el.querySelector('[data-act="reset"]').addEventListener('click', function () {
      placed = {}; selected = null; checked = false; revealed = false;
      banner.className = 'sib-banner'; link.className = 'wc-link'; revealBtn.style.display = 'none'; render();
    });

    function cardEl(c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sib-card'; b.dataset.id = c.id;
      var stamp = (revealed && !c.impl) ? '<span class="wc-card-stamp">ไม่ได้ทำบนเซิร์ฟเวอร์นี้</span>' : '';
      var mark = '';
      if (checked) { mark = (placed[c.id] === c.b) ? '✅ ' : '⚠️ '; }
      b.innerHTML = '<span>' + mark + c.t + stamp + '</span>';
      if (checked && placed[c.id] !== c.b) {
        b.innerHTML += '<span class="sib-v"><b>ที่ถูก: ' + c.b.toUpperCase() + '.</b> ' + (c.hint || 'เส้นแบ่งคือ “ใครคุม”') + '</span>';
        b.classList.add('wrong');
      } else if (checked) { b.classList.add('correct'); }
      if (selected === c.id) b.classList.add('sel');
      if (!checked) b.addEventListener('click', function () { onCard(c.id); });
      return b;
    }

    function render() {
      tray.innerHTML = ''; Object.keys(zones).forEach(function (k) { zones[k].innerHTML = ''; });
      el.querySelectorAll('.sib-bucket').forEach(function (bk) { bk.classList.toggle('armed', !!selected && !checked); });
      CARDS.forEach(function (c) {
        var node = cardEl(c);
        (placed[c.id] ? zones[placed[c.id]] : tray).appendChild(node);
      });
      if (checked) {
        var right = CARDS.filter(function (c) { return placed[c.id] === c.b; }).length;
        tally.textContent = 'ถูก ' + right + ' / ' + CARDS.length;
      } else {
        tally.textContent = selected ? 'เลือกแล้ว — คลิกถัง' : (Object.keys(placed).length + ' / ' + CARDS.length);
      }
      if (revealed) {
        banner.className = 'sib-banner show';
        banner.innerHTML = '<b>บนเซิร์ฟเวอร์จริงของเราตอนนี้: 56 tools · 0 resources · 0 prompts</b> — ' +
          'เกือบทุกเซิร์ฟเวอร์ในโลกจริงเป็น “tools-only” แม้สเปกจะมีครบสามแบบ การ์ดที่ไม่ใช่ tool คือสิ่งที่ ' +
          '<em>ควรจะเป็น</em> แต่ยังไม่ได้ทำบนเซิร์ฟเวอร์นี้';
        link.className = 'wc-link show';
        link.innerHTML = '🔗 <b>คู่มือนักศึกษา</b> เป็น “resource” โดยธรรมชาติ แต่บนเซิร์ฟเวอร์นี้เข้าถึงได้ทาง ' +
          '<b>documents.retrieve ซึ่งเป็น tool</b> เท่านั้น — มันถูกบีบให้อยู่ในระนาบ tools (ไม่ได้ผิด แต่ไม่ใช่รูปที่เหมาะที่สุด)';
      } else { banner.className = 'sib-banner'; link.className = 'wc-link'; }
    }

    render();
  }

  function init() { document.querySelectorAll('.who-controls').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
