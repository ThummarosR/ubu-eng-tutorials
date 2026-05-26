/* Computer Programming Tutorial — Python Code Runner (Pyodide)
 *
 * Auto-enhances any element with class="python-runner" into an in-browser Python REPL:
 *   <div class="python-runner" data-inputs="42">
 *     print("hello", int(input()))
 *   </div>
 *
 * Features:
 *   - Code editor (textarea) + Run button + Output box
 *   - Pre-filled stdin via data-inputs="..." (newline-separated)
 *   - Pre-loaded packages via data-packages="pandas,numpy" (loaded on first run)
 *   - Reset to original code
 *   - Lazy-loads Pyodide on first run (shared across widgets)
 *   - Status indicator while Pyodide loads
 *
 * Pyodide is loaded from CDN; first run downloads ~10MB but is cached after.
 */
(function () {
  'use strict';

  var PYODIDE_VERSION = '0.26.4';
  var PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/pyodide.js';

  var pyodidePromise = null;

  function loadPyodideOnce() {
    if (pyodidePromise) return pyodidePromise;
    pyodidePromise = new Promise(function (resolve, reject) {
      // Inject Pyodide script
      if (window.loadPyodide) {
        window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/' })
          .then(resolve).catch(reject);
        return;
      }
      var s = document.createElement('script');
      s.src = PYODIDE_URL;
      s.onload = function () {
        window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/' })
          .then(resolve).catch(reject);
      };
      s.onerror = function () { reject(new Error('Failed to load Pyodide')); };
      document.head.appendChild(s);
    });
    return pyodidePromise;
  }

  // === Build setup code that wires input() to pre-filled inputs textarea ===
  function buildSetupCode(inputs) {
    var safe = inputs.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
    return [
      'import sys, builtins, io',
      '_inputs = """' + safe + '""".rstrip("\\n").split("\\n") if """' + safe + '""".strip() else []',
      '_input_iter = iter(_inputs)',
      'def _custom_input(prompt=""):',
      '    print(prompt, end="")',
      '    try:',
      '        val = next(_input_iter)',
      '    except StopIteration:',
      '        val = ""',
      '    print(val)',
      '    return val',
      'builtins.input = _custom_input',
      ''
    ].join('\n');
  }

  // === Enhance one runner ===
  function enhance(root) {
    var initialCode = root.textContent.trim();
    var initialInputs = root.dataset.inputs || '';
    var compact = root.dataset.compact === 'true';

    root.textContent = '';
    root.innerHTML =
      '<div class="pyr-toolbar">' +
        '<div class="pyr-title">🐍 Python Runner</div>' +
        '<div class="pyr-status">รอเริ่ม</div>' +
        '<div class="pyr-actions">' +
          '<button type="button" class="pyr-btn pyr-run">▶️ Run</button>' +
          '<button type="button" class="pyr-btn pyr-reset" title="คืนค่า code เดิม">↺ Reset</button>' +
        '</div>' +
      '</div>' +
      '<div class="pyr-grid' + (compact ? ' pyr-grid-compact' : '') + '">' +
        '<div class="pyr-col pyr-col-code">' +
          '<label class="pyr-label">💻 Code</label>' +
          '<textarea class="pyr-code" spellcheck="false"></textarea>' +
        '</div>' +
        (initialInputs ?
          '<div class="pyr-col pyr-col-stdin">' +
            '<label class="pyr-label">⌨️ Input (input() จะอ่านจากที่นี่)</label>' +
            '<textarea class="pyr-stdin" spellcheck="false"></textarea>' +
          '</div>' : '') +
        '<div class="pyr-col pyr-col-output">' +
          '<label class="pyr-label">📺 Output</label>' +
          '<pre class="pyr-output"></pre>' +
        '</div>' +
      '</div>';

    var codeEl = root.querySelector('.pyr-code');
    var stdinEl = root.querySelector('.pyr-stdin');
    var outputEl = root.querySelector('.pyr-output');
    var statusEl = root.querySelector('.pyr-status');
    var runBtn = root.querySelector('.pyr-run');
    var resetBtn = root.querySelector('.pyr-reset');

    codeEl.value = initialCode;
    if (stdinEl) stdinEl.value = initialInputs;

    function setStatus(text, cls) {
      statusEl.textContent = text;
      statusEl.className = 'pyr-status' + (cls ? ' pyr-status-' + cls : '');
    }

    async function run() {
      var code = codeEl.value;
      var inputs = stdinEl ? stdinEl.value : '';
      var packages = (root.dataset.packages || '').split(',')
        .map(function (p) { return p.trim(); }).filter(Boolean);

      runBtn.disabled = true;
      outputEl.textContent = '';
      outputEl.classList.remove('pyr-output-error');
      setStatus('กำลังโหลด Pyodide…', 'loading');

      try {
        var py = await loadPyodideOnce();

        if (packages.length > 0) {
          setStatus('กำลังโหลด ' + packages.join(', ') + '… (ครั้งแรกอาจช้า)', 'loading');
          try {
            await py.loadPackage(packages);
          } catch (pkgErr) {
            outputEl.textContent = 'โหลด package ไม่สำเร็จ: ' + (pkgErr.message || pkgErr);
            outputEl.classList.add('pyr-output-error');
            setStatus('❌ โหลด package ไม่ได้', 'err');
            runBtn.disabled = false;
            return;
          }
        }

        setStatus('กำลังรัน…', 'loading');

        var output = '';
        py.setStdout({ batched: function (msg) { output += msg + '\n'; } });
        py.setStderr({ batched: function (msg) { output += msg + '\n'; } });

        var fullCode = buildSetupCode(inputs) + '\n' + code;

        try {
          await py.runPythonAsync(fullCode);
          setStatus('✅ รันสำเร็จ', 'ok');
        } catch (e) {
          output += String(e.message || e);
          outputEl.classList.add('pyr-output-error');
          setStatus('❌ Error', 'err');
        }

        outputEl.textContent = output || '(ไม่มี output)';
      } catch (e) {
        outputEl.textContent = 'โหลด Pyodide ไม่สำเร็จ: ' + (e.message || e) +
          '\n\nตรวจสอบว่ามี internet ในการโหลดครั้งแรก (ขนาด ~10MB · cache หลังจากนั้น)';
        outputEl.classList.add('pyr-output-error');
        setStatus('❌ โหลด Pyodide ไม่ได้', 'err');
      } finally {
        runBtn.disabled = false;
      }
    }

    runBtn.addEventListener('click', run);

    resetBtn.addEventListener('click', function () {
      codeEl.value = initialCode;
      if (stdinEl) stdinEl.value = initialInputs;
      outputEl.textContent = '';
      outputEl.classList.remove('pyr-output-error');
      setStatus('รอเริ่ม');
    });

    // Support Ctrl+Enter to run
    codeEl.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });
  }

  function init() {
    var runners = document.querySelectorAll('.python-runner');
    if (runners.length === 0) return;
    runners.forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
