/* Ch20 · "Clip the Senses onto the Loop" — capstone clip activity.
 *
 * A LOOP box sits in the centre with INPUT/OUTPUT edges, TOOL sockets, and three
 * reliability rails (VERIFY/TRACE/EVAL). The learner clips chips into slots: harness
 * parts (TOOL/VERIFY/TRACE/EVAL) plus senses (VOICE-IN/RAG/VOICE-OUT/AVATAR). Senses
 * will NOT enter the CORE — they only clip to edges/sockets, proving the loop is
 * modality-agnostic. Complete the minimum harness -> reveal the design spec (no code).
 *
 * Mount point: <div class="clip-the-senses"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var CHIPS = [
    { id:'tool',     label:'TOOL',      kind:'tool',     cls:'harness' },
    { id:'verify',   label:'VERIFY',    kind:'verify',   cls:'harness' },
    { id:'trace',    label:'TRACE',     kind:'trace',    cls:'harness' },
    { id:'eval',     label:'EVAL',      kind:'eval',     cls:'harness' },
    { id:'rag',      label:'RAG',       kind:'rag',      cls:'sense' },
    { id:'voicein',  label:'VOICE-IN',  kind:'voicein',  cls:'sense' },
    { id:'voiceout', label:'VOICE-OUT', kind:'voiceout', cls:'sense' },
    { id:'avatar',   label:'AVATAR',    kind:'avatar',   cls:'sense' }
  ];
  var SPEC = [
    'ใบประกาศงาน: คำถามที่เกิดซ้ำ + ข้อมูลที่มี + ต้นทุนคำตอบผิด',
    'แยก script (ไม่ใช้ LLM) ออกจากงานที่ต้องใช้ภาษา',
    'ลูปที่มี verify จากสภาพแวดล้อม',
    'เครื่องมือที่คัดมาแล้ว: คำอธิบายบอกเมื่อไรควรใช้ + error ที่แก้ตัวได้',
    'บริบทที่ถูกต้อง (ตัวตน + กติกา) — เล็กแต่ตรง',
    'memory: ของที่ต้องคงอยู่เขียนลงนอก window / แหล่งความจริง',
    'grounding + schema-first + gate การกระทำที่ย้อนไม่ได้',
    'deny-by-default allow-list + least privilege',
    'เพดานลูป (max turns + timeout) + trace ที่มี trace_id/parent/intent',
    'เลือกชนิด MCP ให้ถูก (tools/resources/prompts)',
    'แพ็กขั้นตอนเป็น Skill + กัน definitions/ผลลัพธ์ออกจาก context',
    'context เล็กสุด-สัญญาณแรงสุด (JIT + schema-first)',
    'ตัดขา lethal trifecta อย่างน้อยหนึ่งขา',
    'เลือกขั้นบันไดต่ำสุดที่ทำงานได้ (บางงานไม่ต้องใช้ LLM)',
    'ชุด eval ส่วนตัว ~50 เคส · ให้คะแนน 3 ระดับ'
  ];

  function build(el) {
    var fill = {}, used = {}, selected = null;

    el.innerHTML =
      '<div class="cs-core" data-core>' +
        '<div class="cs-slot" data-slot="input" data-accepts="voicein">INPUT<span class="sk">edge</span></div>' +
        '<div class="cs-loopbox" data-loop>LOOP</div>' +
        '<div class="cs-slot" data-slot="outA" data-accepts="voiceout,avatar">OUTPUT<span class="sk">edge</span></div>' +
        '<div class="cs-slot" data-slot="outB" data-accepts="voiceout,avatar">OUTPUT<span class="sk">edge</span></div>' +
      '</div>' +
      '<div class="cs-board">' +
        '<div class="cs-slot" data-slot="toolA" data-accepts="tool,rag">TOOL socket<span class="sk">tool</span></div>' +
        '<div class="cs-slot" data-slot="toolB" data-accepts="tool,rag">TOOL socket<span class="sk">tool</span></div>' +
        '<div class="cs-slot" data-slot="verify" data-accepts="verify">VERIFY rail<span class="sk">reliability</span></div>' +
        '<div class="cs-slot" data-slot="trace" data-accepts="trace">TRACE rail<span class="sk">reliability</span></div>' +
        '<div class="cs-slot" data-slot="eval" data-accepts="eval">EVAL rail<span class="sk">reliability</span></div>' +
      '</div>' +
      '<div class="activity-panel-label" style="margin-top:8px">ชิป (คลิกเลือก แล้วคลิกช่อง) — ลองคลิป “sense” ใส่กล่อง LOOP ดู</div>' +
      '<div class="cs-tray"></div>' +
      '<div class="cs-checklist"></div>' +
      '<div class="cs-spec"><div class="callout note" style="margin:0"><strong>🎓 สเปก harness ของคุณ (ดีไซน์ ไม่ใช่โค้ด) — checklist ครบทั้งคอร์ส</strong>' +
        '<ol style="margin:10px 0 0;padding-left:22px;font-size:13.5px"></ol></div></div>';

    var tray = el.querySelector('.cs-tray');
    var core = el.querySelector('[data-core]');
    var loopBox = el.querySelector('[data-loop]');
    var checklist = el.querySelector('.cs-checklist');
    var spec = el.querySelector('.cs-spec');
    var specOl = spec.querySelector('ol');
    SPEC.forEach(function (s) { var li = document.createElement('li'); li.textContent = s; specOl.appendChild(li); });

    function renderTray() {
      tray.innerHTML = '';
      CHIPS.forEach(function (c) {
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'cs-chip ' + c.cls + (used[c.id] ? ' used' : '') + (selected === c.id ? ' sel' : '');
        b.textContent = (c.cls === 'sense' ? '🎙️ ' : '🔧 ') + c.label;
        b.addEventListener('click', function () { if (!used[c.id]) { selected = (selected === c.id) ? null : c.id; render(); } });
        tray.appendChild(b);
      });
    }

    el.querySelectorAll('.cs-slot').forEach(function (slot) {
      slot.addEventListener('click', function () {
        if (!selected) return;
        var chip = CHIPS.find(function (c) { return c.id === selected; });
        var accepts = slot.dataset.accepts.split(',');
        if (accepts.indexOf(chip.kind) < 0) { flashSlot(slot); return; }
        // free any previous chip in this slot
        if (fill[slot.dataset.slot]) used[fill[slot.dataset.slot]] = false;
        fill[slot.dataset.slot] = chip.id; used[chip.id] = true; selected = null; render();
      });
    });
    loopBox.addEventListener('click', function () {
      if (!selected) return;
      var chip = CHIPS.find(function (c) { return c.id === selected; });
      // nothing enters the core; senses bounce loudly
      core.classList.remove('pulsebad'); void core.offsetWidth; core.classList.add('pulsebad');
      loopBox.title = chip.cls === 'sense'
        ? 'Sense คลิปที่ “ขอบ” ไม่ใช่ใน LOOP — ลอง INPUT / OUTPUT / TOOL socket'
        : 'ส่วน harness ไปที่ราง/ช่องของมัน ไม่ใช่ใน LOOP';
    });

    function flashSlot(slot) { slot.classList.add('cs-bad'); slot.style.borderColor = 'var(--red)'; setTimeout(function () { slot.style.borderColor = ''; }, 450); }

    function render() {
      renderTray();
      el.querySelectorAll('.cs-slot').forEach(function (slot) {
        var f = fill[slot.dataset.slot];
        slot.classList.toggle('armed', !!selected && slot.dataset.accepts.split(',').indexOf((CHIPS.find(function (c) { return c.id === selected; }) || {}).kind) >= 0);
        slot.classList.toggle('filled', !!f);
        var base = slot.dataset.slot.indexOf('tool') === 0 ? 'TOOL socket' :
                   slot.dataset.slot === 'input' ? 'INPUT' :
                   slot.dataset.slot.indexOf('out') === 0 ? 'OUTPUT' :
                   slot.dataset.slot.toUpperCase() + ' rail';
        slot.innerHTML = f ? (CHIPS.find(function (c) { return c.id === f; }).label) : base + '<span class="sk">' + slot.dataset.accepts + '</span>';
      });

      var hasTool = (fill.toolA && CHIPS.find(function (c) { return c.id === fill.toolA; }).kind === 'tool') ||
                    (fill.toolB && CHIPS.find(function (c) { return c.id === fill.toolB; }).kind === 'tool');
      var need = { Loop: true, Tool: hasTool, Verify: !!fill.verify, Trace: !!fill.trace, Eval: !!fill.eval };
      var senses = ['input', 'outA', 'outB', 'toolA', 'toolB'].filter(function (s) {
        var f = fill[s]; return f && CHIPS.find(function (c) { return c.id === f; }).cls === 'sense';
      }).length;
      checklist.innerHTML = Object.keys(need).map(function (k) {
        return '<div class="row ' + (need[k] ? 'done' : '') + '"><span class="bx">' + (need[k] ? '✓' : '○') + '</span>' +
          k + (k === 'Loop' ? ' (แกนกลาง — มีให้แล้ว)' : '') + '</div>';
      }).join('') +
        '<div class="row" style="margin-top:6px;color:var(--violet)"><span class="bx">+</span>Senses ที่คลิปไว้ (ไม่บังคับ): ' + senses + ' — และ <b>กล่อง LOOP ไม่เคยเปลี่ยนเลย</b></div>';

      var complete = need.Tool && need.Verify && need.Trace && need.Eval;
      spec.classList.toggle('show', complete);
    }

    render();
  }

  function init() { document.querySelectorAll('.clip-the-senses').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
