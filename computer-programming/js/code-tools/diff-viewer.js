/* Computer Programming Tutorial — Side-by-Side Diff Viewer
 *
 * Shows "before" code next to "after" code with added/removed/changed lines highlighted.
 *
 * Usage:
 *   <div class="diff-viewer" data-title="เพิ่ม case I">
 *     <div class="diff-before">...before code...</div>
 *     <div class="diff-after">...after code...</div>
 *   </div>
 *
 * Simple line-by-line LCS-ish diff. Good for small <50 line snippets.
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Compute a simple LCS-based diff at line granularity.
  // Returns array of {type: 'same'|'add'|'del'|'mod', before, after}
  function diffLines(before, after) {
    var a = before.split('\n');
    var b = after.split('\n');
    var n = a.length, m = b.length;

    // LCS DP table
    var dp = [];
    for (var i = 0; i <= n; i++) {
      dp.push(new Array(m + 1).fill(0));
    }
    for (i = 1; i <= n; i++) {
      for (var j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Backtrack to build diff
    var ops = [];
    i = n; j = m;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        ops.unshift({ type: 'same', before: a[i - 1], after: b[j - 1], aLine: i, bLine: j });
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        ops.unshift({ type: 'del', before: a[i - 1], after: null, aLine: i, bLine: null });
        i--;
      } else {
        ops.unshift({ type: 'add', before: null, after: b[j - 1], aLine: null, bLine: j });
        j--;
      }
    }
    while (i > 0) { ops.unshift({ type: 'del', before: a[i - 1], after: null, aLine: i }); i--; }
    while (j > 0) { ops.unshift({ type: 'add', before: null, after: b[j - 1], bLine: j }); j--; }

    return ops;
  }

  function enhance(root) {
    var title = root.dataset.title || 'Code Diff';
    var beforeEl = root.querySelector('.diff-before');
    var afterEl = root.querySelector('.diff-after');

    if (!beforeEl || !afterEl) {
      root.innerHTML = '<div class="dv-error">❌ ต้องมี <code>.diff-before</code> และ <code>.diff-after</code> ใน element</div>';
      return;
    }

    var before = beforeEl.textContent.replace(/^\n+|\n+$/g, '');
    var after = afterEl.textContent.replace(/^\n+|\n+$/g, '');
    var ops = diffLines(before, after);

    // Count changes
    var added = ops.filter(function (o) { return o.type === 'add'; }).length;
    var removed = ops.filter(function (o) { return o.type === 'del'; }).length;

    root.innerHTML =
      '<div class="dv-head">' +
        '<div class="dv-title">📋 ' + title + '</div>' +
        '<div class="dv-stats">' +
          '<span class="dv-stat dv-stat-add">+' + added + '</span>' +
          '<span class="dv-stat dv-stat-del">−' + removed + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="dv-grid">' +
        '<div class="dv-side dv-side-before">' +
          '<div class="dv-side-label">❌ ก่อนแก้ (Before)</div>' +
          '<pre class="dv-pre"></pre>' +
        '</div>' +
        '<div class="dv-side dv-side-after">' +
          '<div class="dv-side-label">✅ หลังแก้ (After)</div>' +
          '<pre class="dv-pre"></pre>' +
        '</div>' +
      '</div>';

    var beforePre = root.querySelector('.dv-side-before .dv-pre');
    var afterPre = root.querySelector('.dv-side-after .dv-pre');

    // Render before pane
    beforePre.innerHTML = ops.map(function (op) {
      if (op.type === 'same') {
        return '<span class="dv-line dv-line-same"><span class="dv-num">' + op.aLine + '</span>' + escapeHtml(op.before) + '</span>';
      } else if (op.type === 'del') {
        return '<span class="dv-line dv-line-del"><span class="dv-num">' + op.aLine + '</span>' + escapeHtml(op.before) + '</span>';
      } else if (op.type === 'add') {
        // Empty placeholder row to keep alignment
        return '<span class="dv-line dv-line-empty"><span class="dv-num">·</span>&nbsp;</span>';
      }
      return '';
    }).join('');

    // Render after pane
    afterPre.innerHTML = ops.map(function (op) {
      if (op.type === 'same') {
        return '<span class="dv-line dv-line-same"><span class="dv-num">' + op.bLine + '</span>' + escapeHtml(op.after) + '</span>';
      } else if (op.type === 'add') {
        return '<span class="dv-line dv-line-add"><span class="dv-num">' + op.bLine + '</span>' + escapeHtml(op.after) + '</span>';
      } else if (op.type === 'del') {
        return '<span class="dv-line dv-line-empty"><span class="dv-num">·</span>&nbsp;</span>';
      }
      return '';
    }).join('');
  }

  function init() {
    document.querySelectorAll('.diff-viewer').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
