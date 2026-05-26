/* SCADA Workshop · Step 2 — Water Flow (Tank + Pump + Level Sensors)
 *
 * Markup:
 *   <div class="scada-ws-waterflow"></div>
 *
 * Process: Pump fills a water tank. Two level sensors (LOW / HIGH).
 *   - Pump ON when Start pressed → fills until LEVEL_HIGH = 1
 *   - Pump OFF when LEVEL_HIGH = 1 (auto cutoff)
 *   - Drain valve removes water at constant rate when opened
 *   - Tank has Percentage Fill animation linked to WaterLV (Integer 0-100)
 *
 * Grounded in: Vol 1 Exam 4 (Script / WATERLV) + Vol 3 (Tank Level Monitoring)
 * No deps. Offline.
 */
(function () {
  'use strict';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // Suggested point set the student should build. Validated by name+type+area.
  var REQUIRED_POINTS = [
    { name: 'Start',      type: 'Boolean', area: 'in',  hint: 'ปุ่ม Start (0.00)' },
    { name: 'Stop',       type: 'Boolean', area: 'in',  hint: 'ปุ่ม Stop (0.01)' },
    { name: 'Drain',      type: 'Boolean', area: 'in',  hint: 'ปุ่มเปิด Drain (0.02)' },
    { name: 'Pump',       type: 'Boolean', area: 'out', hint: 'Pump Output (100.00)' },
    { name: 'WaterLV',    type: 'Integer', area: 'dm',  hint: 'ระดับน้ำ % (D100)' },
    { name: 'Level_High', type: 'Boolean', area: 'mem', hint: 'Flag เต็มถัง (W0.00)' }
  ];

  function buildWaterflow(root) {
    root.innerHTML = '';
    root.classList.add('scada-ws');

    var state = {
      points: [],            // { name, type, area, addr }
      running: false,
      water: 30,             // 0..100 percent
      pump: false,
      drain: false,
      tick: null,
      fillRate: 1.2,         // % per tick
      drainRate: 0.8,
      hiSetpoint: 90,
      loSetpoint: 10
    };

    // ============================================================
    // HEADER
    // ============================================================
    var head = el('div', 'scada-ws-head');
    head.innerHTML =
      '<div class="scada-ws-step">💧 Step 2 · WATER FLOW</div>' +
      '<div class="scada-ws-title">ระบบเติมน้ำอัตโนมัติ — Tank + Pump + Level Sensors</div>' +
      '<div class="scada-ws-desc">โจทย์: สร้าง 6 Points + วาง Animation <strong>Percentage Fill</strong> บนถัง + ' +
      '<strong>Color Change</strong> บน Pump · กด Start → Pump เติมจนเต็ม (Level_High=1) → Pump ดับเอง — ' +
      'อิงตำราเล่ม 1 Exam 4 (WATERLV) + เล่ม 3 (Tank Monitoring)</div>';
    root.appendChild(head);

    // ============================================================
    // PROGRESS
    // ============================================================
    var progress = el('div', 'scada-ws-progress');
    progress.innerHTML =
      '<div class="scada-ws-prog-item" data-key="points">1. สร้าง Points ครบ 6</div>' +
      '<div class="scada-ws-prog-item" data-key="anims">2. ใส่ Animations</div>' +
      '<div class="scada-ws-prog-item" data-key="run">3. Run</div>' +
      '<div class="scada-ws-prog-item" data-key="fill">4. เติมจนเต็ม (Auto-stop)</div>';
    root.appendChild(progress);

    // ============================================================
    // BENCH — 3 columns
    // ============================================================
    var bench = el('div', 'scada-ws-bench');

    // ---------- LEFT — Point Editor -----------------------------------
    var pointPanel = el('div', 'scada-ws-panel');
    pointPanel.innerHTML =
      '<div class="scada-ws-panel-title">📍 Point Editor</div>' +
      '<div class="scada-ws-panel-sub">ต้องสร้างทั้งหมด 6 Points · ใช้ชื่อตามเอกสาร</div>' +
      '<div class="scada-ws-form">' +
      '  <label>ชื่อ</label>' +
      '  <input type="text" class="ws-input" id="ws-wf-name" placeholder="Start">' +
      '  <label>ประเภท</label>' +
      '  <select class="ws-input" id="ws-wf-type">' +
      '    <option value="">— เลือก —</option>' +
      '    <option value="Boolean">Boolean</option>' +
      '    <option value="Integer">Integer</option>' +
      '    <option value="Real">Real</option>' +
      '  </select>' +
      '  <label>Address Area</label>' +
      '  <select class="ws-input" id="ws-wf-area">' +
      '    <option value="">— เลือก —</option>' +
      '    <option value="in">CIO Input (0.xx)</option>' +
      '    <option value="out">CIO Output (100.xx)</option>' +
      '    <option value="dm">Data Memory (Dxxx)</option>' +
      '    <option value="mem">Work Bit (W0.xx)</option>' +
      '  </select>' +
      '  <button type="button" class="ws-btn-primary" id="ws-wf-add">+ Add Point</button>' +
      '</div>' +
      '<div class="scada-ws-pointlist" id="ws-wf-points"></div>' +
      '<details class="scada-ws-cheat">' +
      '  <summary>📖 รายชื่อที่ต้องสร้าง (cheat sheet)</summary>' +
      '  <ul>' +
      REQUIRED_POINTS.map(function (p) {
        return '<li><code>' + p.name + '</code> · <em>' + p.type + '</em> · ' + p.hint + '</li>';
      }).join('') +
      '  </ul>' +
      '</details>';

    // ---------- MIDDLE — Mimic Page -----------------------------------
    var mimicPanel = el('div', 'scada-ws-panel scada-ws-mimic-wrap');
    mimicPanel.innerHTML =
      '<div class="scada-ws-panel-title">🖼️ Mimic Page — "Tank01"</div>' +
      '<div class="scada-ws-panel-sub">คลิก Pump หรือ Tank → ใส่ Animation</div>' +
      '<div class="scada-ws-mimic scada-ws-mimic-tank">' +
      '  <svg viewBox="0 0 380 260" class="scada-ws-tank-svg">' +
           // Pipe in
      '    <rect x="20" y="120" width="80" height="14" fill="#2f3a5e" />' +
           // Pump symbol
      '    <g id="ws-wf-pump" class="ws-tank-pump" transform="translate(60,127)">' +
      '      <circle cx="0" cy="0" r="22" fill="#1c2342" stroke="#4a5778" stroke-width="2"/>' +
      '      <path d="M-10,-10 L10,0 L-10,10 Z" fill="#9aa3b8"/>' +
      '      <text y="42" text-anchor="middle" fill="#9aa3b8" font-size="11" font-family="JetBrains Mono">PUMP</text>' +
      '    </g>' +
           // Inflow pipe to tank
      '    <rect x="95" y="120" width="55" height="14" fill="#2f3a5e" />' +
           // Tank body
      '    <rect x="155" y="40" width="150" height="180" fill="none" stroke="#4a5778" stroke-width="3" rx="6"/>' +
           // Water fill (clip mask via JS-controlled height)
      '    <clipPath id="ws-wf-clip"><rect x="155" y="40" width="150" height="180" rx="6"/></clipPath>' +
      '    <rect id="ws-wf-water" x="155" y="40" width="150" height="180" ' +
                'fill="url(#ws-wf-water-grad)" clip-path="url(#ws-wf-clip)" class="ws-tank-water"/>' +
      '    <defs>' +
      '      <linearGradient id="ws-wf-water-grad" x1="0" y1="0" x2="0" y2="1">' +
      '        <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.85"/>' +
      '        <stop offset="100%" stop-color="#0ea5a4" stop-opacity="0.95"/>' +
      '      </linearGradient>' +
      '    </defs>' +
           // Level sensors (markers)
      '    <g class="ws-tank-sensor" id="ws-wf-hi" transform="translate(305,58)">' +
      '      <circle cx="0" cy="0" r="6" fill="#1c2342" stroke="#9aa3b8" stroke-width="2"/>' +
      '      <text x="10" y="4" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">HIGH 90%</text>' +
      '    </g>' +
      '    <g class="ws-tank-sensor" id="ws-wf-lo" transform="translate(305,202)">' +
      '      <circle cx="0" cy="0" r="6" fill="#1c2342" stroke="#9aa3b8" stroke-width="2"/>' +
      '      <text x="10" y="4" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">LOW 10%</text>' +
      '    </g>' +
           // Drain pipe
      '    <rect x="220" y="220" width="14" height="22" fill="#2f3a5e" />' +
      '    <g id="ws-wf-drain" class="ws-tank-drain" transform="translate(227,250)">' +
      '      <rect x="-14" y="0" width="28" height="8" fill="#4a5778" rx="2"/>' +
      '      <text y="22" text-anchor="middle" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">DRAIN</text>' +
      '    </g>' +
           // Tank label + numeric
      '    <text x="230" y="30" text-anchor="middle" fill="#e9ecf5" font-size="13" font-weight="600">TANK01</text>' +
      '    <text id="ws-wf-readout" x="230" y="135" text-anchor="middle" fill="#fff" font-size="22" font-weight="700" font-family="JetBrains Mono">30%</text>' +
      '  </svg>' +
      '</div>' +
      '<div class="scada-ws-anim-row">' +
      '  <div class="scada-ws-anim-title">🎬 ใส่ Animation:</div>' +
      '  <button type="button" class="ws-chip" id="ws-wf-anim-fill">Tank: % Fill ← WaterLV</button>' +
      '  <button type="button" class="ws-chip" id="ws-wf-anim-color">Pump: Color ← Pump</button>' +
      '</div>' +
      '<div class="scada-ws-anim-bind" id="ws-wf-bind">' +
      '  <span class="scada-ws-anim-bind-empty">— ใส่ทั้ง 2 animations —</span>' +
      '</div>';

    // ---------- RIGHT — Operator HMI -----------------------------------
    var runtimePanel = el('div', 'scada-ws-panel');
    runtimePanel.innerHTML =
      '<div class="scada-ws-panel-title">▶️ Runtime · Operator HMI</div>' +
      '<button type="button" class="ws-btn-run" id="ws-wf-run">▶ Build &amp; Run</button>' +
      '<div class="scada-ws-runtime-state" id="ws-wf-rt-state">⏸ Editor Mode</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-runtime-ctrl">' +
      '  <button type="button" class="ws-btn-toggle ok" id="ws-wf-start" disabled>▶ Start</button>' +
      '  <button type="button" class="ws-btn-toggle danger" id="ws-wf-stop" disabled>■ Stop</button>' +
      '  <button type="button" class="ws-btn-toggle" id="ws-wf-drainbtn" disabled>💧 Drain</button>' +
      '</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-runtime-watch">' +
      '  <div class="scada-ws-watch-row"><span>WaterLV</span><span class="ws-bit" id="ws-wf-w-lv">—</span></div>' +
      '  <div class="scada-ws-watch-row"><span>Pump</span><span class="ws-bit" id="ws-wf-w-pump">—</span></div>' +
      '  <div class="scada-ws-watch-row"><span>Level_High</span><span class="ws-bit" id="ws-wf-w-hi">—</span></div>' +
      '</div>' +
      '<div class="scada-ws-script">' +
      '  <div class="scada-ws-script-title">📜 Page_OnTick (VBScript)</div>' +
      '  <pre><code>If Pump.Value = 1 Then\n  WaterLV.Value = WaterLV.Value + 1\n  If WaterLV.Value &gt;= 90 Then\n    Pump.Value = 0\n    Level_High.Value = 1\n  End If\nEnd If</code></pre>' +
      '</div>';

    bench.appendChild(pointPanel);
    bench.appendChild(mimicPanel);
    bench.appendChild(runtimePanel);
    root.appendChild(bench);

    // ============================================================
    // HINT BAR
    // ============================================================
    var hint = el('div', 'scada-ws-hint', '👉 เริ่มจากสร้าง <strong>Points ทั้ง 6</strong> ตาม cheat sheet ทางซ้าย');
    root.appendChild(hint);

    // ============================================================
    // WIRING
    // ============================================================
    var nameI = pointPanel.querySelector('#ws-wf-name');
    var typeI = pointPanel.querySelector('#ws-wf-type');
    var areaI = pointPanel.querySelector('#ws-wf-area');
    var addBtn = pointPanel.querySelector('#ws-wf-add');
    var listEl = pointPanel.querySelector('#ws-wf-points');
    var animFill = mimicPanel.querySelector('#ws-wf-anim-fill');
    var animColor = mimicPanel.querySelector('#ws-wf-anim-color');
    var bindEl = mimicPanel.querySelector('#ws-wf-bind');
    var waterRect = mimicPanel.querySelector('#ws-wf-water');
    var readout = mimicPanel.querySelector('#ws-wf-readout');
    var pumpSvg = mimicPanel.querySelector('#ws-wf-pump');
    var hiMark = mimicPanel.querySelector('#ws-wf-hi circle');
    var loMark = mimicPanel.querySelector('#ws-wf-lo circle');
    var drainSvg = mimicPanel.querySelector('#ws-wf-drain rect');
    var runBtn = runtimePanel.querySelector('#ws-wf-run');
    var rtState = runtimePanel.querySelector('#ws-wf-rt-state');
    var startBtn = runtimePanel.querySelector('#ws-wf-start');
    var stopBtn  = runtimePanel.querySelector('#ws-wf-stop');
    var drainBtn = runtimePanel.querySelector('#ws-wf-drainbtn');
    var wLv = runtimePanel.querySelector('#ws-wf-w-lv');
    var wPump = runtimePanel.querySelector('#ws-wf-w-pump');
    var wHi = runtimePanel.querySelector('#ws-wf-w-hi');

    var animations = { fill: false, color: false };
    var levelHigh = 0;

    function setHint(html, cls) {
      hint.className = 'scada-ws-hint' + (cls ? ' ' + cls : '');
      hint.innerHTML = html;
    }
    function setProg(key, done) {
      var node = progress.querySelector('[data-key="' + key + '"]');
      if (node) node.classList.toggle('done', !!done);
    }

    function renderPoints() {
      listEl.innerHTML = '';
      if (!state.points.length) {
        listEl.appendChild(el('div', 'scada-ws-empty', 'ยังไม่มี Point — ดู cheat sheet ด้านล่าง'));
        return;
      }
      state.points.forEach(function (p) {
        var typeCls = p.type === 'Boolean' ? 'cyan' : p.type === 'Integer' ? 'violet' : 'accent';
        var row = el('div', 'scada-ws-pointrow ' + typeCls);
        row.innerHTML =
          '<div class="ws-pr-name">' + p.name + '</div>' +
          '<div class="ws-pr-meta">' + p.type + ' · ' + areaName(p.area) + '</div>';
        listEl.appendChild(row);
      });
    }
    function areaName(a) {
      return a === 'in' ? 'CIO Input' : a === 'out' ? 'CIO Output' : a === 'dm' ? 'DM Word' : 'Work Bit';
    }

    function renderBind() {
      bindEl.innerHTML = '';
      if (!animations.fill && !animations.color) {
        bindEl.appendChild(el('span', 'scada-ws-anim-bind-empty', '— ใส่ทั้ง 2 animations —'));
        return;
      }
      var html = '<div class="scada-ws-anim-card ws-ok">';
      if (animations.fill) {
        html += '<div class="ws-ab-row"><span>Tank · Percentage Fill</span><code>WaterLV.Value (0–100)</code></div>';
      }
      if (animations.color) {
        html += '<div class="ws-ab-row"><span>Pump · Color Change</span><code>Pump.Value: 0=gray, 1=green</code></div>';
      }
      html += '</div>';
      bindEl.innerHTML = html;
    }

    function checkPointSet() {
      // need all 6 required, by name+type+area
      var ok = REQUIRED_POINTS.every(function (req) {
        return state.points.some(function (p) {
          return p.name === req.name && p.type === req.type && p.area === req.area;
        });
      });
      setProg('points', ok);
      return ok;
    }
    function checkAnims() {
      var ok = animations.fill && animations.color;
      setProg('anims', ok);
      return ok;
    }

    function refreshTank() {
      var lv = Math.max(0, Math.min(100, state.water));
      readout.textContent = Math.round(lv) + '%';
      if (state.running && animations.fill) {
        // tank rect y=40 h=180. Fill from bottom: top = 40 + 180*(1-lv/100), height = 180*lv/100
        var fillH = 180 * (lv / 100);
        var topY = 40 + (180 - fillH);
        waterRect.setAttribute('y', topY);
        waterRect.setAttribute('height', fillH);
        waterRect.style.opacity = 0.95;
      } else {
        waterRect.setAttribute('y', 40);
        waterRect.setAttribute('height', 180);
        waterRect.style.opacity = 0.18;
      }
      // Pump color animation (if linked)
      if (state.running && animations.color && state.pump) {
        pumpSvg.classList.add('on');
      } else {
        pumpSvg.classList.remove('on');
      }
      // Drain visual
      if (state.running && state.drain) drainSvg.setAttribute('fill', '#ff7a18');
      else drainSvg.setAttribute('fill', '#4a5778');
      // Sensor markers light up when active
      if (state.running) {
        hiMark.setAttribute('fill', lv >= state.hiSetpoint ? '#34d399' : '#1c2342');
        loMark.setAttribute('fill', lv <= state.loSetpoint ? '#34d399' : '#1c2342');
      } else {
        hiMark.setAttribute('fill', '#1c2342');
        loMark.setAttribute('fill', '#1c2342');
      }
    }
    function refreshWatch() {
      if (!state.running) {
        wLv.textContent = '(stopped)'; wLv.className = 'ws-bit';
        wPump.textContent = '—'; wPump.className = 'ws-bit';
        wHi.textContent = '—'; wHi.className = 'ws-bit';
        return;
      }
      wLv.textContent = Math.round(state.water); wLv.className = 'ws-bit num';
      wPump.textContent = state.pump ? 1 : 0; wPump.className = 'ws-bit' + (state.pump ? ' on' : ' off');
      wHi.textContent = levelHigh; wHi.className = 'ws-bit' + (levelHigh ? ' on' : ' off');
    }

    // ---- Add point ---------------------------------------------------
    addBtn.addEventListener('click', function () {
      var name = (nameI.value || '').trim();
      var type = typeI.value;
      var area = areaI.value;
      if (!name || !type || !area) {
        setHint('⚠️ กรอกให้ครบ — ชื่อ + ประเภท + Address Area', 'warn');
        return;
      }
      // dedupe by name
      if (state.points.some(function (p) { return p.name === name; })) {
        setHint('⚠️ มี Point ชื่อ <code>' + name + '</code> อยู่แล้ว', 'warn');
        return;
      }
      // Validate it's in the required set (so students hit the spec)
      var req = REQUIRED_POINTS.find(function (r) { return r.name === name; });
      if (!req) {
        setHint('⚠️ ชื่อ <code>' + name + '</code> ไม่อยู่ใน spec — ดู cheat sheet (ชื่อต้องตรง)', 'warn');
        return;
      }
      if (req.type !== type) {
        setHint('⚠️ <code>' + name + '</code> ต้องเป็น <strong>' + req.type + '</strong> ไม่ใช่ ' + type, 'warn');
        return;
      }
      if (req.area !== area) {
        setHint('⚠️ <code>' + name + '</code> ต้องลงใน <strong>' + areaName(req.area) + '</strong>', 'warn');
        return;
      }
      state.points.push({ name: name, type: type, area: area });
      renderPoints();
      nameI.value = ''; typeI.value = ''; areaI.value = '';
      var ok = checkPointSet();
      if (ok) setHint('✓ ครบ 6 Points แล้ว — ต่อไป: ใส่ Animations 2 ตัวบน Mimic', 'ok');
      else setHint('✓ เพิ่ม <code>' + name + '</code> แล้ว (' + state.points.length + '/6)');
    });

    animFill.addEventListener('click', function () {
      if (!state.points.some(function (p) { return p.name === 'WaterLV'; })) {
        setHint('⚠️ ต้องมี Point <code>WaterLV</code> ก่อนใส่ Percentage Fill', 'warn'); return;
      }
      animations.fill = true; animFill.classList.add('active'); renderBind(); checkAnims();
      setHint('✓ Tank · Percentage Fill ← WaterLV — ใส่ Color บน Pump อีกตัว');
    });
    animColor.addEventListener('click', function () {
      if (!state.points.some(function (p) { return p.name === 'Pump'; })) {
        setHint('⚠️ ต้องมี Point <code>Pump</code> ก่อนใส่ Color animation', 'warn'); return;
      }
      animations.color = true; animColor.classList.add('active'); renderBind(); checkAnims();
      if (checkAnims()) setHint('✓ ครบทั้ง 2 Animations — กด ▶ Build &amp; Run', 'ok');
    });

    // ---- Run/Stop ----------------------------------------------------
    runBtn.addEventListener('click', function () {
      if (!checkPointSet()) { setHint('⚠️ ยังไม่ครบ 6 Points', 'warn'); return; }
      if (!checkAnims())    { setHint('⚠️ ต้องใส่ Animations ก่อนรัน', 'warn'); return; }
      state.running = !state.running;
      if (state.running) {
        runBtn.textContent = '⏹ Stop'; runBtn.classList.add('running');
        rtState.textContent = '▶ Running…'; rtState.classList.add('on');
        startBtn.disabled = stopBtn.disabled = drainBtn.disabled = false;
        setProg('run', true);
        startTicker();
        setHint('🟢 รันแล้ว — กด <strong>Start</strong> แล้วดูถังเติม จนถึง LEVEL_HIGH = ดับเอง');
      } else {
        runBtn.textContent = '▶ Build & Run'; runBtn.classList.remove('running');
        rtState.textContent = '⏸ Editor Mode'; rtState.classList.remove('on');
        startBtn.disabled = stopBtn.disabled = drainBtn.disabled = true;
        state.pump = false; state.drain = false; levelHigh = 0;
        stopTicker();
      }
      refreshTank(); refreshWatch();
    });

    startBtn.addEventListener('click', function () {
      if (!state.running) return;
      state.pump = true; levelHigh = 0;
      refreshTank(); refreshWatch();
    });
    stopBtn.addEventListener('click', function () {
      state.pump = false;
      refreshTank(); refreshWatch();
    });
    drainBtn.addEventListener('click', function () {
      state.drain = !state.drain;
      drainBtn.classList.toggle('active', state.drain);
      refreshTank();
    });

    function startTicker() {
      stopTicker();
      state.tick = setInterval(function () {
        var prev = state.water;
        if (state.pump) state.water += state.fillRate;
        if (state.drain) state.water -= state.drainRate;
        state.water = Math.max(0, Math.min(100, state.water));
        // Logic
        if (state.water >= state.hiSetpoint && state.pump) {
          state.pump = false;
          levelHigh = 1;
          setProg('fill', true);
          setHint('🎉 <strong>เต็มถัง!</strong> Pump auto-stopped (Level_High=1) — concept ของ Closed-loop Level Control เข้าใจครบ — ไป Step 3 ได้!', 'ok');
        }
        if (state.water < state.hiSetpoint) levelHigh = 0;
        if (prev !== state.water || state.pump || state.drain) {
          refreshTank(); refreshWatch();
        }
      }, 120);
    }
    function stopTicker() {
      if (state.tick) { clearInterval(state.tick); state.tick = null; }
    }

    renderPoints();
    refreshTank();
    refreshWatch();
  }

  function init() {
    var nodes = document.querySelectorAll('.scada-ws-waterflow');
    for (var i = 0; i < nodes.length; i++) buildWaterflow(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
