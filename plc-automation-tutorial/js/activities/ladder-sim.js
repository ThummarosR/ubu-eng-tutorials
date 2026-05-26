/* PLC Ladder Logic Simulator — Block-Flow View
 *
 * Markup:
 *   <div class="ladder-sim" data-example="self-hold" data-syntax="mit"></div>
 *
 *   data-example: which example to load (see EXAMPLES below)
 *   data-syntax:  'mit' (X0/Y0/M0) or 'omron' (0.00/100.00/W0.00) — for label display only
 *
 * Visual model:
 *   Each rung becomes a left-to-right block chain.  Conditions are big rounded
 *   rectangles that turn green when current would flow through that contact.
 *   AND/OR groups are visually grouped.  Output coil/timer/counter at the right
 *   lights up orange when energized.
 *
 * Scan cycle runs every ~100ms.
 *
 * No deps. Vanilla JS + HTML/CSS. Offline-friendly.
 */
(function () {
  'use strict';

  // ---------- Example library ------------------------------------------------
  // Expression nodes:
  //   ['NO', 'X0']            — Normally-open contact (conducts when bit ON)
  //   ['NC', 'X0']            — Normally-closed contact (conducts when bit OFF)
  //   ['AND', a, b, ...]      — All must conduct
  //   ['OR',  a, b, ...]      — Any may conduct
  //
  // Rung kinds:
  //   { kind: 'coil',    device: 'Y0', expr }
  //   { kind: 'set',     device: 'M0', expr }
  //   { kind: 'rst',     device: 'M0', expr }
  //   { kind: 'timer',   device: 'T0', preset: 30, expr }       (0.1s units)
  //   { kind: 'counter', device: 'C0', preset: 5,  expr, reset } (rising-edge)

  var EXAMPLES = {

    'self-hold': {
      title: 'Self-Hold (Start / Stop)',
      desc: 'กดปุ่ม Start ครั้งเดียว → Y0 ค้าง ON · กด Stop → Y0 OFF',
      inputs: [
        { id: 'X0', label: 'Start', color: 'ok' },
        { id: 'X1', label: 'Stop',  color: 'danger' }
      ],
      outputs: [{ id: 'Y0', label: 'Lamp' }],
      rungs: [
        { kind: 'coil', device: 'Y0',
          expr: ['AND',
            ['OR', ['NO','X0'], ['NO','Y0']],
            ['NC','X1']
          ]
        }
      ]
    },

    'timer-on-delay': {
      title: 'Timer ON-Delay (3 วินาที)',
      desc: 'กด X0 ค้าง 3 วินาที → T0 ครบ → Y0 ติด',
      inputs: [
        { id: 'X0', label: 'Trigger', color: 'ok' }
      ],
      outputs: [{ id: 'Y0', label: 'Lamp' }],
      timers: [{ id: 'T0', preset: 30, unit: 0.1 }],
      rungs: [
        { kind: 'timer', device: 'T0', preset: 30, expr: ['NO','X0'] },
        { kind: 'coil',  device: 'Y0', expr: ['NO','T0'] }
      ]
    },

    'counter-pulse': {
      title: 'Counter (นับ 5 ครั้ง)',
      desc: 'กด X0 ครบ 5 ครั้ง (toggle OFF→ON) → C0 → Y0 ติด · กด X1 = Reset',
      inputs: [
        { id: 'X0', label: 'Count', color: 'ok' },
        { id: 'X1', label: 'Reset', color: 'warn' }
      ],
      outputs: [{ id: 'Y0', label: 'Lamp' }],
      counters: [{ id: 'C0', preset: 5 }],
      rungs: [
        { kind: 'counter', device: 'C0', preset: 5, expr: ['NO','X0'], reset: ['NO','X1'] },
        { kind: 'coil',    device: 'Y0', expr: ['NO','C0'] }
      ]
    },

    'star-delta': {
      title: 'Star–Delta Motor Starter',
      desc: 'X0=Start → Y0 (Main) + Y1 (Star) · ครบ 5s → Y1 OFF + Y2 (Delta) · X1=Stop · X2=OL ปิด → Trip',
      inputs: [
        { id: 'X0', label: 'Start', color: 'ok' },
        { id: 'X1', label: 'Stop',  color: 'danger' },
        { id: 'X2', label: 'OL OK', color: 'warn', initial: true }
      ],
      outputs: [
        { id: 'Y0', label: 'Main',  badge: 'K1' },
        { id: 'Y1', label: 'Star',  badge: 'K2' },
        { id: 'Y2', label: 'Delta', badge: 'K3' }
      ],
      timers: [{ id: 'T0', preset: 50, unit: 0.1 }],
      rungs: [
        { kind: 'coil', device: 'Y0',
          expr: ['AND', ['OR', ['NO','X0'], ['NO','Y0']], ['NC','X1'], ['NO','X2']] },
        { kind: 'timer', device: 'T0', preset: 50, expr: ['NO','Y0'] },
        { kind: 'coil', device: 'Y1', expr: ['AND', ['NO','Y0'], ['NC','T0']] },
        { kind: 'coil', device: 'Y2', expr: ['AND', ['NO','Y0'], ['NO','T0'], ['NC','Y1']] }
      ]
    }

  };

  // ---------- Syntax translation (display labels only) -----------------------
  function relabel(name, syntax) {
    if (syntax !== 'omron') return name;
    var m = name.match(/^([XYM])(\d+)$/);
    if (m) {
      var letter = m[1], n = parseInt(m[2], 10);
      if (letter === 'X') return '0.0' + n;
      if (letter === 'Y') return '100.0' + n;
      if (letter === 'M') return 'W0.0' + n;
    }
    return name; // T0/C0/D0 unchanged
  }

  // ---------- Boolean evaluator ---------------------------------------------
  function evalExpr(expr, state) {
    if (!expr) return false;
    var op = expr[0];
    if (op === 'NO') return !!state.bits[expr[1]];
    if (op === 'NC') return !state.bits[expr[1]];
    if (op === 'AND') {
      for (var i = 1; i < expr.length; i++) if (!evalExpr(expr[i], state)) return false;
      return true;
    }
    if (op === 'OR') {
      for (var j = 1; j < expr.length; j++) if (evalExpr(expr[j], state)) return true;
      return false;
    }
    return false;
  }

  // ---------- Block-flow renderer -------------------------------------------
  // Walks the expression tree and produces:
  //   - A DOM tree of <div class="lsim-cond"> / <div class="lsim-group lsim-and|or">
  //   - A list of paint functions that update .active classes given current state.
  function buildExprDom(expr, syntax, paintFns) {
    if (!expr) return document.createElement('span');

    if (expr[0] === 'NO' || expr[0] === 'NC') {
      var bit = expr[1];
      var type = expr[0]; // 'NO' or 'NC'
      var el = document.createElement('div');
      el.className = 'lsim-cond';
      el.innerHTML =
        '<span class="lsim-cond-type">' + (type === 'NO' ? '──┤ ├──' : '──┤/├──') + '</span>' +
        '<span class="lsim-cond-bit">' + relabel(bit, syntax) + '</span>' +
        '<span class="lsim-cond-state"><span class="lsim-led"></span><span class="lsim-cond-text">OFF</span></span>';

      var textEl = el.querySelector('.lsim-cond-text');
      paintFns.push(function (state) {
        var bitOn = !!state.bits[bit];
        var conducts = (type === 'NO') ? bitOn : !bitOn;
        el.classList.toggle('bit-on', bitOn);
        el.classList.toggle('conducts', conducts);
        textEl.textContent = bitOn ? 'ON' : 'OFF';
      });
      return el;
    }

    if (expr[0] === 'AND' || expr[0] === 'OR') {
      var op = expr[0];
      var group = document.createElement('div');
      group.className = 'lsim-group lsim-' + op.toLowerCase();
      // Wrap with a label chip indicating the operator
      var children = [];
      for (var i = 1; i < expr.length; i++) {
        var childDom = buildExprDom(expr[i], syntax, paintFns);
        children.push(childDom);
      }
      children.forEach(function (childDom, idx) {
        group.appendChild(childDom);
        if (idx < children.length - 1) {
          var sep = document.createElement('div');
          sep.className = 'lsim-op-chip';
          sep.textContent = op;
          group.appendChild(sep);
        }
      });

      // Group conducts when its sub-expression evaluates true under current state.
      // Capture the original expr for live evaluation.
      var origExpr = expr;
      paintFns.push(function (state) {
        group.classList.toggle('conducts', evalExpr(origExpr, state));
      });
      return group;
    }

    var fallback = document.createElement('span');
    fallback.textContent = '?';
    return fallback;
  }

  // Build one rung row: [conditions...] → [output]
  function buildRung(rung, syntax, ex, state, paintFns) {
    var row = document.createElement('div');
    row.className = 'lsim-rung-row';

    // Left: condition expression
    var condWrap = document.createElement('div');
    condWrap.className = 'lsim-rung-cond';
    condWrap.appendChild(buildExprDom(rung.expr, syntax, paintFns));
    row.appendChild(condWrap);

    // Middle: arrow
    var arrow = document.createElement('div');
    arrow.className = 'lsim-arrow';
    arrow.innerHTML = '<span class="lsim-arrow-icon">→</span>';
    row.appendChild(arrow);

    // Right: output block
    var out = document.createElement('div');
    out.className = 'lsim-output';

    var deviceLabel = '';
    var outBadge = '';
    var outLabel = ex.outputs && ex.outputs.find ? ex.outputs.find(function(o){return o.id===rung.device;}) : null;
    if (outLabel) {
      outLabel.label && (deviceLabel = outLabel.label);
      outLabel.badge && (outBadge = outLabel.badge);
    }

    var kindLabel = '';
    if (rung.kind === 'coil') kindLabel = 'Coil ─( )─';
    else if (rung.kind === 'set') kindLabel = 'SET (latch)';
    else if (rung.kind === 'rst') kindLabel = 'RST (unlatch)';
    else if (rung.kind === 'timer') kindLabel = 'TIM K' + rung.preset;
    else if (rung.kind === 'counter') kindLabel = 'CTU K' + rung.preset;

    out.innerHTML =
      '<div class="lsim-output-kind">' + kindLabel + '</div>' +
      '<div class="lsim-output-bit">' + relabel(rung.device, syntax) + (outBadge ? ' <small>' + escapeHtml(outBadge) + '</small>' : '') + '</div>' +
      (deviceLabel ? '<div class="lsim-output-label">' + escapeHtml(deviceLabel) + '</div>' : '') +
      '<div class="lsim-output-state"><span class="lsim-led big"></span><span class="lsim-output-text">OFF</span></div>';

    var outText = out.querySelector('.lsim-output-text');
    paintFns.push(function (state) {
      var deviceOn = !!state.bits[rung.device];
      out.classList.toggle('on', deviceOn);
      arrow.classList.toggle('conducts', evalExpr(rung.expr, state));
      outText.textContent = deviceOn ? 'ON' : 'OFF';
    });

    row.appendChild(out);
    return row;
  }

  // ---------- One simulator instance ----------------------------------------
  function buildSim(root, exampleName, syntax) {
    var ex = EXAMPLES[exampleName];
    if (!ex) { root.textContent = '[ladder-sim: unknown example "' + exampleName + '"]'; return; }

    // Normalize outputs to objects { id, label }
    var outputs = (ex.outputs || []).map(function (o) {
      return typeof o === 'string' ? { id: o, label: '' } : o;
    });

    var state = {
      bits: {},
      timers: {},
      counters: {},
      tickMs: 100,
      scanCount: 0
    };

    ex.inputs.forEach(function (inp) { state.bits[inp.id] = !!inp.initial; });
    outputs.forEach(function (o) { state.bits[o.id] = false; });
    (ex.timers || []).forEach(function (t) {
      state.timers[t.id] = { count: 0, preset: t.preset, lastEnable: false };
      state.bits[t.id] = false;
    });
    (ex.counters || []).forEach(function (c) {
      state.counters[c.id] = { count: 0, preset: c.preset, lastEnable: false };
      state.bits[c.id] = false;
    });

    // ---------- Render UI ---------------------------------------------------
    root.innerHTML = '';
    root.classList.add('lsim');

    var head = document.createElement('div');
    head.className = 'lsim-head';
    head.innerHTML =
      '<div class="lsim-title">⚡ ' + escapeHtml(ex.title) + '</div>' +
      '<div class="lsim-desc">' + escapeHtml(ex.desc) + '</div>';
    root.appendChild(head);

    // Inputs panel
    var inPanel = document.createElement('div');
    inPanel.className = 'lsim-panel lsim-panel-inputs';
    inPanel.innerHTML = '<div class="lsim-panel-label">Inputs · กดเพื่อ Toggle</div>';
    var inGrid = document.createElement('div');
    inGrid.className = 'lsim-input-grid';
    ex.inputs.forEach(function (inp) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lsim-input ' + (inp.color || '');
      btn.dataset.bit = inp.id;
      btn.innerHTML =
        '<span class="lsim-led big"></span>' +
        '<span class="lsim-input-bit">' + relabel(inp.id, syntax) + '</span>' +
        '<span class="lsim-input-label">' + escapeHtml(inp.label) + '</span>';
      btn.addEventListener('click', function () {
        state.bits[inp.id] = !state.bits[inp.id];
        tick();
      });
      inGrid.appendChild(btn);
    });
    inPanel.appendChild(inGrid);
    root.appendChild(inPanel);

    // Rungs panel
    var rungsPanel = document.createElement('div');
    rungsPanel.className = 'lsim-panel lsim-panel-rungs';
    rungsPanel.innerHTML = '<div class="lsim-panel-label">Logic Flow</div>';
    var paintFns = [];
    ex.rungs.forEach(function (r, ri) {
      var rungLabel = document.createElement('div');
      rungLabel.className = 'lsim-rung-label';
      rungLabel.textContent = 'Rung ' + (ri + 1);
      rungsPanel.appendChild(rungLabel);
      rungsPanel.appendChild(buildRung(r, syntax, { outputs: outputs }, state, paintFns));
    });
    root.appendChild(rungsPanel);

    // Timer / Counter status
    var statusEl = null;
    if ((ex.timers && ex.timers.length) || (ex.counters && ex.counters.length)) {
      statusEl = document.createElement('div');
      statusEl.className = 'lsim-status-bar';
      root.appendChild(statusEl);
    }

    // Reset button
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'lsim-reset';
    resetBtn.textContent = '↺ Reset';
    resetBtn.addEventListener('click', function () {
      ex.inputs.forEach(function (inp) { state.bits[inp.id] = !!inp.initial; });
      outputs.forEach(function (o) { state.bits[o.id] = false; });
      Object.keys(state.timers).forEach(function (k) {
        state.timers[k].count = 0; state.timers[k].lastEnable = false; state.bits[k] = false;
      });
      Object.keys(state.counters).forEach(function (k) {
        state.counters[k].count = 0; state.counters[k].lastEnable = false; state.bits[k] = false;
      });
      tick();
    });
    root.appendChild(resetBtn);

    // ---------- Scan cycle ---------------------------------------------------
    function tick() {
      state.scanCount++;
      var newOutputs = {};
      ex.rungs.forEach(function (r) {
        var on = evalExpr(r.expr, state);
        if (r.kind === 'coil') {
          newOutputs[r.device] = on;
        } else if (r.kind === 'set') {
          if (on) newOutputs[r.device] = true;
        } else if (r.kind === 'rst') {
          if (on) newOutputs[r.device] = false;
        } else if (r.kind === 'timer') {
          var t = state.timers[r.device];
          if (on) t.count = Math.min(t.preset, t.count + 1);
          else    t.count = 0;
          state.bits[r.device] = (t.count >= t.preset);
        } else if (r.kind === 'counter') {
          var c = state.counters[r.device];
          var resetActive = r.reset ? evalExpr(r.reset, state) : false;
          if (resetActive) {
            c.count = 0;
            state.bits[r.device] = false;
          } else {
            if (on && !c.lastEnable) c.count = Math.min(c.preset, c.count + 1);
            state.bits[r.device] = (c.count >= c.preset);
          }
          c.lastEnable = on;
        }
      });
      Object.keys(newOutputs).forEach(function (k) { state.bits[k] = newOutputs[k]; });
      paint();
    }

    function paint() {
      // Input buttons
      inGrid.querySelectorAll('.lsim-input').forEach(function (btn) {
        btn.classList.toggle('on', !!state.bits[btn.dataset.bit]);
      });
      // Status bar
      if (statusEl) {
        var parts = [];
        (ex.timers || []).forEach(function (t) {
          var ts = state.timers[t.id];
          var elapsed = (ts.count * (t.unit || 0.1)).toFixed(1);
          var total = (ts.preset * (t.unit || 0.1)).toFixed(1);
          var done = ts.count >= ts.preset;
          var pct = ts.preset > 0 ? Math.round((ts.count / ts.preset) * 100) : 0;
          parts.push(
            '<div class="lsim-status-tc ' + (done ? 'done' : '') + '">' +
              '<div class="lsim-status-tc-head">' +
                '<span class="lsim-status-tc-name">' + relabel(t.id, syntax) + ' (TIM)</span>' +
                '<span class="lsim-status-tc-val">' + elapsed + ' / ' + total + ' s</span>' +
              '</div>' +
              '<div class="lsim-status-tc-bar"><div class="lsim-status-tc-fill" style="width:' + pct + '%"></div></div>' +
            '</div>'
          );
        });
        (ex.counters || []).forEach(function (c) {
          var cs = state.counters[c.id];
          var done = cs.count >= cs.preset;
          var pct = cs.preset > 0 ? Math.round((cs.count / cs.preset) * 100) : 0;
          parts.push(
            '<div class="lsim-status-tc ' + (done ? 'done' : '') + '">' +
              '<div class="lsim-status-tc-head">' +
                '<span class="lsim-status-tc-name">' + relabel(c.id, syntax) + ' (CTU)</span>' +
                '<span class="lsim-status-tc-val">' + cs.count + ' / ' + cs.preset + '</span>' +
              '</div>' +
              '<div class="lsim-status-tc-bar"><div class="lsim-status-tc-fill" style="width:' + pct + '%"></div></div>' +
            '</div>'
          );
        });
        statusEl.innerHTML = parts.join('');
      }
      // Rung paint fns
      paintFns.forEach(function (fn) { fn(state); });
    }

    paint();
    setInterval(tick, state.tickMs);
  }

  // ---------- Helpers --------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---------- Init -----------------------------------------------------------
  function init() {
    document.querySelectorAll('.ladder-sim').forEach(function (el) {
      var ex = el.getAttribute('data-example');
      var syntax = el.getAttribute('data-syntax') || 'mit';
      buildSim(el, ex, syntax);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
