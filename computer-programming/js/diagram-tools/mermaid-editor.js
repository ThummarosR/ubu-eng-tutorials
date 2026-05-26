/* Computer Programming Tutorial — Mermaid Live Editor
 *
 * Auto-enhances any element with class="mermaid-editor" into a live editor:
 *   <div class="mermaid-editor" data-template="flowchart"></div>
 *
 * Renders Mermaid diagrams in real-time, with templates for 6 diagram types,
 * copy, download SVG, and "open in mermaid.live" buttons.
 *
 * Requires mermaid v10+ loaded globally (via CDN <script>).
 */
(function () {
  'use strict';

  // === Templates ===
  var TEMPLATES = {
    flowchart: {
      name: 'Flowchart',
      desc: 'Process / workflow / if-else',
      code: 'flowchart TD\n' +
            '    A([Start]) --> B[อ่านโจทย์]\n' +
            '    B --> C{เข้าใจ?}\n' +
            '    C -->|Yes| D[ทำการบ้าน]\n' +
            '    C -->|No| E[ถาม TA]\n' +
            '    E --> B\n' +
            '    D --> F[/ส่ง Classroom/]\n' +
            '    F --> G([End])'
    },
    sequence: {
      name: 'Sequence',
      desc: 'Who talks to who · API / hardware',
      code: 'sequenceDiagram\n' +
            '    actor Student\n' +
            '    participant Web\n' +
            '    participant API\n' +
            '    participant DB\n' +
            '    Student->>Web: เปิดหน้าจอง\n' +
            '    Web->>API: GET /slots\n' +
            '    API->>DB: SELECT free\n' +
            '    DB-->>API: list\n' +
            '    API-->>Web: JSON\n' +
            '    Web-->>Student: แสดงช่อง'
    },
    c4: {
      name: 'C4 Context',
      desc: 'System architecture overview',
      code: 'C4Context\n' +
            '    title CNC Booking System\n' +
            '    Person(student, "นักศึกษา", "อยากจองเครื่อง")\n' +
            '    Person(ta, "TA", "ดู / อนุมัติ")\n' +
            '    System(booking, "Booking System", "เว็บแอป")\n' +
            '    System_Ext(line, "LINE Notify", "ส่งแจ้งเตือน")\n' +
            '    Rel(student, booking, "ใช้ผ่านเว็บ")\n' +
            '    Rel(ta, booking, "ดู dashboard")\n' +
            '    Rel(booking, line, "แจ้งเตือน")'
    },
    state: {
      name: 'State Machine',
      desc: 'States that change',
      code: 'stateDiagram-v2\n' +
            '    [*] --> รอยืนยัน : นักศึกษาจอง\n' +
            '    รอยืนยัน --> ยืนยัน : approve\n' +
            '    รอยืนยัน --> ยกเลิก : timeout\n' +
            '    ยืนยัน --> ใช้งาน : ถึงเวลา\n' +
            '    ยืนยัน --> ยกเลิก : ขอยกเลิก\n' +
            '    ใช้งาน --> เสร็จสิ้น : กดคืน\n' +
            '    เสร็จสิ้น --> [*]'
    },
    er: {
      name: 'ER Diagram',
      desc: 'Data structure / database',
      code: 'erDiagram\n' +
            '    STUDENT ||--o{ BOOKING : ทำการจอง\n' +
            '    MACHINE ||--o{ BOOKING : ถูกจอง\n' +
            '    BOOKING {\n' +
            '        int booking_id PK\n' +
            '        int student_id FK\n' +
            '        int machine_id FK\n' +
            '        datetime start_time\n' +
            '        string status\n' +
            '    }\n' +
            '    STUDENT {\n' +
            '        int student_id PK\n' +
            '        string name\n' +
            '        string email\n' +
            '    }\n' +
            '    MACHINE {\n' +
            '        int machine_id PK\n' +
            '        string code\n' +
            '        string location\n' +
            '    }'
    },
    block: {
      name: 'Block (IoT)',
      desc: 'Physical / hardware system',
      code: 'flowchart LR\n' +
            '    sensor[Temp Sensor<br/>DS18B20]\n' +
            '    mcu[ESP32<br/>microcontroller]\n' +
            '    mqtt[MQTT Broker]\n' +
            '    dash[Dashboard<br/>Streamlit]\n' +
            '    relay[Relay<br/>เปิด/ปิดพัดลม]\n' +
            '    sensor --> mcu\n' +
            '    mcu --> mqtt\n' +
            '    mqtt --> dash\n' +
            '    mcu --> relay'
    }
  };

  // === Mermaid init ===
  function ensureMermaid(cb) {
    if (window.mermaid) {
      cb();
      return;
    }
    // Wait up to 5 seconds for mermaid to load
    var tries = 0;
    var timer = setInterval(function () {
      if (window.mermaid) {
        clearInterval(timer);
        cb();
      } else if (++tries > 50) {
        clearInterval(timer);
        console.error('Mermaid not loaded after 5s');
      }
    }, 100);
  }

  function initMermaid() {
    if (!window.mermaid || window._mermaidInited) return;
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      fontFamily: 'Sarabun, sans-serif',
      themeVariables: {
        primaryColor: '#3776ab',
        primaryTextColor: '#fff',
        primaryBorderColor: '#ffd43b',
        lineColor: '#9aa3b8',
        secondaryColor: '#182142',
        tertiaryColor: '#131a2e',
        background: '#0b1020',
        mainBkg: '#182142',
        secondBkg: '#131a2e',
        tertiaryBkg: '#0b1020'
      },
      flowchart: { htmlLabels: true },
      sequence: { showSequenceNumbers: false }
    });
    window._mermaidInited = true;
  }

  // === Render with debounce ===
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  // Unique id counter for diagrams
  var __idCounter = 0;
  function nextId() {
    __idCounter++;
    return 'mmd-' + Date.now() + '-' + __idCounter;
  }

  async function renderMermaid(textarea, preview, errorEl) {
    if (!window.mermaid) return;
    var code = textarea.value.trim();
    if (!code) {
      preview.innerHTML = '<div class="mmd-empty">พิมพ์ Mermaid syntax ทางซ้าย — preview จะแสดงที่นี่</div>';
      errorEl.textContent = '';
      errorEl.classList.remove('show');
      return;
    }
    try {
      var id = nextId();
      var result = await window.mermaid.render(id, code);
      preview.innerHTML = result.svg;
      errorEl.textContent = '';
      errorEl.classList.remove('show');
    } catch (e) {
      errorEl.textContent = '❌ ' + (e.message || String(e)).split('\n')[0];
      errorEl.classList.add('show');
    }
  }

  // === Enhance one editor ===
  function enhance(root) {
    var initialTemplate = root.dataset.template || 'flowchart';
    var initialCode = root.textContent.trim() || TEMPLATES[initialTemplate].code;
    root.textContent = '';

    root.innerHTML =
      '<div class="mmd-toolbar">' +
        '<label class="mmd-tpl-label">เทมเพลต:' +
          '<select class="mmd-tpl">' +
            Object.keys(TEMPLATES).map(function (k) {
              var t = TEMPLATES[k];
              var sel = k === initialTemplate ? ' selected' : '';
              return '<option value="' + k + '"' + sel + '>' + t.name + ' — ' + t.desc + '</option>';
            }).join('') +
          '</select>' +
        '</label>' +
        '<div class="mmd-actions">' +
          '<button type="button" class="mmd-btn mmd-copy">📋 Copy</button>' +
          '<button type="button" class="mmd-btn mmd-download">💾 SVG</button>' +
          '<button type="button" class="mmd-btn mmd-external">🌐 mermaid.live</button>' +
        '</div>' +
      '</div>' +
      '<div class="mmd-split">' +
        '<div class="mmd-left">' +
          '<textarea class="mmd-textarea" spellcheck="false"></textarea>' +
          '<div class="mmd-error"></div>' +
        '</div>' +
        '<div class="mmd-right">' +
          '<div class="mmd-preview"></div>' +
        '</div>' +
      '</div>';

    var textarea = root.querySelector('.mmd-textarea');
    var preview = root.querySelector('.mmd-preview');
    var errorEl = root.querySelector('.mmd-error');
    var tplSel = root.querySelector('.mmd-tpl');
    var copyBtn = root.querySelector('.mmd-copy');
    var dlBtn = root.querySelector('.mmd-download');
    var extBtn = root.querySelector('.mmd-external');

    textarea.value = initialCode;

    var render = function () { renderMermaid(textarea, preview, errorEl); };
    var debouncedRender = debounce(render, 300);

    textarea.addEventListener('input', debouncedRender);

    tplSel.addEventListener('change', function () {
      var key = tplSel.value;
      textarea.value = TEMPLATES[key].code;
      render();
    });

    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(textarea.value).then(function () {
        var old = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';
        setTimeout(function () { copyBtn.textContent = old; }, 1500);
      });
    });

    dlBtn.addEventListener('click', function () {
      var svg = preview.querySelector('svg');
      if (!svg) return;
      var src = new XMLSerializer().serializeToString(svg);
      var blob = new Blob([src], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'diagram.svg';
      a.click();
      URL.revokeObjectURL(url);
    });

    extBtn.addEventListener('click', function () {
      // Mermaid Live uses base64-encoded state in URL fragment
      var state = {
        code: textarea.value,
        mermaid: { theme: 'dark' },
        autoSync: true,
        updateDiagram: true
      };
      var json = JSON.stringify(state);
      var base64 = btoa(unescape(encodeURIComponent(json)));
      window.open('https://mermaid.live/edit#base64:' + base64, '_blank');
    });

    // Initial render
    render();
  }

  // === Static .mermaid block rendering ===
  // For inline static diagrams written as: <div class="mermaid">flowchart TD...</div>
  // Renders each one's text content into SVG in-place.
  async function renderStaticBlocks() {
    var staticBlocks = document.querySelectorAll('.mermaid');
    if (staticBlocks.length === 0) return;

    for (var i = 0; i < staticBlocks.length; i++) {
      var el = staticBlocks[i];
      // Skip if already rendered (Mermaid marks as data-processed)
      if (el.getAttribute('data-processed') === 'true') continue;
      var code = el.textContent.trim();
      if (!code) continue;
      try {
        var id = nextId();
        var result = await window.mermaid.render(id, code);
        el.innerHTML = result.svg;
        el.setAttribute('data-processed', 'true');
      } catch (e) {
        el.innerHTML = '<div class="mmd-static-error">❌ ' +
          (e.message || String(e)).split('\n')[0] + '</div>';
      }
    }
  }

  function init() {
    var editors = document.querySelectorAll('.mermaid-editor');
    var staticBlocks = document.querySelectorAll('.mermaid');
    if (editors.length === 0 && staticBlocks.length === 0) return;

    ensureMermaid(function () {
      initMermaid();
      renderStaticBlocks();
      editors.forEach(enhance);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
