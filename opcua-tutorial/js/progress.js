/* PLC Automation Tutorial — Step checklist + progress tracker
 *
 * Auto-enhances every <ol class="steps"> on the page:
 *   - Makes each step's numbered badge clickable → toggles "completed" state
 *   - Inserts a progress bar above each <ol class="steps">
 *   - Persists per-page progress in localStorage
 *   - Shows page-level summary in a floating widget (bottom-right)
 *
 * No dependencies. Vanilla JS. Works offline.
 */
(function () {
  'use strict';

  // localStorage key for this page
  var PAGE_KEY = 'plc-progress:' + (location.pathname.split('/').pop() || 'index.html');

  // Read current page state
  function loadState() {
    try { return JSON.parse(localStorage.getItem(PAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(PAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ----- Build a stable key for each step from its position -----
  function stepKey(sectionIdx, stepIdx) {
    return 's' + sectionIdx + 'i' + stepIdx;
  }

  // ----- Enhance one .steps list -----
  function enhanceSteps(ol, sectionIdx, state) {
    var items = ol.querySelectorAll(':scope > li');
    if (items.length === 0) return null;

    // Insert progress bar above this ol
    var bar = document.createElement('div');
    bar.className = 'steps-progress';
    bar.innerHTML =
      '<div class="steps-progress-track"><div class="steps-progress-fill"></div></div>' +
      '<div class="steps-progress-meta">' +
      '<span class="steps-progress-count">0 / ' + items.length + '</span>' +
      '<button type="button" class="steps-progress-reset" title="ล้าง progress ของกลุ่มนี้">รีเซ็ต</button>' +
      '</div>';
    ol.parentNode.insertBefore(bar, ol);

    var fill = bar.querySelector('.steps-progress-fill');
    var count = bar.querySelector('.steps-progress-count');
    var resetBtn = bar.querySelector('.steps-progress-reset');

    function refresh() {
      var done = 0;
      items.forEach(function (li, i) {
        var key = stepKey(sectionIdx, i);
        if (state[key]) {
          li.classList.add('step-done');
          done++;
        } else {
          li.classList.remove('step-done');
        }
      });
      var pct = items.length ? Math.round((done / items.length) * 100) : 0;
      fill.style.width = pct + '%';
      count.textContent = done + ' / ' + items.length;
      bar.classList.toggle('all-done', done === items.length && items.length > 0);
      updatePageSummary();
    }

    items.forEach(function (li, i) {
      // Make the numbered badge clickable. We add a transparent button overlay on top
      // of the existing ::before pseudo (which is the gradient circle with the number).
      var hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'step-toggle';
      hit.setAttribute('aria-label', 'Mark step ' + (i + 1) + ' as done');
      hit.addEventListener('click', function (e) {
        e.preventDefault();
        var key = stepKey(sectionIdx, i);
        state[key] = !state[key];
        saveState(state);
        refresh();
      });
      li.appendChild(hit);
    });

    resetBtn.addEventListener('click', function () {
      items.forEach(function (li, i) { delete state[stepKey(sectionIdx, i)]; });
      saveState(state);
      refresh();
    });

    refresh();
    return { items: items, refresh: refresh };
  }

  // ----- Page-level summary widget (bottom-right floating pill) -----
  var summaryEl = null;
  function ensureSummary() {
    if (summaryEl) return summaryEl;
    summaryEl = document.createElement('div');
    summaryEl.className = 'page-progress-summary';
    summaryEl.innerHTML =
      '<div class="pps-label">ความคืบหน้า</div>' +
      '<div class="pps-bar"><div class="pps-fill"></div></div>' +
      '<div class="pps-count">0 / 0</div>';
    document.body.appendChild(summaryEl);
    return summaryEl;
  }
  function updatePageSummary() {
    var allItems = document.querySelectorAll('ol.steps > li');
    if (allItems.length === 0) {
      if (summaryEl) summaryEl.style.display = 'none';
      return;
    }
    var done = document.querySelectorAll('ol.steps > li.step-done').length;
    var pct = Math.round((done / allItems.length) * 100);
    var el = ensureSummary();
    el.style.display = '';
    el.querySelector('.pps-fill').style.width = pct + '%';
    el.querySelector('.pps-count').textContent = done + ' / ' + allItems.length;
    el.classList.toggle('all-done', done === allItems.length);
  }

  // ----- Init -----
  function init() {
    var state = loadState();
    var stepLists = document.querySelectorAll('ol.steps');
    if (stepLists.length === 0) return;
    stepLists.forEach(function (ol, idx) { enhanceSteps(ol, idx, state); });
    updatePageSummary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
