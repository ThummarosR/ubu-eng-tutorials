/* Computer Programming Tutorial — Flowchart Semantic Validator
 *
 * Parses Mermaid flowchart syntax and checks for semantic correctness:
 *   - Start has exactly 1 outgoing arrow, 0 incoming
 *   - End has 0 outgoing, ≥1 incoming
 *   - Decision (rhombus) has ≥2 outgoing arrows
 *   - Process/IO has ≥1 outgoing (unless it's terminal)
 *   - No orphan nodes
 *   - No decisions with single outcome
 *
 * Enhances any element with class="flowchart-validator".
 */
(function () {
  'use strict';

  // === Mermaid flowchart shape detection ===
  // We look for: id[label], id{label}, id([label]), id[/label/], id((label))
  // Patterns matched in order of specificity
  var SHAPE_PATTERNS = [
    { re: /\(\(([^)]+)\)\)/,  type: 'connector', shape: '((label))' },   // ((Connector))
    { re: /\(\[([^\]]+)\]\)/, type: 'startend',  shape: '([label])' },    // ([Start/End]) stadium
    { re: /\[\/([^\/]+)\/\]/, type: 'io',        shape: '[/label/]' },    // [/IO/] parallelogram
    { re: /\{([^}]+)\}/,      type: 'decision',  shape: '{label}' },      // {Decision}
    { re: /\[([^\]]+)\]/,     type: 'process',   shape: '[label]' }       // [Process]
  ];

  // Match: nodeId<shape>(label)  e.g. A[Process]  B{Decide?}  C([Start])
  // Edges: A --> B   A -->|label| B   A --- B (we treat as directed)
  var EDGE_RE = /(\w+(?:[\[\(\{][^\]\)\}]*[\]\)\}])?)\s*(?:--+>|--+\.+>|==+>)\s*(?:\|([^\|]+)\|\s*)?(\w+(?:[\[\(\{][^\]\)\}]*[\]\)\}])?)/g;

  function parseNodeId(token) {
    // Extract leading identifier (alphanumerics, before any bracket)
    var m = token.match(/^(\w+)/);
    return m ? m[1] : token;
  }

  function detectShape(token) {
    for (var i = 0; i < SHAPE_PATTERNS.length; i++) {
      var p = SHAPE_PATTERNS[i];
      var m = token.match(p.re);
      if (m) return { type: p.type, label: m[1].trim() };
    }
    return null;
  }

  function parse(code) {
    var lines = code.split('\n');
    var nodes = {};   // id -> { type, label }
    var edges = [];   // {from, to, label}

    // First pass: pick up all node declarations (with shapes)
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.startsWith('%%') || line.startsWith('//')) return;
      // skip directive lines (flowchart, subgraph, end, classDef, etc.)
      if (/^(flowchart|graph|subgraph|end|classDef|class|style|linkStyle|click)\b/i.test(line)) return;

      // Find every "id<shape>" token within the line
      // Token shape: id followed by ( or [ or { and content
      var tokenRe = /(\w+)((?:\(\([^)]+\)\))|(?:\(\[[^\]]+\]\))|(?:\[\/[^\/]+\/\])|(?:\{[^}]+\})|(?:\[[^\]]+\]))/g;
      var m;
      while ((m = tokenRe.exec(line)) !== null) {
        var id = m[1];
        var shapeStr = m[2];
        var shape = detectShape(shapeStr);
        if (shape && !nodes[id]) {
          nodes[id] = shape;
        }
      }
    });

    // Second pass: parse edges
    var fullCode = code;
    EDGE_RE.lastIndex = 0;
    var em;
    while ((em = EDGE_RE.exec(fullCode)) !== null) {
      var fromTok = em[1];
      var label = em[2] ? em[2].trim() : null;
      var toTok = em[3];
      var fromId = parseNodeId(fromTok);
      var toId = parseNodeId(toTok);

      // Auto-register nodes that appear in edges but had no shape declared
      // — treat as 'process' by default (no shape = simple node = process)
      if (!nodes[fromId]) {
        var s = detectShape(fromTok);
        nodes[fromId] = s || { type: 'process', label: fromId };
      }
      if (!nodes[toId]) {
        var s2 = detectShape(toTok);
        nodes[toId] = s2 || { type: 'process', label: toId };
      }
      edges.push({ from: fromId, to: toId, label: label });
    }

    return { nodes: nodes, edges: edges };
  }

  // === Semantic checks ===
  function validate(graph) {
    var issues = [];
    var nodes = graph.nodes;
    var edges = graph.edges;

    if (Object.keys(nodes).length === 0) {
      issues.push({
        level: 'error',
        msg: 'ไม่พบ node เลย — ตรวจว่าเป็น Mermaid flowchart ที่ถูก syntax มั้ย'
      });
      return issues;
    }

    // Build adjacency
    var outCount = {};
    var inCount = {};
    Object.keys(nodes).forEach(function (id) {
      outCount[id] = 0;
      inCount[id] = 0;
    });
    edges.forEach(function (e) {
      outCount[e.from] = (outCount[e.from] || 0) + 1;
      inCount[e.to] = (inCount[e.to] || 0) + 1;
    });

    // Classify start/end nodes
    var starts = [];
    var ends = [];
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (n.type === 'startend') {
        // Heuristic: if it has 0 incoming → start; 0 outgoing → end
        if (inCount[id] === 0 && outCount[id] > 0) starts.push(id);
        else if (outCount[id] === 0 && inCount[id] > 0) ends.push(id);
        else if (inCount[id] === 0 && outCount[id] === 0) {
          issues.push({ level: 'error', msg: 'Start/End node "' + id + '" ไม่เชื่อมกับใครเลย — orphan' });
        }
      }
    });

    // Check 1: must have at least 1 start, 1 end
    if (starts.length === 0) {
      issues.push({ level: 'warn', msg: 'ไม่พบ Start node (รูปวงรี <code>([...])</code>) — ทุก flowchart ควรมีจุดเริ่มชัดเจน' });
    }
    if (ends.length === 0) {
      issues.push({ level: 'warn', msg: 'ไม่พบ End node — ทุก flowchart ควรมีจุดจบ' });
    }

    // Check 2: Start has exactly 1 outgoing, 0 incoming
    starts.forEach(function (id) {
      if (outCount[id] !== 1) {
        issues.push({ level: 'warn', msg: 'Start "' + id + '" มีลูกศรออก ' + outCount[id] + ' เส้น — ปกติ Start ควรมีลูกศรออก 1 เส้น' });
      }
      if (inCount[id] > 0) {
        issues.push({ level: 'error', msg: 'Start "' + id + '" มีลูกศรเข้า ' + inCount[id] + ' เส้น — Start ไม่ควรมีลูกศรเข้า' });
      }
    });

    // Check 3: End has 0 outgoing, ≥1 incoming
    ends.forEach(function (id) {
      if (outCount[id] > 0) {
        issues.push({ level: 'error', msg: 'End "' + id + '" มีลูกศรออก ' + outCount[id] + ' เส้น — End ไม่ควรมีลูกศรออก' });
      }
    });

    // Check 4: Decision must have ≥2 outgoing
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (n.type === 'decision') {
        if (outCount[id] < 2) {
          issues.push({
            level: 'error',
            msg: 'Decision "' + id + '" (' + n.label + ') มีลูกศรออก ' + outCount[id] + ' เส้น — Decision ต้องมีอย่างน้อย 2 ทาง (Yes/No)'
          });
        }
        // Check 4b: edges from decision should have labels
        var fromDec = edges.filter(function (e) { return e.from === id; });
        var unlabeled = fromDec.filter(function (e) { return !e.label; });
        if (unlabeled.length > 0 && fromDec.length >= 2) {
          issues.push({
            level: 'warn',
            msg: 'Decision "' + id + '" มีลูกศรออกที่ไม่ระบุ label ' + unlabeled.length + ' เส้น — ควรใส่ <code>|Yes|</code> / <code>|No|</code>'
          });
        }
      }
    });

    // Check 5: Process / IO should have ≥1 outgoing (unless it's terminal)
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (n.type === 'process' || n.type === 'io') {
        if (outCount[id] === 0 && inCount[id] > 0) {
          issues.push({
            level: 'warn',
            msg: '"' + id + '" (' + n.label + ') ไม่มีลูกศรออก — ถ้าเป็นจุดจบ ควรเปลี่ยนเป็น End node <code>([...])</code>'
          });
        }
      }
    });

    // Check 6: orphan nodes (no in, no out)
    Object.keys(nodes).forEach(function (id) {
      if (inCount[id] === 0 && outCount[id] === 0) {
        issues.push({
          level: 'error',
          msg: '"' + id + '" (' + nodes[id].label + ') เป็น orphan — ไม่เชื่อมกับ node อื่นเลย'
        });
      }
    });

    // Check 7: unreachable nodes (no incoming + not a start)
    Object.keys(nodes).forEach(function (id) {
      if (inCount[id] === 0 && outCount[id] > 0 && nodes[id].type !== 'startend') {
        issues.push({
          level: 'warn',
          msg: '"' + id + '" (' + nodes[id].label + ') ไม่มีลูกศรเข้า — น่าจะตั้งใจเป็น Start แต่ใช้ shape <code>' + nodes[id].label + '</code> · ลองเปลี่ยนเป็น <code>([Start])</code>'
        });
      }
    });

    return issues;
  }

  // === UI enhancer ===
  function enhance(root) {
    var defaultCode = root.textContent.trim() ||
      'flowchart TD\n    A([Start]) --> B[Process]\n    B --> C{OK?}\n    C -->|Yes| D([End])';
    root.textContent = '';

    root.innerHTML =
      '<div class="fcv-head">' +
        '<div class="fcv-title">🔍 Flowchart Semantic Validator</div>' +
        '<div class="fcv-desc">วาง Mermaid flowchart syntax แล้วกด <strong>ตรวจ</strong> — ระบบเช็คให้ว่า block แต่ละชนิดใช้ถูกมั้ย</div>' +
      '</div>' +
      '<textarea class="fcv-textarea" spellcheck="false"></textarea>' +
      '<div class="fcv-actions">' +
        '<button type="button" class="fcv-btn fcv-validate">🔍 ตรวจ</button>' +
        '<button type="button" class="fcv-btn fcv-clear">🗑 Clear</button>' +
      '</div>' +
      '<div class="fcv-results"></div>';

    var textarea = root.querySelector('.fcv-textarea');
    var validateBtn = root.querySelector('.fcv-validate');
    var clearBtn = root.querySelector('.fcv-clear');
    var results = root.querySelector('.fcv-results');

    textarea.value = defaultCode;

    function runValidate() {
      var code = textarea.value.trim();
      if (!code) {
        results.innerHTML = '<div class="fcv-msg fcv-info">ใส่ Mermaid code ก่อน</div>';
        return;
      }
      try {
        var graph = parse(code);
        var issues = validate(graph);

        var summary = '<div class="fcv-summary">' +
          '<span class="fcv-stat">📦 Nodes: <b>' + Object.keys(graph.nodes).length + '</b></span>' +
          '<span class="fcv-stat">➡️ Edges: <b>' + graph.edges.length + '</b></span>' +
          '<span class="fcv-stat">⚠️ Issues: <b>' + issues.length + '</b></span>' +
        '</div>';

        if (issues.length === 0) {
          results.innerHTML = summary +
            '<div class="fcv-msg fcv-ok">✅ ไม่พบปัญหา — flowchart นี้ใช้สัญลักษณ์ถูกต้องตามหลัก semantic</div>';
        } else {
          var html = summary + '<div class="fcv-issues">';
          issues.forEach(function (iss) {
            var cls = iss.level === 'error' ? 'fcv-msg fcv-err' : 'fcv-msg fcv-warn';
            var icon = iss.level === 'error' ? '❌' : '⚠️';
            html += '<div class="' + cls + '">' + icon + ' ' + iss.msg + '</div>';
          });
          html += '</div>';

          // Show node breakdown
          html += '<details class="fcv-nodes"><summary>📊 ดู node breakdown</summary>';
          html += '<table class="fcv-table"><thead><tr><th>ID</th><th>Type</th><th>Label</th><th>In</th><th>Out</th></tr></thead><tbody>';
          Object.keys(graph.nodes).forEach(function (id) {
            var n = graph.nodes[id];
            var inC = graph.edges.filter(function (e) { return e.to === id; }).length;
            var outC = graph.edges.filter(function (e) { return e.from === id; }).length;
            html += '<tr><td><code>' + id + '</code></td><td>' + n.type + '</td><td>' + (n.label || '') + '</td><td>' + inC + '</td><td>' + outC + '</td></tr>';
          });
          html += '</tbody></table></details>';

          results.innerHTML = html;
        }
      } catch (e) {
        results.innerHTML = '<div class="fcv-msg fcv-err">❌ Parse error: ' + (e.message || String(e)) + '</div>';
      }
    }

    validateBtn.addEventListener('click', runValidate);
    clearBtn.addEventListener('click', function () {
      textarea.value = '';
      results.innerHTML = '';
    });

    // Auto-run once with default
    runValidate();
  }

  function init() {
    document.querySelectorAll('.flowchart-validator').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
