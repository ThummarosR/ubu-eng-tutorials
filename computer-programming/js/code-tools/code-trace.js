/* Computer Programming Tutorial — Code Trace Visualizer
 *
 * Steps through code line-by-line with variable state shown.
 * Traces are hand-authored as JSON since dynamic Python introspection in browser is heavy.
 *
 * Usage:
 *   <div class="code-trace" data-trace-id="grade-calc"></div>
 *
 * Traces live in window.TRACES (defined inline on page or in separate file).
 * Each trace: { code: ["line1", "line2", ...], steps: [{line: 0, vars: {x: 1}, output: ""}, ...] }
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatValue(v) {
    if (typeof v === 'string') return '"' + v + '"';
    if (Array.isArray(v)) return '[' + v.map(formatValue).join(', ') + ']';
    if (typeof v === 'object' && v !== null) {
      return '{' + Object.keys(v).map(function (k) {
        return '"' + k + '": ' + formatValue(v[k]);
      }).join(', ') + '}';
    }
    return String(v);
  }

  function enhance(root) {
    var traceId = root.dataset.traceId;
    var trace = (window.TRACES || {})[traceId];

    if (!trace) {
      root.innerHTML = '<div class="ct-error">❌ ไม่พบ trace ID: <code>' + traceId + '</code></div>';
      return;
    }

    var title = trace.title || 'Code Trace';
    var desc = trace.desc || '';

    root.innerHTML =
      '<div class="ct-head">' +
        '<div class="ct-title">🔎 ' + title + '</div>' +
        (desc ? '<div class="ct-desc">' + desc + '</div>' : '') +
      '</div>' +
      '<div class="ct-body">' +
        '<div class="ct-code-pane">' +
          '<div class="ct-pane-label">💻 Code</div>' +
          '<pre class="ct-code"></pre>' +
        '</div>' +
        '<div class="ct-state-pane">' +
          '<div class="ct-pane-label">📊 ตัวแปร</div>' +
          '<table class="ct-vars"><tbody></tbody></table>' +
          '<div class="ct-pane-label">📺 Output</div>' +
          '<pre class="ct-output"></pre>' +
        '</div>' +
      '</div>' +
      '<div class="ct-controls">' +
        '<button type="button" class="ct-btn ct-back">⏮ ก่อนหน้า</button>' +
        '<div class="ct-progress"><span class="ct-step-n">0</span> / <span class="ct-step-total">' + trace.steps.length + '</span></div>' +
        '<button type="button" class="ct-btn ct-next">ถัดไป ⏭</button>' +
        '<button type="button" class="ct-btn ct-reset">↺ Reset</button>' +
        '<button type="button" class="ct-btn ct-play">▶️ Auto Play</button>' +
      '</div>';

    var codeEl = root.querySelector('.ct-code');
    var varsEl = root.querySelector('.ct-vars tbody');
    var outputEl = root.querySelector('.ct-output');
    var stepNEl = root.querySelector('.ct-step-n');
    var backBtn = root.querySelector('.ct-back');
    var nextBtn = root.querySelector('.ct-next');
    var resetBtn = root.querySelector('.ct-reset');
    var playBtn = root.querySelector('.ct-play');

    // Render code with line numbers
    codeEl.innerHTML = trace.code.map(function (line, i) {
      return '<span class="ct-line" data-line="' + i + '">' +
        '<span class="ct-line-num">' + (i + 1) + '</span>' +
        '<span class="ct-line-code">' + escapeHtml(line) + '</span>' +
        '</span>';
    }).join('');

    var currentStep = 0;
    var playing = false;
    var playTimer = null;

    function render() {
      // Highlight current line
      root.querySelectorAll('.ct-line').forEach(function (el) { el.classList.remove('ct-line-active'); });
      if (currentStep > 0 && currentStep <= trace.steps.length) {
        var step = trace.steps[currentStep - 1];
        var lineEl = root.querySelector('.ct-line[data-line="' + step.line + '"]');
        if (lineEl) lineEl.classList.add('ct-line-active');
      }

      // Render variables (collected from all steps up to current)
      var allVars = {};
      for (var i = 0; i < currentStep; i++) {
        var s = trace.steps[i];
        if (s.vars) {
          Object.keys(s.vars).forEach(function (k) { allVars[k] = s.vars[k]; });
        }
      }
      varsEl.innerHTML = Object.keys(allVars).length === 0 ?
        '<tr><td colspan="2" class="ct-vars-empty">— ยังไม่มีตัวแปร —</td></tr>' :
        Object.keys(allVars).map(function (k) {
          return '<tr><td class="ct-var-name">' + k + '</td><td class="ct-var-val">' + escapeHtml(formatValue(allVars[k])) + '</td></tr>';
        }).join('');

      // Render output (concatenated from all steps)
      var allOutput = '';
      for (var j = 0; j < currentStep; j++) {
        var st = trace.steps[j];
        if (st.output) allOutput += st.output;
      }
      outputEl.textContent = allOutput || '(ยังไม่มี output)';

      // Step counter
      stepNEl.textContent = currentStep;

      // Button states
      backBtn.disabled = currentStep === 0;
      nextBtn.disabled = currentStep >= trace.steps.length;

      // Auto-play stop at end
      if (playing && currentStep >= trace.steps.length) stopPlay();
    }

    function next() {
      if (currentStep < trace.steps.length) {
        currentStep++;
        render();
      }
    }
    function back() {
      if (currentStep > 0) {
        currentStep--;
        render();
      }
    }
    function reset() {
      currentStep = 0;
      stopPlay();
      render();
    }
    function startPlay() {
      playing = true;
      playBtn.textContent = '⏸ Pause';
      playTimer = setInterval(next, 900);
    }
    function stopPlay() {
      playing = false;
      playBtn.textContent = '▶️ Auto Play';
      if (playTimer) { clearInterval(playTimer); playTimer = null; }
    }

    nextBtn.addEventListener('click', function () { stopPlay(); next(); });
    backBtn.addEventListener('click', function () { stopPlay(); back(); });
    resetBtn.addEventListener('click', reset);
    playBtn.addEventListener('click', function () { playing ? stopPlay() : startPlay(); });

    render();
  }

  function init() {
    document.querySelectorAll('.code-trace').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
