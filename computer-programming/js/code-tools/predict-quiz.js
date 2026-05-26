/* Computer Programming Tutorial — Predict-the-Output Quiz
 *
 * Shows code, hides expected output, asks student to predict, reveals answer + explanation.
 *
 * Usage:
 *   <div class="predict-quiz" data-question="โปรแกรมนี้พิมพ์อะไร?">
 *     <pre class="pq-code">x = 5
 * y = 3
 * print(x + y)</pre>
 *     <pre class="pq-answer">8</pre>
 *     <div class="pq-explain">x = 5, y = 3 → 5 + 3 = 8</div>
 *   </div>
 *
 * Student types their guess, clicks Check, then sees: correct/incorrect + actual + explanation.
 */
(function () {
  'use strict';

  function normalizeOutput(s) {
    return String(s).trim().replace(/\s+$/gm, '');
  }

  function enhance(root) {
    var question = root.dataset.question || 'โปรแกรมนี้พิมพ์อะไร?';
    var codeEl = root.querySelector('.pq-code');
    var answerEl = root.querySelector('.pq-answer');
    var explainEl = root.querySelector('.pq-explain');

    if (!codeEl || !answerEl) {
      root.innerHTML = '<div class="pq-error">❌ ต้องมี <code>.pq-code</code> และ <code>.pq-answer</code></div>';
      return;
    }

    var code = codeEl.textContent.replace(/^\n+|\n+$/g, '');
    var answer = answerEl.textContent.replace(/^\n+|\n+$/g, '');
    var explain = explainEl ? explainEl.innerHTML : '';

    root.innerHTML =
      '<div class="pq-head">' +
        '<div class="pq-badge">🎲 Predict the Output</div>' +
        '<div class="pq-question">' + question + '</div>' +
      '</div>' +
      '<pre class="pq-code-display"></pre>' +
      '<div class="pq-input-row">' +
        '<label class="pq-label">คำตอบของคุณ:</label>' +
        '<textarea class="pq-guess" placeholder="พิมพ์ output ที่คิดว่าจะได้ (1 บรรทัดต่อ print)" spellcheck="false"></textarea>' +
      '</div>' +
      '<div class="pq-actions">' +
        '<button type="button" class="pq-btn pq-check">🔍 ตรวจคำตอบ</button>' +
        '<button type="button" class="pq-btn pq-reveal">👀 เฉลย (ดูเลย)</button>' +
        '<button type="button" class="pq-btn pq-reset">↺ Reset</button>' +
      '</div>' +
      '<div class="pq-result" style="display:none"></div>';

    var codeDisplay = root.querySelector('.pq-code-display');
    var guess = root.querySelector('.pq-guess');
    var checkBtn = root.querySelector('.pq-check');
    var revealBtn = root.querySelector('.pq-reveal');
    var resetBtn = root.querySelector('.pq-reset');
    var result = root.querySelector('.pq-result');

    codeDisplay.textContent = code;

    function showResult(isCorrect, mode) {
      result.style.display = '';
      var html = '';
      if (mode === 'reveal') {
        html = '<div class="pq-msg pq-msg-info">👀 <strong>เฉลย:</strong></div>';
      } else if (isCorrect) {
        html = '<div class="pq-msg pq-msg-ok">✅ <strong>ถูกต้อง!</strong> คุณอ่าน code ออกแล้ว</div>';
      } else {
        html = '<div class="pq-msg pq-msg-err">❌ <strong>ยังไม่ตรง</strong> ลองอ่าน code อีกครั้งก่อนดูเฉลย</div>';
      }

      html += '<div class="pq-answer-row">' +
        '<div class="pq-answer-label">📺 Output ที่ถูกต้อง:</div>' +
        '<pre class="pq-actual">' + escapeHtml(answer) + '</pre>' +
        '</div>';

      if (explain) {
        html += '<div class="pq-explain-row">' +
          '<div class="pq-explain-label">💡 ทำไม:</div>' +
          '<div class="pq-explain-content">' + explain + '</div>' +
          '</div>';
      }

      result.innerHTML = html;
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    checkBtn.addEventListener('click', function () {
      var userGuess = normalizeOutput(guess.value);
      var correctAns = normalizeOutput(answer);
      showResult(userGuess === correctAns, 'check');
    });

    revealBtn.addEventListener('click', function () { showResult(false, 'reveal'); });

    resetBtn.addEventListener('click', function () {
      guess.value = '';
      result.style.display = 'none';
      result.innerHTML = '';
    });
  }

  function init() {
    document.querySelectorAll('.predict-quiz').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
