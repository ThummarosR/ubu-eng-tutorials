/* PLC Scan Cycle Animation
 *
 * Markup:
 *   <div class="scan-cycle" data-syntax="mit"></div>
 *   <div class="scan-cycle" data-syntax="omron"></div>
 *
 * Visualizes the 4 PLC scan phases:
 *   1. Self-diagnostics
 *   2. Read inputs (X → input image)
 *   3. Execute program (logic)
 *   4. Write outputs (output image → Y)
 *
 * The big teaching moment: students click X0 mid-cycle and observe that Y0
 * does NOT change until the next "Read inputs" phase. This is the classic
 * "why doesn't my switch work" lightbulb moment.
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  var SYNTAX = {
    mit:   { inLbl: 'X0', outLbl: 'Y0', inFull: 'X0 (Input)', outFull: 'Y0 (Output)', logic: '┤ X0 ├──( Y0 )' },
    omron: { inLbl: '0.00', outLbl: '100.00', inFull: '0.00 (Input)', outFull: '100.00 (Output)', logic: '┤ 0.00 ├──( 100.00 )' }
  };

  // Phase definitions
  var PHASES = [
    { id: 'diag', name: 'Self-diagnostics', desc: 'CPU ตรวจสอบ memory, I/O bus, แบตเตอรี่' },
    { id: 'read', name: 'Read Inputs',      desc: 'อ่านขั้ว Input จริง → เก็บใน Input Image Register' },
    { id: 'exec', name: 'Execute Program',  desc: 'รัน Ladder ทีละ Rung บนค่าใน Input Image · ผลลัพธ์ลง Output Image' },
    { id: 'out',  name: 'Write Outputs',    desc: 'เอา Output Image → ขับ Relay/Transistor จริงออกขั้ว Y' }
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function buildScanCycle(root) {
    root.innerHTML = '';
    root.classList.add('sc');
    var syntax = SYNTAX[root.getAttribute('data-syntax') || 'mit'] || SYNTAX.mit;

    // ---------- State ----------------------------------------------------
    var state = {
      physicalIn: 0,   // The actual switch state (what the student clicks)
      inputImage: 0,   // What the CPU "sees" — synced at READ phase
      outputImage: 0,  // Computed by EXECUTE
      physicalOut: 0,  // Actual lamp state — synced at WRITE phase
      currentPhase: 0, // index into PHASES
      cycleCount: 0,
      running: true,
      speedMs: 800     // ms per phase
    };

    // ---------- Header ---------------------------------------------------
    var head = el('div', 'sc-head');
    head.innerHTML =
      '<div class="sc-title">⚙️ PLC Scan Cycle — ทำไม Input เปลี่ยนไม่ทันที</div>' +
      '<div class="sc-desc">PLC ไม่ได้ "อ่าน Input → คิด → ออก Output" แบบ event-driven ' +
      'แต่วน <strong>Scan Cycle</strong> ซ้ำ ๆ — ลองกดสวิตช์ <strong>' + syntax.inLbl + '</strong> ' +
      'ในจังหวะต่าง ๆ ดูว่าเมื่อไหร่หลอด <strong>' + syntax.outLbl + '</strong> ติด</div>';
    root.appendChild(head);

    // ---------- Phase strip ---------------------------------------------
    var phaseStrip = el('div', 'sc-phases');
    var phaseEls = [];
    PHASES.forEach(function (p, i) {
      var box = el('div', 'sc-phase');
      box.innerHTML =
        '<div class="sc-phase-num">' + (i + 1) + '</div>' +
        '<div class="sc-phase-name">' + p.name + '</div>' +
        '<div class="sc-phase-desc">' + p.desc + '</div>';
      phaseStrip.appendChild(box);
      phaseEls.push(box);
    });
    root.appendChild(phaseStrip);

    // ---------- Register / signal view ----------------------------------
    var regGrid = el('div', 'sc-grid');
    regGrid.innerHTML =
      '<div class="sc-col sc-col-physin">' +
        '<div class="sc-col-label">ขั้ว Input จริง</div>' +
        '<button type="button" class="sc-switch" id="sc-switch">' +
          '<div class="sc-switch-lbl">' + syntax.inFull + '</div>' +
          '<div class="sc-switch-state">OFF</div>' +
          '<div class="sc-switch-hint">คลิกเพื่อกด/ปล่อย</div>' +
        '</button>' +
      '</div>' +
      '<div class="sc-arrow sc-arrow-1">→</div>' +
      '<div class="sc-col sc-col-img">' +
        '<div class="sc-col-label">Input Image</div>' +
        '<div class="sc-reg" id="sc-in-img">0</div>' +
        '<div class="sc-col-label" style="margin-top:14px">Output Image</div>' +
        '<div class="sc-reg" id="sc-out-img">0</div>' +
      '</div>' +
      '<div class="sc-arrow sc-arrow-2">→</div>' +
      '<div class="sc-col sc-col-prog">' +
        '<div class="sc-col-label">Program</div>' +
        '<div class="sc-prog"><code>' + syntax.logic + '</code></div>' +
        '<div class="sc-prog-note">รัน rung เดียว: ถ้า Input=1 → Output=1</div>' +
      '</div>' +
      '<div class="sc-arrow sc-arrow-3">→</div>' +
      '<div class="sc-col sc-col-physout">' +
        '<div class="sc-col-label">ขั้ว Output จริง</div>' +
        '<div class="sc-lamp" id="sc-lamp">' +
          '<div class="sc-lamp-bulb"></div>' +
          '<div class="sc-lamp-lbl">' + syntax.outFull + '</div>' +
          '<div class="sc-lamp-state">OFF</div>' +
        '</div>' +
      '</div>';
    root.appendChild(regGrid);

    var switchBtn = regGrid.querySelector('#sc-switch');
    var inImgEl = regGrid.querySelector('#sc-in-img');
    var outImgEl = regGrid.querySelector('#sc-out-img');
    var lampEl = regGrid.querySelector('#sc-lamp');

    switchBtn.addEventListener('click', function () {
      state.physicalIn = state.physicalIn ? 0 : 1;
      flash(switchBtn);
      render();
    });

    function flash(el) {
      el.classList.remove('sc-flash');
      void el.offsetWidth;
      el.classList.add('sc-flash');
    }

    // ---------- Controls -------------------------------------------------
    var ctrl = el('div', 'sc-ctrl');
    ctrl.innerHTML =
      '<button type="button" class="sc-btn" id="sc-toggle">⏸️ Pause</button>' +
      '<button type="button" class="sc-btn" id="sc-step">⏭️ Step</button>' +
      '<div class="sc-speed-wrap">' +
        '<label class="sc-speed-lbl">ความเร็ว:</label>' +
        '<input type="range" class="sc-speed" id="sc-speed" min="200" max="2000" step="100" value="800">' +
        '<span class="sc-speed-val" id="sc-speed-val">800 ms/phase</span>' +
      '</div>' +
      '<div class="sc-cycle-count">Cycles: <span id="sc-cycle-n">0</span></div>';
    root.appendChild(ctrl);

    var toggleBtn = ctrl.querySelector('#sc-toggle');
    var stepBtn = ctrl.querySelector('#sc-step');
    var speedSlider = ctrl.querySelector('#sc-speed');
    var speedVal = ctrl.querySelector('#sc-speed-val');
    var cycleN = ctrl.querySelector('#sc-cycle-n');

    toggleBtn.addEventListener('click', function () {
      state.running = !state.running;
      toggleBtn.textContent = state.running ? '⏸️ Pause' : '▶️ Play';
      if (state.running) loop();
    });
    stepBtn.addEventListener('click', function () {
      if (state.running) {
        state.running = false;
        toggleBtn.textContent = '▶️ Play';
      }
      advance();
    });
    speedSlider.addEventListener('input', function () {
      state.speedMs = parseInt(speedSlider.value, 10);
      speedVal.textContent = state.speedMs + ' ms/phase';
    });

    // ---------- Insight panel -------------------------------------------
    var insight = el('div', 'sc-insight');
    insight.innerHTML =
      '<div class="sc-insight-title">💡 จุดที่ต้องเข้าใจ</div>' +
      '<ul>' +
        '<li>ตอนเฟส <strong>"Execute Program"</strong> PLC ไม่ได้อ่าน Input ใหม่ — มันใช้ค่า <em>Input Image</em> ที่ snapshot ไว้แล้ว</li>' +
        '<li>ถ้ากดสวิตช์ใน <em>เสี้ยววินาที</em> ระหว่างเฟส Execute → Output จะยังไม่เห็น เพราะ Image ยังเป็นค่าเก่า</li>' +
        '<li>กว่าจะเห็นผลต้องรอ <strong>1 scan cycle</strong> (ปกติ ~1–10 ms) — ดังนั้นถ้าสัญญาณสั้นกว่า scan time PLC อาจ <em>มองข้าม</em>!</li>' +
      '</ul>';
    root.appendChild(insight);

    // ---------- Render ---------------------------------------------------
    function render() {
      // Phase highlighting
      phaseEls.forEach(function (p, i) {
        p.classList.toggle('sc-phase-active', i === state.currentPhase);
        p.classList.toggle('sc-phase-done', i < state.currentPhase);
      });
      // Switch + lamp
      switchBtn.classList.toggle('sc-switch-on', !!state.physicalIn);
      switchBtn.querySelector('.sc-switch-state').textContent = state.physicalIn ? 'ON' : 'OFF';
      lampEl.classList.toggle('sc-lamp-on', !!state.physicalOut);
      lampEl.querySelector('.sc-lamp-state').textContent = state.physicalOut ? 'ON' : 'OFF';
      // Registers
      inImgEl.textContent = state.inputImage;
      outImgEl.textContent = state.outputImage;
      inImgEl.classList.toggle('sc-reg-on', !!state.inputImage);
      outImgEl.classList.toggle('sc-reg-on', !!state.outputImage);
      cycleN.textContent = state.cycleCount;
    }

    function advance() {
      var phase = PHASES[state.currentPhase].id;
      // Action at END of each phase
      if (phase === 'read') {
        // Snapshot physical input → input image
        if (state.inputImage !== state.physicalIn) flash(inImgEl);
        state.inputImage = state.physicalIn;
      } else if (phase === 'exec') {
        // Run the single rung: Y = X
        var newOut = state.inputImage ? 1 : 0;
        if (state.outputImage !== newOut) flash(outImgEl);
        state.outputImage = newOut;
      } else if (phase === 'out') {
        // Drive physical output from output image
        if (state.physicalOut !== state.outputImage) flash(lampEl);
        state.physicalOut = state.outputImage;
      }
      // Advance phase pointer
      state.currentPhase = (state.currentPhase + 1) % PHASES.length;
      if (state.currentPhase === 0) state.cycleCount++;
      render();
    }

    function loop() {
      if (!state.running) return;
      advance();
      setTimeout(loop, state.speedMs);
    }

    render();
    loop();
  }

  function init() {
    document.querySelectorAll('.scan-cycle').forEach(buildScanCycle);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
