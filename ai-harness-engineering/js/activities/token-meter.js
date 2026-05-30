/* Ch12 · "Context Tax Meter" — slider-meter (+ progressive-disclosure stepper).
 *
 * Part A: a slider for "tools enabled" drives a per-turn "tax" bar (definitions
 * shipped before any work). Toggling "ship NAMES only" (deferred discovery) and
 * "filter results in a sandbox" collapses the tax and a 150K result to ~2K — WITHOUT
 * deleting a single tool. Part B: a 3-stage skill stepper shows progressive
 * disclosure (idle name+desc -> body on activation -> script executed, not loaded).
 *
 * Mount point: <div class="token-meter"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  function fmt(n) { return n.toLocaleString('en-US'); }

  function build(el) {
    var tools = 56, namesOnly = false, sandbox = false, taskRan = false, stage = 0;
    var STAGES = [
      { b:'IDLE', t:'name + description เท่านั้น (~370 tokens)' },
      { b:'ACTIVATED', t:'โหลด body — ขั้นตอนเต็มอ่านได้ (~11,600 tokens)' },
      { b:'EXECUTING', t:'สคริปต์ “ถูกรัน” ไม่ได้อ่านเข้า context (เพิ่ม ~0)' }
    ];

    el.innerHTML =
      '<div class="tm-controls">' +
        '<div class="tm-slider-row"><label>จำนวน tool ที่เปิด: <b data-tools></b> / 96</label>' +
          '<input type="range" min="0" max="96" value="56" data-slider></div>' +
        '<div class="tm-toggles">' +
          '<button type="button" class="tm-tog" data-tog="names">ส่งเฉพาะ “ชื่อ” (deferred discovery)</button>' +
          '<button type="button" class="tm-tog" data-tog="sandbox">กรองผลใน sandbox</button>' +
          '<button type="button" class="tm-run" data-run>▶ รันงานปฏิทิน (ดึงผลเข้ามา)</button>' +
        '</div>' +
      '</div>' +
      '<div class="tm-meter">' +
        '<div class="tm-bar-row"><div class="tm-bar-lab"><span>ภาษีต่อรอบ (definitions ก่อนเริ่มงาน)</span><b data-pt></b></div>' +
          '<div class="tm-track"><div class="tm-fill" data-ptf></div></div></div>' +
        '<div class="tm-bar-row"><div class="tm-bar-lab"><span>ผล tool รอบนี้</span><b data-rs></b></div>' +
          '<div class="tm-track"><div class="tm-fill" data-rsf></div></div></div>' +
        '<div class="tm-bar-row"><div class="tm-bar-lab"><span>รวม context รอบนี้</span><b data-tot></b></div>' +
          '<div class="tm-track"><div class="tm-fill" data-totf></div></div></div>' +
      '</div>' +
      '<div class="tm-note" data-note></div>' +
      '<div class="tm-pin">ℹ️ ไม่ได้ลบ tool สักตัว — ยังมีครบ <b data-tools2></b> ตัว แค่ไม่ปล่อยให้มัน “อยู่” ใน window</div>' +
      '<div style="margin-top:18px"><div class="activity-panel-label">Skill · progressive disclosure (กดเลื่อนสเตจ)</div>' +
        '<div class="tm-stages"></div>' +
        '<button type="button" class="sib-btn ghost" data-next style="margin-top:10px">สเตจถัดไป →</button>' +
        '<span class="tm-pin" data-skillnote style="margin-left:10px"></span></div>';

    var $ = function (s) { return el.querySelector(s); };
    var slider = $('[data-slider]');
    slider.addEventListener('input', function () { tools = +slider.value; render(); });
    $('[data-tog="names"]').addEventListener('click', function () { namesOnly = !namesOnly; render(); });
    $('[data-tog="sandbox"]').addEventListener('click', function () { sandbox = !sandbox; render(); });
    $('[data-run]').addEventListener('click', function () { taskRan = true; render(); });
    var stagesWrap = $('.tm-stages');
    STAGES.forEach(function (s) {
      var d = document.createElement('div'); d.className = 'tm-stage';
      d.innerHTML = '<b>' + s.b + '</b>' + s.t; stagesWrap.appendChild(d);
    });
    $('[data-next]').addEventListener('click', function () { stage = (stage + 1) % 3; render(); });

    function render() {
      $('[data-tools]').textContent = tools;
      $('[data-tools2]').textContent = tools;
      $('[data-tog="names"]').classList.toggle('on', namesOnly);
      $('[data-tog="sandbox"]').classList.toggle('on', sandbox);

      var perTurn = namesOnly ? tools * 10 : tools * 350;
      var result = taskRan ? (sandbox ? 2000 : 150000) : 0;
      var total = perTurn + result;

      $('[data-pt]').textContent = fmt(perTurn) + ' tok';
      $('[data-rs]').textContent = taskRan ? fmt(result) + ' tok' : '— (ยังไม่รัน)';
      $('[data-tot]').textContent = fmt(total) + ' tok';
      $('[data-ptf]').style.width = Math.min(100, perTurn / 34000 * 100) + '%';
      $('[data-ptf]').style.background = namesOnly ? 'linear-gradient(90deg,var(--green),#5eead4)' : 'linear-gradient(90deg,var(--amber),#fbbf24)';
      $('[data-rsf]').style.width = Math.min(100, result / 170000 * 100) + '%';
      $('[data-rsf]').style.background = sandbox ? 'linear-gradient(90deg,var(--green),#5eead4)' : 'linear-gradient(90deg,var(--red),#fb7185)';
      $('[data-totf]').style.width = Math.min(100, total / 170000 * 100) + '%';
      $('[data-totf]').style.background = 'linear-gradient(90deg,var(--cyan),var(--cyan-2))';

      var msg = [];
      if (!namesOnly) msg.push('definitions ของ ' + tools + ' tool ถูกส่งเข้า context <b>ทุกเทิร์น</b> ก่อนอ่านคำถามด้วยซ้ำ');
      else msg.push('ส่งเฉพาะ <b>ชื่อ</b> ~10 tok/ตัว แล้วดึง schema เต็มเฉพาะตอนใช้จริง — ความสามารถเท่าเดิม ต้นทุนหด');
      if (taskRan && !sandbox) msg.push('ผลดิบ 150,000 tok ไหลเข้า context และถูกส่งซ้ำทุกเทิร์นหลังจากนี้');
      if (taskRan && sandbox) msg.push('โค้ดกรองใน sandbox → เหลือ <b>2,000 tok</b> เข้ามาเฉพาะคำตอบ (150K→2K)');
      $('[data-note]').innerHTML = msg.join(' · ');

      var stages = stagesWrap.querySelectorAll('.tm-stage');
      stages.forEach(function (s, i) { s.classList.toggle('active', i === stage); });
      var notes = ['idle: จ่ายแค่ ~370 tok แม้ Skill พร้อมใช้',
                   'activated: body ~11,600 tok โหลด “เฉพาะเทิร์นที่งานนั้นเริ่ม”',
                   'executing: สคริปต์รันเป็นโค้ด คืนแต่ผลลัพธ์ — เลี่ยงต้นทุนการอ่านสคริปต์เข้ามา'];
      $('[data-skillnote]').innerHTML = notes[stage] +
        (stage === 0 ? ' · เทียบกับ “ฝังในระบบprompt” ที่จ่าย ~11,600 ทุกเทิร์นตลอดไป' : '');
    }

    render();
  }

  function init() { document.querySelectorAll('.token-meter').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
