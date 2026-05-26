/* SCADA Workshop · Step 3 — Chocolate Factory (capstone)
 *
 * Markup:
 *   <div class="scada-ws-chocolate"></div>
 *
 * Process (matches Vol 2 Exam 5 — การประยุกต์ใช้โปรแกรม SCADA ในงานอุตสาหกรรม):
 *   Milk Tank ──PumpMilk──┐
 *                         ├──> Mixing Tank ──Outlet──> Product
 *   Cocoa Tank ─PumpCho──┘
 *
 *   Recipes (Mix ratios):
 *     - Classic Milk Choc:  50% milk + 20% cocoa
 *     - Dark Choc:          30% milk + 40% cocoa
 *     - White Choc:         70% milk + 10% cocoa
 *
 *   Points (per book):
 *     Q:100.00 PumpMilk      Q:100.01 PumpCho      Q:100.02 Outlet
 *     I:0.00 Start_PumpMilk  I:0.01 Start_PumpCho  I:0.02 Start_Outlet
 *     I:0.03 Stop_PumpMilk   I:0.04 Stop_PumpCho   I:0.05 Stop_Outlet
 *     D100 MilkPct           D102 CocoaPct         D104 OutPct
 *
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

  var RECIPES = [
    { id: 'milk',  name: '🥛 Classic Milk Choc', milkTarget: 50, cocoaTarget: 20, color: '#c8a574' },
    { id: 'dark',  name: '🌑 Dark Chocolate',     milkTarget: 30, cocoaTarget: 40, color: '#5a3a1a' },
    { id: 'white', name: '🤍 White Chocolate',    milkTarget: 70, cocoaTarget: 10, color: '#e8d8b5' }
  ];

  function buildChocolate(root) {
    root.innerHTML = '';
    root.classList.add('scada-ws');

    var state = {
      running: false,
      pumpMilk: false,
      pumpCho:  false,
      outlet:   false,
      milk: 0,        // 0..100 (level inside mixing tank attributable to milk)
      cocoa: 0,       // 0..100
      bottle: 0,      // 0..100 (filled product bottle)
      bottles: 0,
      recipe: null,
      tick: null,
      mixerSpin: 0,
      alarms: []
    };

    // ============================================================
    // HEADER
    // ============================================================
    var head = el('div', 'scada-ws-head');
    head.innerHTML =
      '<div class="scada-ws-step">🍫 Step 3 · CHOCOLATE FACTORY</div>' +
      '<div class="scada-ws-title">โรงงานช็อกโกแลตจำลอง — Recipe-driven Batch Control</div>' +
      '<div class="scada-ws-desc">โจทย์ Capstone: รวมทุกอย่างที่เรียนมา — Multi-pump, Mixing tank, Outlet valve, Recipe selection, ' +
      'Alarm log · อิงตำราเล่ม 2 Exam 5 (Milk + Chocolate blending) · ' +
      'เลือก Recipe → กด Auto Run → ระบบรู้เองว่าต้องเปิด Pump ตัวไหน นานแค่ไหน → Outlet ดันลงขวด</div>';
    root.appendChild(head);

    // ============================================================
    // 2-COLUMN LAYOUT: MIMIC (large) | OPERATOR (compact)
    // ============================================================
    var bench = el('div', 'scada-ws-bench scada-ws-bench-2col');

    // ---------- MIMIC ----------------------------------------------------
    var mimic = el('div', 'scada-ws-panel scada-ws-mimic-wrap');
    mimic.innerHTML =
      '<div class="scada-ws-panel-title">🖼️ Mimic Page — "Factory01"</div>' +
      '<div class="scada-ws-panel-sub">Plant overview — ดูถัง Milk/Cocoa เติมลง Mixing Tank แล้ว Outlet ลงขวด</div>' +
      '<div class="scada-ws-mimic scada-ws-mimic-factory">' +
      '  <svg viewBox="0 0 640 380" class="scada-ws-factory-svg">' +
           // ====== MILK TANK (left) ======
      '    <g transform="translate(40,40)">' +
      '      <rect x="0" y="0" width="110" height="120" fill="none" stroke="#4a5778" stroke-width="2.5" rx="6"/>' +
      '      <clipPath id="ws-ch-milk-clip"><rect x="0" y="0" width="110" height="120" rx="6"/></clipPath>' +
      '      <rect id="ws-ch-milk-fill" x="0" y="0" width="110" height="120" fill="#f5f5f0" opacity="0.85" clip-path="url(#ws-ch-milk-clip)"/>' +
      '      <text x="55" y="-8" text-anchor="middle" fill="#e9ecf5" font-size="12" font-weight="600">🥛 MILK</text>' +
      '      <text x="55" y="140" text-anchor="middle" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">Source</text>' +
      '    </g>' +
           // Milk pipe
      '    <path d="M150,100 L200,100 L200,180" stroke="#2f3a5e" stroke-width="10" fill="none"/>' +
      '    <path id="ws-ch-milk-flow" d="M150,100 L200,100 L200,180" stroke="#f5f5f0" stroke-width="4" fill="none" stroke-dasharray="6 6" opacity="0"/>' +
           // Milk pump
      '    <g id="ws-ch-milk-pump" transform="translate(170,100)">' +
      '      <circle r="14" fill="#1c2342" stroke="#4a5778" stroke-width="2"/>' +
      '      <path d="M-6,-6 L6,0 L-6,6 Z" fill="#9aa3b8"/>' +
      '      <text y="-22" text-anchor="middle" fill="#9aa3b8" font-size="9" font-family="JetBrains Mono">PumpMilk</text>' +
      '    </g>' +

           // ====== COCOA TANK (right) ======
      '    <g transform="translate(490,40)">' +
      '      <rect x="0" y="0" width="110" height="120" fill="none" stroke="#4a5778" stroke-width="2.5" rx="6"/>' +
      '      <clipPath id="ws-ch-coc-clip"><rect x="0" y="0" width="110" height="120" rx="6"/></clipPath>' +
      '      <rect id="ws-ch-coc-fill" x="0" y="0" width="110" height="120" fill="#6b3410" opacity="0.85" clip-path="url(#ws-ch-coc-clip)"/>' +
      '      <text x="55" y="-8" text-anchor="middle" fill="#e9ecf5" font-size="12" font-weight="600">🍫 COCOA</text>' +
      '      <text x="55" y="140" text-anchor="middle" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">Source</text>' +
      '    </g>' +
           // Cocoa pipe
      '    <path d="M490,100 L440,100 L440,180" stroke="#2f3a5e" stroke-width="10" fill="none"/>' +
      '    <path id="ws-ch-coc-flow" d="M490,100 L440,100 L440,180" stroke="#6b3410" stroke-width="4" fill="none" stroke-dasharray="6 6" opacity="0"/>' +
           // Cocoa pump
      '    <g id="ws-ch-coc-pump" transform="translate(470,100)">' +
      '      <circle r="14" fill="#1c2342" stroke="#4a5778" stroke-width="2"/>' +
      '      <path d="M6,-6 L-6,0 L6,6 Z" fill="#9aa3b8"/>' +
      '      <text y="-22" text-anchor="middle" fill="#9aa3b8" font-size="9" font-family="JetBrains Mono">PumpCho</text>' +
      '    </g>' +

           // ====== MIXING TANK (center) ======
      '    <g transform="translate(255,180)">' +
      '      <rect x="0" y="0" width="130" height="130" fill="none" stroke="#ff7a18" stroke-width="3" rx="8"/>' +
      '      <clipPath id="ws-ch-mix-clip"><rect x="0" y="0" width="130" height="130" rx="8"/></clipPath>' +
      '      <rect id="ws-ch-mix-fill" x="0" y="130" width="130" height="0" fill="#8b5a2b" opacity="0.95" clip-path="url(#ws-ch-mix-clip)"/>' +
      '      <text x="65" y="-8" text-anchor="middle" fill="#ff7a18" font-size="13" font-weight="700">MIXING</text>' +
             // Mixer impeller (rotates)
      '      <g id="ws-ch-mixer" transform="translate(65,65)">' +
      '        <circle r="3" fill="#9aa3b8"/>' +
      '        <rect x="-22" y="-2.5" width="44" height="5" fill="#9aa3b8" rx="1.5"/>' +
      '        <rect x="-2.5" y="-22" width="5" height="44" fill="#9aa3b8" rx="1.5"/>' +
      '      </g>' +
      '      <text id="ws-ch-mix-readout" x="65" y="155" text-anchor="middle" fill="#fff" font-size="12" font-family="JetBrains Mono">0%</text>' +
      '    </g>' +
           // Outlet pipe to bottle
      '    <path d="M320,310 L320,340" stroke="#2f3a5e" stroke-width="10" fill="none"/>' +
      '    <path id="ws-ch-out-flow" d="M320,310 L320,340" stroke="#8b5a2b" stroke-width="4" fill="none" stroke-dasharray="6 6" opacity="0"/>' +
           // Outlet valve
      '    <g id="ws-ch-outlet" transform="translate(320,325)">' +
      '      <rect x="-14" y="-7" width="28" height="14" fill="#1c2342" stroke="#4a5778" stroke-width="2" rx="2"/>' +
      '      <text x="22" y="3" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">Outlet</text>' +
      '    </g>' +
           // Bottle (under outlet)
      '    <g transform="translate(295,340)">' +
      '      <path d="M5,0 L5,8 L0,18 L0,40 L50,40 L50,18 L45,8 L45,0 Z" fill="none" stroke="#4a5778" stroke-width="2"/>' +
      '      <clipPath id="ws-ch-bot-clip"><path d="M5,0 L5,8 L0,18 L0,40 L50,40 L50,18 L45,8 L45,0 Z"/></clipPath>' +
      '      <rect id="ws-ch-bot-fill" x="0" y="40" width="50" height="0" fill="#8b5a2b" opacity="0.95" clip-path="url(#ws-ch-bot-clip)"/>' +
      '      <text x="25" y="-5" text-anchor="middle" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">Bottle</text>' +
      '    </g>' +

           // ====== READOUTS (top-right corner) ======
      '    <g transform="translate(440,20)">' +
      '      <text x="0" y="0" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">MilkPct</text>' +
      '      <text id="ws-ch-r-milk" x="60" y="0" fill="#f5f5f0" font-size="12" font-family="JetBrains Mono" font-weight="700">0</text>' +
      '      <text x="100" y="0" fill="#9aa3b8" font-size="10" font-family="JetBrains Mono">CocoaPct</text>' +
      '      <text id="ws-ch-r-coc" x="170" y="0" fill="#6b3410" font-size="12" font-family="JetBrains Mono" font-weight="700">0</text>' +
      '    </g>' +

           // Pump status lights
      '    <circle id="ws-ch-led-m" cx="170" cy="148" r="4" fill="#1c2342"/>' +
      '    <circle id="ws-ch-led-c" cx="470" cy="148" r="4" fill="#1c2342"/>' +
      '  </svg>' +
      '</div>';

    // ---------- RIGHT — Recipe + HMI + Watch ----------------------------
    var right = el('div', 'scada-ws-panel scada-ws-right-stack');
    var recipeOptions = RECIPES.map(function (r) {
      return '<button type="button" class="ws-recipe-card" data-id="' + r.id + '">' +
        '<div class="ws-recipe-name">' + r.name + '</div>' +
        '<div class="ws-recipe-ratio">Milk <strong>' + r.milkTarget + '%</strong> · Cocoa <strong>' + r.cocoaTarget + '%</strong></div>' +
        '</button>';
    }).join('');

    right.innerHTML =
      '<div class="scada-ws-panel-title">📋 Recipe Selector</div>' +
      '<div class="scada-ws-panel-sub">เลือก → ทำหน้าที่ <em>RecipeLoad</em> โหลด Setpoint ลง Points</div>' +
      '<div class="scada-ws-recipes" id="ws-ch-recipes">' + recipeOptions + '</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-panel-title">▶️ Runtime</div>' +
      '<button type="button" class="ws-btn-run" id="ws-ch-run">▶ Build &amp; Run</button>' +
      '<div class="scada-ws-runtime-state" id="ws-ch-rt-state">⏸ Editor Mode</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-runtime-ctrl scada-ws-ctrl-grid">' +
      '  <button type="button" class="ws-btn-toggle ok" id="ws-ch-auto" disabled>🤖 Auto Run</button>' +
      '  <button type="button" class="ws-btn-toggle" id="ws-ch-emer" disabled>🛑 E-Stop</button>' +
      '  <button type="button" class="ws-btn-toggle" id="ws-ch-m-milk" disabled>Manual Milk</button>' +
      '  <button type="button" class="ws-btn-toggle" id="ws-ch-m-coc" disabled>Manual Cocoa</button>' +
      '  <button type="button" class="ws-btn-toggle" id="ws-ch-m-out" disabled>Open Outlet</button>' +
      '  <button type="button" class="ws-btn-toggle" id="ws-ch-reset" disabled>⟲ Reset</button>' +
      '</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-runtime-watch">' +
      '  <div class="scada-ws-watch-row"><span>PumpMilk (Q:100.00)</span><span class="ws-bit" id="ws-ch-w-pm">—</span></div>' +
      '  <div class="scada-ws-watch-row"><span>PumpCho (Q:100.01)</span><span class="ws-bit" id="ws-ch-w-pc">—</span></div>' +
      '  <div class="scada-ws-watch-row"><span>Outlet (Q:100.02)</span><span class="ws-bit" id="ws-ch-w-out">—</span></div>' +
      '  <div class="scada-ws-watch-row"><span>MilkPct (D100)</span><span class="ws-bit num" id="ws-ch-w-mi">—</span></div>' +
      '  <div class="scada-ws-watch-row"><span>CocoaPct (D102)</span><span class="ws-bit num" id="ws-ch-w-co">—</span></div>' +
      '  <div class="scada-ws-watch-row"><span>Bottles produced</span><span class="ws-bit num" id="ws-ch-w-bt">0</span></div>' +
      '</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-alarm">' +
      '  <div class="scada-ws-alarm-title">🔔 Alarm Log</div>' +
      '  <div class="scada-ws-alarm-list" id="ws-ch-alarms"><div class="scada-ws-empty">— ไม่มี Alarm —</div></div>' +
      '</div>';

    bench.appendChild(mimic);
    bench.appendChild(right);
    root.appendChild(bench);

    // ============================================================
    // HINT BAR
    // ============================================================
    var hint = el('div', 'scada-ws-hint',
      '👉 <strong>เลือก Recipe</strong> ทางขวา → กด <strong>▶ Build &amp; Run</strong> → กด <strong>🤖 Auto Run</strong> — ' +
      'ระบบจะเปิด Pump ตามสูตร, ปิดเอง, แล้วเทลงขวด');
    root.appendChild(hint);

    // ============================================================
    // WIRING
    // ============================================================
    var milkFill   = mimic.querySelector('#ws-ch-milk-fill');
    var cocFill    = mimic.querySelector('#ws-ch-coc-fill');
    var mixFill    = mimic.querySelector('#ws-ch-mix-fill');
    var botFill    = mimic.querySelector('#ws-ch-bot-fill');
    var mixReadout = mimic.querySelector('#ws-ch-mix-readout');
    var mixer      = mimic.querySelector('#ws-ch-mixer');
    var milkFlow   = mimic.querySelector('#ws-ch-milk-flow');
    var cocFlow    = mimic.querySelector('#ws-ch-coc-flow');
    var outFlow    = mimic.querySelector('#ws-ch-out-flow');
    var milkPump   = mimic.querySelector('#ws-ch-milk-pump');
    var cocPump    = mimic.querySelector('#ws-ch-coc-pump');
    var outletSvg  = mimic.querySelector('#ws-ch-outlet rect');
    var ledM       = mimic.querySelector('#ws-ch-led-m');
    var ledC       = mimic.querySelector('#ws-ch-led-c');
    var rMilk      = mimic.querySelector('#ws-ch-r-milk');
    var rCoc       = mimic.querySelector('#ws-ch-r-coc');

    var recipesEl  = right.querySelector('#ws-ch-recipes');
    var runBtn     = right.querySelector('#ws-ch-run');
    var rtState    = right.querySelector('#ws-ch-rt-state');
    var autoBtn    = right.querySelector('#ws-ch-auto');
    var emerBtn    = right.querySelector('#ws-ch-emer');
    var mMilkBtn   = right.querySelector('#ws-ch-m-milk');
    var mCocBtn    = right.querySelector('#ws-ch-m-coc');
    var mOutBtn    = right.querySelector('#ws-ch-m-out');
    var resetBtn   = right.querySelector('#ws-ch-reset');
    var wPm  = right.querySelector('#ws-ch-w-pm');
    var wPc  = right.querySelector('#ws-ch-w-pc');
    var wOut = right.querySelector('#ws-ch-w-out');
    var wMi  = right.querySelector('#ws-ch-w-mi');
    var wCo  = right.querySelector('#ws-ch-w-co');
    var wBt  = right.querySelector('#ws-ch-w-bt');
    var alarmList = right.querySelector('#ws-ch-alarms');

    function setHint(html, cls) {
      hint.className = 'scada-ws-hint' + (cls ? ' ' + cls : '');
      hint.innerHTML = html;
    }

    function pushAlarm(msg, sev) {
      var stamp = new Date();
      var hh = String(stamp.getHours()).padStart(2,'0');
      var mm = String(stamp.getMinutes()).padStart(2,'0');
      var ss = String(stamp.getSeconds()).padStart(2,'0');
      state.alarms.unshift({ t: hh+':'+mm+':'+ss, msg: msg, sev: sev || 'info' });
      if (state.alarms.length > 6) state.alarms.length = 6;
      renderAlarms();
    }
    function renderAlarms() {
      if (!state.alarms.length) {
        alarmList.innerHTML = '<div class="scada-ws-empty">— ไม่มี Alarm —</div>';
        return;
      }
      alarmList.innerHTML = state.alarms.map(function (a) {
        return '<div class="ws-alarm-row ws-alarm-' + a.sev + '">' +
          '<span class="ws-alarm-t">' + a.t + '</span>' +
          '<span class="ws-alarm-m">' + a.msg + '</span></div>';
      }).join('');
    }

    function setRecipe(id) {
      state.recipe = RECIPES.find(function (r) { return r.id === id; });
      recipesEl.querySelectorAll('.ws-recipe-card').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-id') === id);
      });
      pushAlarm('RecipeLoad: ' + state.recipe.name + ' (M=' + state.recipe.milkTarget + '%, C=' + state.recipe.cocoaTarget + '%)', 'info');
      setHint('✓ โหลด Recipe <strong>' + state.recipe.name + '</strong> — Setpoint ลง Points แล้ว · กด ▶ Build &amp; Run');
    }
    recipesEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.ws-recipe-card');
      if (!btn) return;
      setRecipe(btn.getAttribute('data-id'));
    });

    function refresh() {
      // tanks (sources): drain slowly when their pump is on
      milkFill.setAttribute('y', 0);
      milkFill.setAttribute('height', 120 - (state.pumpMilk && state.running ? Math.min(50, state.milk * 0.5) : 0));
      cocFill.setAttribute('y', 0);
      cocFill.setAttribute('height', 120 - (state.pumpCho && state.running ? Math.min(50, state.cocoa * 0.8) : 0));

      // mixing tank fill (sum of milk+cocoa, capped)
      var lv = Math.min(100, state.milk + state.cocoa);
      var fillH = 130 * (lv / 100);
      mixFill.setAttribute('y', 130 - fillH);
      mixFill.setAttribute('height', fillH);
      // Color of mix darkens with cocoa proportion
      var ratio = lv > 0 ? state.cocoa / lv : 0;
      mixFill.setAttribute('fill', state.recipe ? blend('#f5f5f0', '#3a1f08', Math.max(0.25, ratio)) : '#8b5a2b');
      mixReadout.textContent = Math.round(lv) + '%';

      // bottle
      var bH = 40 * (state.bottle / 100);
      botFill.setAttribute('y', 40 - bH);
      botFill.setAttribute('height', bH);
      botFill.setAttribute('fill', state.recipe ? blend('#f5f5f0', '#3a1f08', Math.max(0.25, ratio)) : '#8b5a2b');

      // pump LEDs + flow visualization
      ledM.setAttribute('fill', state.pumpMilk && state.running ? '#34d399' : '#1c2342');
      ledC.setAttribute('fill', state.pumpCho && state.running ? '#34d399' : '#1c2342');
      milkFlow.style.opacity = state.pumpMilk && state.running ? 1 : 0;
      cocFlow.style.opacity  = state.pumpCho && state.running ? 1 : 0;
      outFlow.style.opacity  = state.outlet && state.running ? 1 : 0;
      milkPump.classList.toggle('on', state.pumpMilk && state.running);
      cocPump.classList.toggle('on', state.pumpCho && state.running);
      outletSvg.setAttribute('fill', state.outlet && state.running ? '#ff7a18' : '#1c2342');

      // mixer rotation — relative to parent group's translate(255,180); mixer base at (65,65)
      if (state.running) {
        var spin = (state.milk > 0 || state.cocoa > 0) ? 1 : 0;
        if (spin) {
          state.mixerSpin = (state.mixerSpin + 4) % 360;
          mixer.setAttribute('transform', 'translate(65,65) rotate(' + state.mixerSpin + ')');
        } else {
          mixer.setAttribute('transform', 'translate(65,65)');
        }
      }

      // readouts
      rMilk.textContent = Math.round(state.milk);
      rCoc.textContent  = Math.round(state.cocoa);

      // watch panel
      if (!state.running) {
        wPm.textContent='—';wPc.textContent='—';wOut.textContent='—';
        wMi.textContent='—';wCo.textContent='—';
        wPm.className='ws-bit';wPc.className='ws-bit';wOut.className='ws-bit';
        wMi.className='ws-bit num';wCo.className='ws-bit num';
      } else {
        wPm.textContent=state.pumpMilk?1:0; wPm.className='ws-bit '+(state.pumpMilk?'on':'off');
        wPc.textContent=state.pumpCho?1:0;  wPc.className='ws-bit '+(state.pumpCho?'on':'off');
        wOut.textContent=state.outlet?1:0;  wOut.className='ws-bit '+(state.outlet?'on':'off');
        wMi.textContent=Math.round(state.milk); wMi.className='ws-bit num';
        wCo.textContent=Math.round(state.cocoa); wCo.className='ws-bit num';
      }
      wBt.textContent = state.bottles;
    }

    function blend(c1, c2, t) {
      function hex(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];}
      var a=hex(c1), b=hex(c2);
      var r=Math.round(a[0]+(b[0]-a[0])*t), g=Math.round(a[1]+(b[1]-a[1])*t), bl=Math.round(a[2]+(b[2]-a[2])*t);
      return 'rgb('+r+','+g+','+bl+')';
    }

    // ---- Run/Stop ----------------------------------------------------
    runBtn.addEventListener('click', function () {
      state.running = !state.running;
      if (state.running) {
        runBtn.textContent='⏹ Stop'; runBtn.classList.add('running');
        rtState.textContent='▶ Running…'; rtState.classList.add('on');
        autoBtn.disabled = emerBtn.disabled = mMilkBtn.disabled = mCocBtn.disabled = mOutBtn.disabled = resetBtn.disabled = false;
        pushAlarm('System started · CX-Supervisor Runtime online', 'info');
        startTicker();
        setHint('🟢 รันแล้ว · เลือก Recipe (ถ้ายังไม่ได้เลือก) แล้วกด <strong>🤖 Auto Run</strong>');
      } else {
        runBtn.textContent='▶ Build & Run'; runBtn.classList.remove('running');
        rtState.textContent='⏸ Editor Mode'; rtState.classList.remove('on');
        autoBtn.disabled = emerBtn.disabled = mMilkBtn.disabled = mCocBtn.disabled = mOutBtn.disabled = resetBtn.disabled = true;
        stopTicker();
        state.pumpMilk = state.pumpCho = state.outlet = false;
      }
      refresh();
    });

    var autoStage = null; // 'milk' | 'cocoa' | 'mix' | 'outlet' | 'done'
    var autoTimer = 0;

    autoBtn.addEventListener('click', function () {
      if (!state.recipe) {
        setHint('⚠️ เลือก Recipe ก่อน', 'warn'); return;
      }
      // Reset batch
      state.milk = 0; state.cocoa = 0; state.bottle = 0;
      autoStage = 'milk';
      autoTimer = 0;
      pushAlarm('AUTO: Stage 1 — Pumping milk to ' + state.recipe.milkTarget + '%', 'info');
      state.pumpMilk = true; state.pumpCho = false; state.outlet = false;
      refresh();
    });

    emerBtn.addEventListener('click', function () {
      state.pumpMilk = state.pumpCho = state.outlet = false;
      autoStage = null;
      pushAlarm('E-STOP pressed — all outputs OFF', 'danger');
      refresh();
    });
    mMilkBtn.addEventListener('click', function () { autoStage=null; state.pumpMilk=!state.pumpMilk; mMilkBtn.classList.toggle('active',state.pumpMilk); refresh(); });
    mCocBtn.addEventListener('click',  function () { autoStage=null; state.pumpCho=!state.pumpCho;   mCocBtn.classList.toggle('active',state.pumpCho);   refresh(); });
    mOutBtn.addEventListener('click',  function () { autoStage=null; state.outlet=!state.outlet;     mOutBtn.classList.toggle('active',state.outlet);     refresh(); });
    resetBtn.addEventListener('click', function () {
      state.milk=0; state.cocoa=0; state.bottle=0; state.bottles=0;
      state.pumpMilk=state.pumpCho=state.outlet=false; autoStage=null;
      pushAlarm('Batch reset', 'info');
      refresh();
    });

    function startTicker() {
      stopTicker();
      state.tick = setInterval(function () {
        // Manual / Auto fill physics
        if (state.pumpMilk) state.milk = Math.min(100, state.milk + 1.5);
        if (state.pumpCho)  state.cocoa = Math.min(100, state.cocoa + 1.2);

        // Auto sequence
        if (autoStage === 'milk' && state.recipe) {
          if (state.milk >= state.recipe.milkTarget) {
            state.pumpMilk = false;
            autoStage = 'cocoa';
            state.pumpCho = true;
            pushAlarm('Milk target reached → Stage 2 (cocoa to ' + state.recipe.cocoaTarget + '%)', 'info');
          }
        } else if (autoStage === 'cocoa' && state.recipe) {
          if (state.cocoa >= state.recipe.cocoaTarget) {
            state.pumpCho = false;
            autoStage = 'mix';
            autoTimer = 0;
            pushAlarm('Cocoa target reached → Stage 3 (mixing 2s)', 'info');
          }
        } else if (autoStage === 'mix') {
          autoTimer += 0.12;
          if (autoTimer >= 2) {
            autoStage = 'outlet';
            state.outlet = true;
            pushAlarm('Mixing done → Stage 4 (dispense to bottle)', 'info');
          }
        } else if (autoStage === 'outlet') {
          if (state.outlet) {
            var transfer = Math.min(2.5, state.milk + state.cocoa);
            // proportionally drain mix into bottle
            var lv = state.milk + state.cocoa;
            if (lv > 0) {
              var dMilk = transfer * (state.milk / lv);
              var dCoc  = transfer * (state.cocoa / lv);
              state.milk = Math.max(0, state.milk - dMilk);
              state.cocoa = Math.max(0, state.cocoa - dCoc);
              state.bottle = Math.min(100, state.bottle + transfer);
            }
            if (state.bottle >= 100 || (state.milk + state.cocoa) < 0.5) {
              state.outlet = false;
              state.bottles++;
              state.bottle = 100;
              autoStage = 'done';
              pushAlarm('🎉 Bottle ' + state.bottles + ' produced (' + state.recipe.name + ')', 'ok');
              setHint('🎉 <strong>ผลิตช็อกโกแลตสำเร็จ!</strong> Bottle #' + state.bottles + ' (' + state.recipe.name + ') ' +
                ' — ลอง Recipe อื่นต่อ หรือกด Auto Run อีกรอบ', 'ok');
              // After a brief pause, reset bottle for next batch
              setTimeout(function () {
                if (state.running) { state.bottle = 0; refresh(); }
              }, 1500);
            }
          }
        }
        refresh();
      }, 120);
    }
    function stopTicker() {
      if (state.tick) { clearInterval(state.tick); state.tick = null; }
    }

    refresh();
  }

  function init() {
    var nodes = document.querySelectorAll('.scada-ws-chocolate');
    for (var i = 0; i < nodes.length; i++) buildChocolate(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
