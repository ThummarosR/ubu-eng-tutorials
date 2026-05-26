/* PID Tuning Playground
 *
 * Markup:
 *   <div class="pid-tuner"></div>
 *
 * Reactive widget — student drags Kp / Ti / Td sliders and the response curve
 * re-renders in real time. Plant is a First-Order-Plus-Dead-Time (FOPDT) heater:
 *
 *     τ · dPV/dt = -PV + Kp_plant · MV(t - θ)
 *
 * Setpoint is a step from ambient (25°C) to 60°C at t=0.
 * PID is parallel form with derivative-on-measurement (avoids derivative kick):
 *
 *     e   = SP - PV
 *     I  += Kp/Ti · e · dt
 *     D   = Kp · Td · (PV - PV_prev) / dt
 *     MV  = clip(P + I - D, 0, 100)
 *
 * Stats computed: Overshoot %, Settling time (±2% band), SS error.
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // ---------- Plant model parameters ---------------------------------------
  var PLANT = {
    Kp:     1.0,    // °C per % MV at steady state (so 100% MV → +100°C above ambient)
    tau:    25.0,   // seconds — first-order time constant
    theta:  5.0,    // seconds — dead time
    ambient: 25.0   // °C
  };

  var SIM = {
    dt:       0.1,    // seconds per step
    duration: 120.0,  // simulate for 120s
    SP:       60.0    // setpoint
  };

  // ---------- Presets the student can try ---------------------------------
  var PRESETS = [
    { name: 'Kp ต่ำเกิน (sluggish)',  Kp: 0.5,  Ti: 9999, Td: 0,    note: 'ตอบสนองช้า · ไม่ถึง SP' },
    { name: 'Kp สูงเกิน (oscillates)', Kp: 12.0, Ti: 9999, Td: 0,   note: 'แกว่งหนัก · ไม่นิ่ง' },
    { name: 'P only',                  Kp: 2.5,  Ti: 9999, Td: 0,    note: 'Steady-state error เห็นชัด' },
    { name: 'PI',                      Kp: 2.0,  Ti: 20,   Td: 0,    note: 'ตัด SS error · ช้าหน่อย' },
    { name: 'PID (Ziegler-Nichols)',   Kp: 2.4,  Ti: 15,   Td: 3.75, note: 'Ku=4, Pu=30s · classic ZN' },
    { name: 'PID (low overshoot)',     Kp: 2.4,  Ti: 20,   Td: 5.0,  note: 'OS น้อย · ช้ากว่า ZN เล็กน้อย' }
  ];

  // ---------- Simulator -----------------------------------------------------
  function simulate(params) {
    var Kp = params.Kp;
    var Ti = params.Ti;
    var Td = params.Td;

    var dt = SIM.dt;
    var nSteps = Math.floor(SIM.duration / dt);
    var delaySteps = Math.max(1, Math.round(PLANT.theta / dt));

    var t  = new Float64Array(nSteps);
    var pv = new Float64Array(nSteps);
    var sp = new Float64Array(nSteps);
    var mv = new Float64Array(nSteps);

    var PV = PLANT.ambient;
    var I_term = 0;
    var PV_prev = PV;
    // MV history for dead-time delay
    var mvHist = new Float64Array(nSteps + delaySteps + 1);

    for (var i = 0; i < nSteps; i++) {
      var tt = i * dt;
      t[i] = tt;
      sp[i] = SIM.SP;

      // PID control
      var e = SIM.SP - PV;
      I_term += (Kp / Ti) * e * dt;
      // Anti-windup: clip integral to a reasonable range
      var I_max = 100;
      if (I_term > I_max) I_term = I_max;
      else if (I_term < -I_max) I_term = -I_max;

      var P = Kp * e;
      // Derivative on measurement (sign flipped vs error)
      var D = (Td > 0) ? (-Kp * Td * (PV - PV_prev) / dt) : 0;
      PV_prev = PV;

      var MV = P + I_term + D;
      // Saturate to 0–100% (anti-reset windup also)
      if (MV > 100) { MV = 100; }
      else if (MV < 0) { MV = 0; }

      mv[i] = MV;
      mvHist[i] = MV;

      // Plant update — FOPDT with dead time θ
      var mvIn = (i >= delaySteps) ? mvHist[i - delaySteps] : 0;
      var deltaPV = (PLANT.Kp * mvIn - (PV - PLANT.ambient)) / PLANT.tau;
      PV += deltaPV * dt;
      pv[i] = PV;
    }

    // Stats
    var stepSize = SIM.SP - PLANT.ambient;
    var pvMax = -Infinity;
    var pvFinal = pv[nSteps - 1];
    for (var k = 0; k < nSteps; k++) if (pv[k] > pvMax) pvMax = pv[k];
    var overshootPct = Math.max(0, (pvMax - SIM.SP) / stepSize * 100);
    // Settling time = last index where |PV-SP| > 2% of step
    var band = 0.02 * stepSize;
    var settleIdx = -1;
    for (var m = nSteps - 1; m >= 0; m--) {
      if (Math.abs(pv[m] - SIM.SP) > band) { settleIdx = m; break; }
    }
    var settlingTime = (settleIdx >= 0 && settleIdx < nSteps - 1) ? t[settleIdx + 1] : (settleIdx < 0 ? 0 : NaN);
    var ssError = SIM.SP - pvFinal;

    return { t: t, sp: sp, pv: pv, mv: mv,
             stats: { overshoot: overshootPct, settling: settlingTime, ssError: ssError, pvFinal: pvFinal } };
  }

  // ---------- DOM helpers --------------------------------------------------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---------- Plot rendering (SVG) -----------------------------------------
  // Y axis 1: PV/SP in °C (0..120)
  // Y axis 2: MV in % (0..100, plotted on same chart, lighter line)
  function renderPlot(svg, result) {
    var W = 720, H = 320;
    var pad = { l: 50, r: 50, t: 24, b: 36 };
    var plotW = W - pad.l - pad.r;
    var plotH = H - pad.t - pad.b;

    var yMin = 0, yMax = 120;
    var xMax = SIM.duration;

    function x(t)  { return pad.l + (t / xMax) * plotW; }
    function y(v)  { return pad.t + (1 - (v - yMin) / (yMax - yMin)) * plotH; }
    function yMv(p){ return pad.t + (1 - p / 100) * plotH; }   // MV uses 0..100% mapped onto full height

    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    // Grid
    function gridLine(yVal, opts) {
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pad.l);
      line.setAttribute('x2', W - pad.r);
      line.setAttribute('y1', y(yVal));
      line.setAttribute('y2', y(yVal));
      line.setAttribute('class', 'pt-grid');
      svg.appendChild(line);
      var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', pad.l - 8);
      lbl.setAttribute('y', y(yVal) + 4);
      lbl.setAttribute('text-anchor', 'end');
      lbl.setAttribute('class', 'pt-axis-lbl');
      lbl.textContent = yVal + '°';
      svg.appendChild(lbl);
    }
    [0, 30, 60, 90, 120].forEach(function (yVal) { gridLine(yVal); });

    // X-axis ticks every 20s
    for (var tt = 0; tt <= xMax; tt += 20) {
      var tl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tl.setAttribute('x1', x(tt));
      tl.setAttribute('x2', x(tt));
      tl.setAttribute('y1', pad.t);
      tl.setAttribute('y2', H - pad.b);
      tl.setAttribute('class', 'pt-grid');
      svg.appendChild(tl);
      var tlb = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tlb.setAttribute('x', x(tt));
      tlb.setAttribute('y', H - pad.b + 18);
      tlb.setAttribute('text-anchor', 'middle');
      tlb.setAttribute('class', 'pt-axis-lbl');
      tlb.textContent = tt + 's';
      svg.appendChild(tlb);
    }

    // Setpoint line
    var sp = result.sp[0];
    var spLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    spLine.setAttribute('x1', x(0));
    spLine.setAttribute('x2', x(xMax));
    spLine.setAttribute('y1', y(sp));
    spLine.setAttribute('y2', y(sp));
    spLine.setAttribute('class', 'pt-sp');
    svg.appendChild(spLine);
    var spLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    spLbl.setAttribute('x', W - pad.r + 6);
    spLbl.setAttribute('y', y(sp) + 4);
    spLbl.setAttribute('class', 'pt-sp-lbl');
    spLbl.textContent = 'SP ' + sp + '°';
    svg.appendChild(spLbl);

    // Build polyline strings (down-sample 1 in 3 to reduce DOM weight)
    function buildPath(arr, yfn, step) {
      step = step || 3;
      var d = '';
      for (var i = 0; i < arr.length; i += step) {
        d += (i === 0 ? 'M' : 'L') + x(result.t[i]).toFixed(1) + ',' + yfn(arr[i]).toFixed(1) + ' ';
      }
      return d;
    }

    // MV path (lighter, behind PV)
    var mvPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mvPath.setAttribute('d', buildPath(result.mv, yMv));
    mvPath.setAttribute('class', 'pt-mv');
    svg.appendChild(mvPath);

    // PV path (foreground)
    var pvPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pvPath.setAttribute('d', buildPath(result.pv, y));
    pvPath.setAttribute('class', 'pt-pv');
    svg.appendChild(pvPath);

    // Right Y axis label for MV (0–100%)
    var mvAxLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    mvAxLbl.setAttribute('x', W - pad.r + 6);
    mvAxLbl.setAttribute('y', pad.t + 12);
    mvAxLbl.setAttribute('class', 'pt-mv-lbl');
    mvAxLbl.textContent = 'MV 0–100%';
    svg.appendChild(mvAxLbl);

    // Top legend
    var leg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    leg.setAttribute('x', pad.l + 10);
    leg.setAttribute('y', pad.t - 6);
    leg.setAttribute('class', 'pt-legend');
    leg.innerHTML = '<tspan class="pt-l-pv">━ PV (°C)</tspan>  <tspan class="pt-l-sp">- - SP</tspan>  <tspan class="pt-l-mv">━ MV (%)</tspan>';
    svg.appendChild(leg);
  }

  // ---------- Build one instance ------------------------------------------
  function buildTuner(root) {
    root.innerHTML = '';
    root.classList.add('pt');

    var params = { Kp: 2.4, Ti: 15, Td: 3.75 };

    // ---------- Header ---------------------------------------------------
    var head = el('div', 'pt-head');
    head.innerHTML =
      '<div class="pt-title">🎛️ PID Tuning Playground</div>' +
      '<div class="pt-desc">Plant: First-Order Heater · K = ' + PLANT.Kp +
      ' · τ = ' + PLANT.tau + 's · θ (dead-time) = ' + PLANT.theta + 's · ' +
      'Step: ' + PLANT.ambient + '°C → ' + SIM.SP + '°C ที่ t=0</div>';
    root.appendChild(head);

    // ---------- Plot -----------------------------------------------------
    var plotWrap = el('div', 'pt-plot');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    plotWrap.appendChild(svg);
    root.appendChild(plotWrap);

    // ---------- Sliders --------------------------------------------------
    var slidersPanel = el('div', 'pt-panel');
    slidersPanel.innerHTML = '<div class="pt-panel-label">🎚️ Tuning</div>';

    function makeSlider(label, key, min, max, step, decimals, unit) {
      var row = el('div', 'pt-slider-row');
      var lbl = el('div', 'pt-slider-label');
      var nameEl = el('span', 'pt-slider-name', label);
      var valEl  = el('span', 'pt-slider-val');
      lbl.appendChild(nameEl); lbl.appendChild(valEl);
      var input = el('input', 'pt-slider');
      input.type = 'range';
      input.min = String(min); input.max = String(max); input.step = String(step);
      input.value = String(params[key]);
      function refresh() {
        var v = parseFloat(input.value);
        params[key] = v;
        valEl.textContent = v.toFixed(decimals) + (unit || '');
        update();
      }
      input.addEventListener('input', refresh);
      row.appendChild(lbl);
      row.appendChild(input);
      valEl.textContent = (params[key]).toFixed(decimals) + (unit || '');
      return { row: row, input: input, refresh: refresh };
    }

    var sKp = makeSlider('Kp · Proportional gain', 'Kp', 0.1, 10, 0.1, 2, '');
    var sTi = makeSlider('Ti · Integral time', 'Ti', 1, 200, 0.5, 1, ' s');
    var sTd = makeSlider('Td · Derivative time', 'Td', 0, 20, 0.05, 2, ' s');
    slidersPanel.appendChild(sKp.row);
    slidersPanel.appendChild(sTi.row);
    slidersPanel.appendChild(sTd.row);

    // Preset chips
    var presetWrap = el('div', 'pt-presets');
    presetWrap.innerHTML = '<div class="pt-presets-label">Presets ลองคลิกเปรียบเทียบ:</div>';
    var presetGrid = el('div', 'pt-preset-grid');
    PRESETS.forEach(function (p) {
      var chip = el('button', 'pt-preset');
      chip.type = 'button';
      chip.innerHTML =
        '<div class="pt-preset-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="pt-preset-vals">Kp=' + p.Kp + ' · Ti=' + (p.Ti >= 999 ? '∞' : p.Ti) + 's · Td=' + p.Td + 's</div>' +
        '<div class="pt-preset-note">' + escapeHtml(p.note) + '</div>';
      chip.addEventListener('click', function () {
        params.Kp = p.Kp; params.Ti = p.Ti; params.Td = p.Td;
        sKp.input.value = p.Kp; sTi.input.value = p.Ti; sTd.input.value = p.Td;
        sKp.refresh(); // triggers update
      });
      presetGrid.appendChild(chip);
    });
    presetWrap.appendChild(presetGrid);
    slidersPanel.appendChild(presetWrap);

    root.appendChild(slidersPanel);

    // ---------- Stats ----------------------------------------------------
    var stats = el('div', 'pt-stats');
    root.appendChild(stats);

    // ---------- Update loop ---------------------------------------------
    function update() {
      var result = simulate(params);
      renderPlot(svg, result);
      var s = result.stats;
      var ssClass = Math.abs(s.ssError) < 0.5 ? 'good' : 'warn';
      var osClass = s.overshoot < 5 ? 'good' : (s.overshoot < 15 ? 'warn' : 'bad');
      var stClass = (!isNaN(s.settling) && s.settling < 30) ? 'good' :
                    (!isNaN(s.settling) && s.settling < 60) ? 'warn' : 'bad';
      stats.innerHTML =
        '<div class="pt-stat ' + osClass + '">' +
          '<div class="pt-stat-label">Overshoot</div>' +
          '<div class="pt-stat-val">' + s.overshoot.toFixed(1) + '%</div>' +
        '</div>' +
        '<div class="pt-stat ' + stClass + '">' +
          '<div class="pt-stat-label">Settling Time (±2%)</div>' +
          '<div class="pt-stat-val">' + (isNaN(s.settling) ? '—' : s.settling.toFixed(1) + ' s') + '</div>' +
        '</div>' +
        '<div class="pt-stat ' + ssClass + '">' +
          '<div class="pt-stat-label">Steady-State Error</div>' +
          '<div class="pt-stat-val">' + s.ssError.toFixed(2) + '°C</div>' +
        '</div>' +
        '<div class="pt-stat">' +
          '<div class="pt-stat-label">Final PV</div>' +
          '<div class="pt-stat-val">' + s.pvFinal.toFixed(2) + '°C</div>' +
        '</div>';
    }

    update();
  }

  // ---------- Init -----------------------------------------------------------
  function init() {
    document.querySelectorAll('.pid-tuner').forEach(function (el) {
      buildTuner(el);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
