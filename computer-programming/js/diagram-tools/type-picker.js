/* Computer Programming Tutorial — Diagram Type Picker (Q&A Wizard)
 *
 * Asks 1-2 questions, recommends the right diagram type + template.
 * Enhances any element with class="diagram-picker".
 */
(function () {
  'use strict';

  var TYPES = {
    flowchart: {
      name: 'Flowchart',
      emoji: '📋',
      when: 'Process / workflow / if-else',
      tools: ['Mermaid', 'draw.io'],
      example: 'flowchart TD\n    A([Start]) --> B{เช็ค?}\n    B -->|Yes| C([End])\n    B -->|No| D[ลองใหม่] --> B'
    },
    sequence: {
      name: 'Sequence Diagram',
      emoji: '💬',
      when: 'API call · hardware↔cloud · bot interaction',
      tools: ['Mermaid', 'PlantUML'],
      example: 'sequenceDiagram\n    User->>API: GET /data\n    API->>DB: query\n    DB-->>API: result\n    API-->>User: JSON'
    },
    c4: {
      name: 'C4 Diagram',
      emoji: '🏗',
      when: 'ภาพรวมระบบ — "มีอะไรอยู่ในระบบของฉัน"',
      tools: ['Mermaid C4', 'draw.io', 'Structurizr'],
      example: 'C4Context\n    Person(user, "User")\n    System(app, "MyApp")\n    Rel(user, app, "uses")'
    },
    state: {
      name: 'State Machine',
      emoji: '⚙️',
      when: 'สิ่งที่มีหลายสถานะ (booking, machine, assignment)',
      tools: ['Mermaid', 'PlantUML'],
      example: 'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Running : start\n    Running --> Idle : stop\n    Running --> Error : fault'
    },
    er: {
      name: 'ER Diagram',
      emoji: '🗄',
      when: 'ก่อนสร้าง database / data schema',
      tools: ['Mermaid', 'dbdiagram.io'],
      example: 'erDiagram\n    USER ||--o{ ORDER : places\n    ORDER {\n        int id PK\n        int user_id FK\n        string status\n    }'
    },
    block: {
      name: 'Block Diagram (Hardware)',
      emoji: '🔌',
      when: 'ระบบทางกายภาพ — IoT, sensor, mechatronics',
      tools: ['Mermaid LR', 'draw.io', 'ปากกา + กระดาษ'],
      example: 'flowchart LR\n    sensor[Sensor] --> mcu[MCU]\n    mcu --> cloud[Cloud]\n    mcu --> actuator[Actuator]'
    }
  };

  // Question tree: each question has options, each option leads to next question or final type
  var QUESTION_TREE = {
    start: {
      q: 'สิ่งที่คุณอยากอธิบายเป็นอะไร?',
      options: [
        { label: '🔄 ลำดับขั้นตอน / กระบวนการ', goto: 'q-process' },
        { label: '💬 หลายส่วนที่คุยกัน', result: 'sequence' },
        { label: '🏗 ภาพรวมว่าระบบมีอะไรบ้าง', result: 'c4' },
        { label: '⚙️ สิ่งที่มีหลายสถานะ', result: 'state' },
        { label: '🗄 โครงสร้างข้อมูล / database', result: 'er' },
        { label: '🔌 ฮาร์ดแวร์ / เซ็นเซอร์ / อุปกรณ์', result: 'block' }
      ]
    },
    'q-process': {
      q: 'มี <strong>การตัดสินใจ</strong> (if/else, yes/no) หรือ <strong>การวนซ้ำ</strong> มั้ย?',
      options: [
        { label: '✅ มี — มี decision หรือ loop', result: 'flowchart' },
        { label: '❌ ไม่มี — เป็น linear steps ตรง ๆ', result: 'flowchart' },
        { label: '💭 มีหลายฝ่ายคุยกัน', result: 'sequence' }
      ]
    }
  };

  function enhance(root) {
    root.innerHTML =
      '<div class="dp-head">' +
        '<div class="dp-title">🧭 ฉันควรใช้ Diagram แบบไหน?</div>' +
        '<div class="dp-desc">ตอบ 1-2 คำถาม — แนะนำให้</div>' +
      '</div>' +
      '<div class="dp-body"></div>' +
      '<div class="dp-result" style="display:none"></div>' +
      '<button type="button" class="dp-restart" style="display:none">🔄 เริ่มใหม่</button>';

    var body = root.querySelector('.dp-body');
    var resultEl = root.querySelector('.dp-result');
    var restartBtn = root.querySelector('.dp-restart');

    function showQuestion(qKey) {
      var q = QUESTION_TREE[qKey];
      var html = '<div class="dp-q">' + q.q + '</div><div class="dp-opts">';
      q.options.forEach(function (opt, i) {
        html += '<button type="button" class="dp-opt" data-i="' + i + '">' + opt.label + '</button>';
      });
      html += '</div>';
      body.innerHTML = html;
      body.querySelectorAll('.dp-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = parseInt(btn.dataset.i, 10);
          var opt = q.options[i];
          if (opt.result) showResult(opt.result);
          else if (opt.goto) showQuestion(opt.goto);
        });
      });
    }

    function showResult(typeKey) {
      var t = TYPES[typeKey];
      body.style.display = 'none';
      resultEl.style.display = '';
      restartBtn.style.display = '';

      resultEl.innerHTML =
        '<div class="dp-rec">' +
          '<div class="dp-rec-head">' +
            '<span class="dp-rec-emoji">' + t.emoji + '</span>' +
            '<span class="dp-rec-name">' + t.name + '</span>' +
          '</div>' +
          '<div class="dp-rec-when"><strong>ใช้สำหรับ:</strong> ' + t.when + '</div>' +
          '<div class="dp-rec-tools"><strong>เครื่องมือ:</strong> ' + t.tools.join(' · ') + '</div>' +
          '<div class="dp-rec-tpl-label">เทมเพลตเริ่มต้น:</div>' +
          '<pre class="dp-rec-tpl"><code>' + escapeHtml(t.example) + '</code></pre>' +
          '<div class="dp-rec-cta">' +
            '<button type="button" class="dp-rec-copy">📋 Copy template</button>' +
            '<a class="dp-rec-link" href="tools.html#mermaid-editor" target="_blank">🎨 เปิดใน Mermaid Editor</a>' +
          '</div>' +
        '</div>';

      var copyBtn = resultEl.querySelector('.dp-rec-copy');
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(t.example).then(function () {
          copyBtn.textContent = '✅ Copied!';
          setTimeout(function () { copyBtn.textContent = '📋 Copy template'; }, 1500);
        });
      });
    }

    function reset() {
      body.style.display = '';
      resultEl.style.display = 'none';
      restartBtn.style.display = 'none';
      showQuestion('start');
    }

    restartBtn.addEventListener('click', reset);
    reset();
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function init() {
    document.querySelectorAll('.diagram-picker').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
