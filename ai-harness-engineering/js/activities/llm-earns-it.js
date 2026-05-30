/* Ch17 · "Where does the LLM earn it?" — sort-into-buckets.
 *
 * Across the fleet of five real systems, sort each pitched "agent capability" into
 * "the LLM genuinely earns its keep" vs "leave it deterministic (SQL view / code
 * tool / dashboard)". The reveal: ~70% is honestly deterministic — the LLM earns it
 * only on synthesis / NL-generation / qualitative judgment over free text.
 *
 * Mount point: <div class="llm-earns-it"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var CARDS = [
    { id:'sar',   t:'ร่าง SAR ภาษาไทยสำหรับ ABET + จัดอันดับช่องว่างเชิงความเสี่ยง', b:'llm',
      v:'งานเขียนเชิงเล่าเรื่อง + ตัดสินเชิงคุณภาพ — LLM คุ้มจริง' },
    { id:'slot',  t:'หาช่วงเวลาห้องว่างที่ลงตัว', b:'det',
      v:'เป็นเลขคณิตของเซ็ตช่วงเวลา → code tool ไม่ใช่ agent' },
    { id:'plo',   t:'สังเคราะห์ข้ามหน้าจอ + อธิบาย “ทำไม PLO5 ต่ำ” เป็นภาษาไทย', b:'llm',
      v:'สังเคราะห์ + ภาษา ข้ามหลายแหล่ง — LLM คุ้ม' },
    { id:'gpa',   t:'คำนวณ GPA/หน่วยกิตที่ตัววางแผนทำอยู่แล้ว', b:'det',
      v:'มีโค้ดคำนวณอยู่แล้ว — agent ต้อง “อ่าน” ไม่ใช่คำนวณใหม่' },
    { id:'bloom', t:'อ่านระดับ Bloom จาก CLO/LLO ที่เป็น free text + ร่าง TQF3 (มี gate)', b:'llm',
      v:'ตัดสินจากข้อความอิสระ + ร่าง — LLM คุ้ม (เขียนจริงผ่าน gate)' },
    { id:'attain',t:'ตัวเลข attainment / alignment ของ OBE', b:'det',
      v:'เป็น SQL view — อย่าให้โมเดลแต่งตัวเลขจากช่องว่าง' },
    { id:'stuck', t:'สังเคราะห์ “แล็บนี้ติดขัดหรือแค่ช้า” + ร่างคอมเมนต์ formative', b:'llm',
      v:'ตัดสินเชิงคุณภาพ + ภาษา — LLM คุ้ม' },
    { id:'cock',  t:'แผงควบคุม cockpit / นับ cohort / สถานะ monitor / CSV', b:'det',
      v:'control plane + นับแถว = ศูนย์ LLM โดยตั้งใจ' }
  ];
  var B = { llm: { label:'LLM คุ้มจริง', col:'var(--cyan)' }, det: { label:'ปล่อยให้เป็น deterministic', col:'var(--green)' } };

  function build(el) {
    var placed = {}, selected = null, checked = false;
    el.innerHTML =
      '<div class="sib"><div class="sib-traylabel">คลิกการ์ดเพื่อเลือก แล้วคลิกถัง</div>' +
      '<div class="sib-tray" data-zone="tray"></div>' +
      '<div class="sib-buckets">' +
        '<div class="sib-bucket" data-zone="llm"><h5 style="color:var(--cyan)">' + B.llm.label + '</h5><div class="drop"></div></div>' +
        '<div class="sib-bucket" data-zone="det"><h5 style="color:var(--green)">' + B.det.label + '</h5><div class="drop"></div></div>' +
      '</div>' +
      '<div class="sib-actions"><button type="button" class="sib-btn" data-act="check">ตรวจคำตอบ</button>' +
        '<button type="button" class="sib-btn ghost" data-act="reset">↺ เริ่มใหม่</button><span class="sib-tally"></span></div>' +
      '<div class="sib-banner"></div></div>';

    var tray = el.querySelector('[data-zone="tray"]');
    var zones = { llm: el.querySelector('[data-zone="llm"] .drop'), det: el.querySelector('[data-zone="det"] .drop') };
    var tally = el.querySelector('.sib-tally'), banner = el.querySelector('.sib-banner');
    el.querySelectorAll('.sib-bucket').forEach(function (bk) { bk.addEventListener('click', function () { onZone(bk.dataset.zone); }); });

    function onCard(id) { if (checked) return; selected = (selected === id) ? null : id; render(); }
    function onZone(k) { if (checked || !selected) return; placed[selected] = k; selected = null; render(); }

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
        var ok = placed[c.id] === c.b; b.classList.add(ok ? 'correct' : 'wrong');
        b.innerHTML = '<span>' + (ok ? '✅ ' : '⚠️ ') + c.t + '</span><span class="sib-v">' +
          (ok ? '' : '<b>ที่ถูก: ' + B[c.b].label + '.</b> ') + c.v + '</span>';
      } else { b.innerHTML = '<span>' + c.t + '</span>'; b.addEventListener('click', function () { onCard(c.id); }); }
      return b;
    }

    function render() {
      tray.innerHTML = ''; zones.llm.innerHTML = ''; zones.det.innerHTML = '';
      el.querySelectorAll('.sib-bucket').forEach(function (bk) { bk.classList.toggle('armed', !!selected && !checked); });
      CARDS.forEach(function (c) { (placed[c.id] ? zones[placed[c.id]] : tray).appendChild(cardEl(c)); });
      if (checked) {
        var right = CARDS.filter(function (c) { return placed[c.id] === c.b; }).length;
        var det = CARDS.filter(function (c) { return c.b === 'det'; }).length;
        tally.textContent = 'ถูก ' + right + ' / ' + CARDS.length;
        banner.className = 'sib-banner show';
        banner.innerHTML = '<b>' + det + ' ใน ' + CARDS.length + ' ความสามารถที่ถูกเสนอว่าเป็น “งานของ agent” จริง ๆ คือ deterministic</b> — ' +
          'SQL view · code tool · dashboard · control plane · ราว 70% ของ fleet จริงเป็นแบบนี้ ' +
          'LLM คุ้มเฉพาะ <em>การสังเคราะห์ · ภาษา · การตัดสินเชิงคุณภาพเหนือข้อความอิสระ</em> — และพิสูจน์ขั้น deterministic ก่อนเสมอ';
      } else {
        tally.textContent = selected ? 'เลือกแล้ว — คลิกถัง' : (Object.keys(placed).length + ' / ' + CARDS.length);
      }
    }
    render();
  }

  function init() { document.querySelectorAll('.llm-earns-it').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
