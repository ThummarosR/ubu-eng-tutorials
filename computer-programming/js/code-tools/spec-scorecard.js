/* Computer Programming Tutorial — Spec Quality Scorecard
 *
 * Auto-enhances any element with class="spec-scorecard" into an interactive checker.
 * Scans pasted spec text against 8 criteria using heuristics (keywords + substance).
 *
 * Usage:
 *   <div class="spec-scorecard" data-prefill="...optional sample spec..."></div>
 */
(function () {
  'use strict';

  // === 8 Criteria ===
  // Each criterion: {key, label, headerPatterns, hints, check(text)}
  var CRITERIA = [
    {
      key: 'problem',
      label: '1. ระบุ "ปัญหา" ชัด',
      desc: 'มีคำว่า ปัญหา/Problem/เป้าหมาย และอธิบาย ≥ 20 ตัวอักษร',
      check: function (lines) {
        var idx = findHeader(lines, ['ปัญหา', 'Problem', 'เป้าหมาย', 'Goal', 'goal', 'problem']);
        if (idx < 0) return { pass: false, msg: 'ขาด section "ปัญหา:" / "Problem:" / "เป้าหมาย:"' };
        var body = collectBody(lines, idx);
        if (body.length < 20) return { pass: false, msg: 'ส่วน "ปัญหา" สั้นเกินไป (' + body.length + ' ตัวอักษร) — อธิบายให้ละเอียดกว่านี้' };
        return { pass: true, msg: 'ปัญหาระบุชัด ' + body.length + ' ตัวอักษร' };
      }
    },
    {
      key: 'users',
      label: '2. ระบุ "ใครเดือดร้อน" (User)',
      desc: 'มี role ที่เจาะจง — TA, อาจารย์, นักศึกษาปี X, พ่อค้า, …',
      check: function (lines, fullText) {
        var hasUser = /ผู้ใช้|user:|User:|ใครเดือดร้อน|ใครได้ประโยชน์|role/i.test(fullText);
        var rolePattern = /(TA|อาจารย์|นักศึกษา|พ่อค้า|ลูกค้า|admin|staff|student|teacher|user|operator|engineer|technician)/i;
        var hasRole = rolePattern.test(fullText);
        if (!hasUser && !hasRole) return { pass: false, msg: 'ไม่ระบุใครเป็น user — ต้องบอก role ที่เจาะจง' };
        if (!hasRole) return { pass: false, msg: 'มี section user แต่ไม่บอก role เจาะจง' };
        return { pass: true, msg: 'ระบุ user role ชัด' };
      }
    },
    {
      key: 'input',
      label: '3. ระบุ Input + type',
      desc: 'มี Input section + field มี type หรือตัวอย่าง',
      check: function (lines, fullText) {
        var idx = findHeader(lines, ['Input:', 'input:', 'รับเข้า', 'Inputs']);
        if (idx < 0) return { pass: false, msg: 'ขาด section "Input:"' };
        var body = collectBody(lines, idx);
        // Bonus: contains type words or example values
        var hasType = /(int|float|str|string|bool|list|dict|number|ตัวเลข|ทศนิยม|ข้อความ)/i.test(body);
        var hasExample = /(เช่น|example|ตัวอย่าง|e\.g\.)/i.test(body) || /\d/.test(body);
        if (body.length < 10) return { pass: false, msg: 'Input section สั้นเกิน — ใส่ field name อย่างน้อย' };
        if (!hasType && !hasExample) return { pass: false, msg: 'Input ไม่มี type หรือตัวอย่าง — ระบุว่าเป็น int/str/float ฯลฯ' };
        return { pass: true, msg: 'Input ระบุครบ' + (hasType ? ' + type' : '') + (hasExample ? ' + example' : '') };
      }
    },
    {
      key: 'output',
      label: '4. ระบุ Output',
      desc: 'มี Output section อธิบายว่าแสดง/คืนค่าอะไร',
      check: function (lines, fullText) {
        var idx = findHeader(lines, ['Output:', 'output:', 'ผลลัพธ์', 'แสดง:', 'Returns', 'returns']);
        if (idx < 0) return { pass: false, msg: 'ขาด section "Output:"' };
        var body = collectBody(lines, idx);
        if (body.length < 10) return { pass: false, msg: 'Output section สั้นเกิน — บอกว่าแสดงอะไร' };
        return { pass: true, msg: 'Output ระบุชัด' };
      }
    },
    {
      key: 'rules',
      label: '5. มี Rules / Logic',
      desc: 'มี section Rules/Logic + เห็น if-then patterns',
      check: function (lines, fullText) {
        var idx = findHeader(lines, ['Rules:', 'rules:', 'กฎ', 'เงื่อนไข', 'Logic:', 'logic:']);
        var hasIfThen = /(if|ถ้า|when|เมื่อ).+(then|→|=&gt;|=>|จะ|ให้)/i.test(fullText);
        if (idx < 0 && !hasIfThen) return { pass: false, msg: 'ขาด Rules section หรือ if-then logic' };
        if (idx < 0 && hasIfThen) return { pass: 'warn', msg: 'ไม่มี Rules header แต่มี if-then ในข้อความ — ดีกว่านี้ถ้ามี header แยก' };
        var body = collectBody(lines, idx);
        if (body.length < 10) return { pass: false, msg: 'Rules section สั้นเกิน' };
        return { pass: true, msg: 'Rules มี logic ชัด' };
      }
    },
    {
      key: 'success',
      label: '6. Success Criteria (testable)',
      desc: 'มีเกณฑ์ที่วัดได้ — มีตัวเลข หรือ test case',
      check: function (lines, fullText) {
        var idx = findHeader(lines, ['Success', 'success', 'สำเร็จ', 'Acceptance', 'acceptance']);
        if (idx < 0) return { pass: false, msg: 'ขาด section "Success:" / "เกณฑ์สำเร็จ"' };
        var body = collectBody(lines, idx);
        var hasMeasurable = /\d/.test(body) || /(→|=&gt;|=>)/.test(body);
        if (body.length < 10) return { pass: false, msg: 'Success section สั้นเกิน' };
        if (!hasMeasurable) return { pass: 'warn', msg: 'ไม่เห็นตัวเลข / test case ที่วัดได้ — เพิ่มเกณฑ์เป็นตัวเลขจะดีกว่า' };
        return { pass: true, msg: 'Success มีเกณฑ์ที่วัดได้' };
      }
    },
    {
      key: 'nongoals',
      label: '7. Non-goals (สิ่งที่ "ไม่" ทำ)',
      desc: 'ระบุชัดว่า "ยังไม่ทำ" อะไร — ป้องกัน scope creep',
      check: function (lines, fullText) {
        var idx = findHeader(lines, ['Non-goals', 'non-goals', 'ไม่ทำ', 'ไม่รวม', 'out of scope']);
        if (idx < 0) return { pass: false, msg: 'ขาด Non-goals — AI จะ over-build ถ้าไม่บอกว่า "ไม่ทำอะไร"' };
        var body = collectBody(lines, idx);
        if (body.length < 10) return { pass: 'warn', msg: 'มี Non-goals แต่ว่างเปล่า' };
        return { pass: true, msg: 'มี Non-goals ป้องกัน scope creep' };
      }
    },
    {
      key: 'example',
      label: '8. ตัวอย่าง Session/Data',
      desc: 'มีตัวอย่างจริง — input/output sample หรือ session log',
      check: function (lines, fullText) {
        var idx = findHeader(lines, ['Example', 'example', 'ตัวอย่าง']);
        var hasCode = /```|&gt;\s|>\s|\$\s/i.test(fullText);
        if (idx < 0 && !hasCode) return { pass: false, msg: 'ไม่มีตัวอย่าง concrete — AI จะเดามั่ว' };
        if (idx < 0 && hasCode) return { pass: 'warn', msg: 'มีตัวอย่าง code block แต่ไม่ระบุ header — เพิ่ม "Example:" จะชัดกว่า' };
        var body = collectBody(lines, idx);
        if (body.length < 10) return { pass: false, msg: 'Example ว่างเปล่า' };
        return { pass: true, msg: 'มีตัวอย่าง concrete' };
      }
    }
  ];

  // === Vague language detector (red flags) ===
  var VAGUE_PATTERNS = [
    { pattern: /ทำระบบ/, hint: '"ทำระบบ" กว้างเกิน — บอกว่าระบบทำอะไรเฉพาะเจาะจง' },
    { pattern: /ทำให้ดี/, hint: '"ทำให้ดี" คลุมเครือ — บอกว่าดียังไง (เร็วขึ้น? แม่นขึ้น?)' },
    { pattern: /make it work/i, hint: '"make it work" — AI จะเดามั่ว · ระบุ behavior ที่ต้องการ' },
    { pattern: /หลายแบบ/, hint: '"หลายแบบ" — กี่แบบ? อะไรบ้าง?' },
    { pattern: /etc\.|และอื่น ๆ/, hint: '"etc." / "และอื่น ๆ" — ระบุให้หมดดีกว่า' },
    { pattern: /AI ช่วย/, hint: '"AI ช่วย" — ช่วยตรงไหน? input อะไร? output อะไร?' },
    { pattern: /ใช้ได้/, hint: '"ใช้ได้" — define "ใช้ได้" เป็นเกณฑ์ที่วัดได้' }
  ];

  function findHeader(lines, patterns) {
    for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < patterns.length; j++) {
        if (lines[i].toLowerCase().indexOf(patterns[j].toLowerCase()) >= 0) return i;
      }
    }
    return -1;
  }

  function collectBody(lines, headerIdx) {
    // Collect non-empty lines after header until next header or blank break of 2+
    if (headerIdx < 0) return '';
    var body = '';
    for (var i = headerIdx + 1; i < lines.length; i++) {
      var line = lines[i].trim();
      // Stop if hitting another section header (line that looks like Header: or **Header**)
      if (/^(\*\*|##)?\s*\w[\w ]*\s*(\*\*|:)/.test(line) && line.length < 50 && i > headerIdx + 1) {
        var lower = line.toLowerCase();
        if (/(input|output|rules|success|non-goals|example|constraints|user)/i.test(lower)) break;
      }
      body += line + ' ';
    }
    return body.trim();
  }

  function enhance(root) {
    var prefill = root.dataset.prefill || '';
    root.innerHTML =
      '<div class="ss-head">' +
        '<div class="ss-title">📝 Spec Quality Scorecard</div>' +
        '<div class="ss-desc">วาง spec ของคุณด้านล่าง → กด <em>ตรวจ</em> → ระบบเช็ค 8 criteria + ภาษากำกวม</div>' +
      '</div>' +
      '<textarea class="ss-input" spellcheck="false" placeholder="วาง spec ของคุณที่นี่ ...&#10;&#10;ตัวอย่าง:&#10;## Spec: My Tool&#10;&#10;**ปัญหา:** ...&#10;**User:** ...&#10;**Input:** ...&#10;**Output:** ...&#10;**Rules:** ...&#10;**Success:** ...&#10;**Non-goals:** ...&#10;**Example:** ..."></textarea>' +
      '<div class="ss-actions">' +
        '<button type="button" class="ss-btn ss-check">🔍 ตรวจ Spec</button>' +
        '<button type="button" class="ss-btn ss-sample">📋 ลอง spec ตัวอย่าง</button>' +
        '<button type="button" class="ss-btn ss-clear">🗑 Clear</button>' +
      '</div>' +
      '<div class="ss-results"></div>';

    var input = root.querySelector('.ss-input');
    var checkBtn = root.querySelector('.ss-check');
    var sampleBtn = root.querySelector('.ss-sample');
    var clearBtn = root.querySelector('.ss-clear');
    var results = root.querySelector('.ss-results');

    if (prefill) input.value = prefill;

    var SAMPLE_SPEC = [
      '## Spec: Grade Calculator',
      '',
      '**ปัญหา:** นักศึกษาอยากรู้ระหว่างเทอมว่าถ้าได้ final กี่คะแนน จะได้เกรดอะไร · ตอนนี้ต้องเดาเอง',
      '',
      '**User:** นักศึกษาปี 1-4 ที่กำลังเรียน 1 วิชา',
      '',
      '**Input:**',
      '- hw_score: int (0-30) ตัวอย่าง 25',
      '- mid_score: int (0-30) ตัวอย่าง 24',
      '- final_predict: int (0-40) ตัวอย่าง 32',
      '',
      '**Output:**',
      '- คะแนนรวม (0-100)',
      '- เกรดที่จะได้ (A/B+/B/C+/C/D+/D/F)',
      '- คะแนน final ขั้นต่ำสำหรับเป้า B',
      '',
      '**Rules:**',
      '- ใช้เกณฑ์: 80+=A, 75+=B+, 70+=B, 65+=C+, 60+=C, 55+=D+, 50+=D, <50=F',
      '- ถ้า input ติดลบหรือเกิน max → แจ้ง error',
      '',
      '**Success:**',
      '- (25, 24, 32) → คะแนน 81 → เกรด A',
      '- target B (70) → ต้องการ final อย่างน้อย 21',
      '- ผ่าน 5 test cases',
      '',
      '**Non-goals:**',
      '- ไม่เซฟ history',
      '- ไม่รองรับวิชาที่ weight ต่างกัน',
      '- ไม่ทำ GUI',
      '',
      '**Example session:**',
      '> hw: 25',
      '> mid: 24',
      '> final: 32',
      '> คะแนน 81 → เกรด A'
    ].join('\n');

    function runCheck() {
      var text = input.value;
      if (!text.trim()) {
        results.innerHTML = '<div class="ss-msg ss-info">ใส่ spec ก่อน</div>';
        return;
      }

      var lines = text.split('\n');
      var html = '<div class="ss-criteria">';
      var passed = 0;
      var warns = 0;

      CRITERIA.forEach(function (c) {
        var result = c.check(lines, text);
        var pass = result.pass;
        var cls, icon;
        if (pass === true) { cls = 'ss-c-ok'; icon = '✅'; passed++; }
        else if (pass === 'warn') { cls = 'ss-c-warn'; icon = '⚠️'; warns++; }
        else { cls = 'ss-c-err'; icon = '❌'; }

        html += '<div class="ss-c ' + cls + '">' +
          '<div class="ss-c-icon">' + icon + '</div>' +
          '<div class="ss-c-body">' +
            '<div class="ss-c-label">' + c.label + '</div>' +
            '<div class="ss-c-msg">' + result.msg + '</div>' +
            '<div class="ss-c-desc"><em>' + c.desc + '</em></div>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';

      // Vague language flags
      var vagueHits = [];
      VAGUE_PATTERNS.forEach(function (v) {
        if (v.pattern.test(text)) vagueHits.push(v.hint);
      });

      // Summary score
      var total = CRITERIA.length;
      var scorePct = Math.round((passed + warns * 0.5) / total * 100);
      var grade = scorePct >= 90 ? '🏆 ดีเยี่ยม' :
                  scorePct >= 75 ? '👍 ดี · ปรับนิดหน่อย' :
                  scorePct >= 50 ? '⚠️ พอใช้ · ยังขาดอีกหลายข้อ' :
                  '❌ ยังต้องปรับอีกเยอะ';

      var summary = '<div class="ss-summary">' +
        '<div class="ss-summary-score">' + grade + '</div>' +
        '<div class="ss-summary-stats">' +
          '<span class="ss-stat ss-stat-ok">✅ ' + passed + '</span>' +
          '<span class="ss-stat ss-stat-warn">⚠️ ' + warns + '</span>' +
          '<span class="ss-stat ss-stat-err">❌ ' + (total - passed - warns) + '</span>' +
          '<span class="ss-stat">คะแนน <b>' + scorePct + '%</b></span>' +
        '</div>' +
      '</div>';

      var vagueHtml = '';
      if (vagueHits.length > 0) {
        vagueHtml = '<div class="ss-vague">' +
          '<div class="ss-vague-title">🚩 พบภาษากำกวม (' + vagueHits.length + ')</div>' +
          '<ul>' + vagueHits.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul>' +
        '</div>';
      }

      results.innerHTML = summary + html + vagueHtml;
    }

    checkBtn.addEventListener('click', runCheck);
    sampleBtn.addEventListener('click', function () {
      input.value = SAMPLE_SPEC;
      runCheck();
    });
    clearBtn.addEventListener('click', function () {
      input.value = '';
      results.innerHTML = '';
    });

    if (prefill) runCheck();
  }

  function init() {
    document.querySelectorAll('.spec-scorecard').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
