/* Schneider PM2230 Front-Panel Menu Walker
 *
 * Markup:
 *   <div class="pm2230-walker"></div>
 *
 * Simulates the PM2230 buttons + 2-line display. The PM2230 has a 3-button
 * navigation (▲ / ▼ / OK) plus a Menu button. From Normal Display mode:
 *   - Press OK → enters Setup Mode (after password prompt — we skip the
 *     password since the default 0000 is what 90% of installations leave it)
 *   - In any list view: ▲ ▼ to scroll, OK to enter
 *   - In an edit field: ▲ ▼ to change digit, OK to confirm
 *   - Press Menu to step back up one level
 *
 * Covers the 3 setup areas students hit most:
 *   1. Wiring (1P / 3P3W / 3P4W)
 *   2. CT Ratio (Primary / Secondary)
 *   3. Communications (Modbus address, baud, parity)
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // Live measurement display cycle (what shows in Normal mode)
  var LIVE_DISPLAYS = [
    { label: 'U-LN', value: '230.5', unit: 'V',   desc: 'Voltage Line-to-Neutral' },
    { label: 'I',    value: '12.4',  unit: 'A',   desc: 'Current (avg of 3 phases)' },
    { label: 'P',    value: '4.82',  unit: 'kW',  desc: 'Active Power — Total' },
    { label: 'PF',   value: '0.92',  unit: '',    desc: 'Power Factor — Total' },
    { label: 'EnEr', value: '8421',  unit: 'kWh', desc: 'Total Active Energy' },
    { label: 'FrEQ', value: '49.98', unit: 'Hz',  desc: 'System Frequency' }
  ];

  // Setup menu tree
  var MENU = {
    title: 'SETUP',
    items: [
      {
        id: 'wir', label: 'Wir', desc: 'Wiring System',
        type: 'enum',
        options: [
          { v: '3P4w', desc: '3-phase 4-wire (Star) — Thailand standard' },
          { v: '3P3w', desc: '3-phase 3-wire (Delta) — โรงงาน 3 phase 3 สาย' },
          { v: '1Ph2', desc: '1-phase 2-wire — single phase' },
          { v: '1Ph3', desc: '1-phase 3-wire (split phase) — บางอเมริกา/ญี่ปุ่น' }
        ],
        default: 0
      },
      {
        id: 'ctp', label: 'Ct-P', desc: 'CT Primary (ขนาดของ CT ที่ติดตั้ง)',
        type: 'int', min: 5, max: 32767, step: 5, unit: 'A', default: 100,
        note: 'ค่าตามที่ระบุข้าง CT — เช่น "100/5A CT" ใส่ 100'
      },
      {
        id: 'cts', label: 'Ct-S', desc: 'CT Secondary',
        type: 'enum',
        options: [
          { v: '5',  desc: '5A secondary (มาตรฐานในไทย)' },
          { v: '1',  desc: '1A secondary (UK / EU บางที่)' }
        ],
        default: 0
      },
      {
        id: 'fr',  label: 'Frq', desc: 'System Frequency',
        type: 'enum',
        options: [ { v: '50', desc: '50 Hz (TH/EU)' }, { v: '60', desc: '60 Hz (US/JP)' } ],
        default: 0
      },
      {
        id: 'com', label: 'CoM', desc: 'Communications (Modbus)',
        type: 'group',
        children: [
          {
            id: 'pro', label: 'ProT', desc: 'Protocol',
            type: 'enum',
            options: [ { v: 'Mbus', desc: 'Modbus RTU (ใช้กับ FX5U)' }, { v: 'JbUS', desc: 'JBus (เก่า)' } ],
            default: 0
          },
          {
            id: 'adr', label: 'Adr', desc: 'Slave Address (1–247)',
            type: 'int', min: 1, max: 247, step: 1, default: 3,
            note: 'ใส่ตามที่ระบุใน Ladder ของ FX5U'
          },
          {
            id: 'bd',  label: 'bAUd', desc: 'Baud Rate',
            type: 'enum',
            options: [
              { v: '4800',  desc: '4800 bps (ช้า · ทนสัญญาณรบกวน)' },
              { v: '9600',  desc: '9600 bps (default · งานทั่วไป)' },
              { v: '19200', desc: '19200 bps' },
              { v: '38400', desc: '38400 bps (เร็วสุด · ต้องสายดี)' }
            ],
            default: 1
          },
          {
            id: 'par', label: 'Par', desc: 'Parity',
            type: 'enum',
            options: [
              { v: 'NonE', desc: 'No parity (= 2 stop bits) — มาตรฐาน' },
              { v: 'EvEn', desc: 'Even parity' },
              { v: 'odd',  desc: 'Odd parity' }
            ],
            default: 0
          }
        ]
      }
    ]
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function buildWalker(root) {
    root.innerHTML = '';
    root.classList.add('pm');

    // Flatten setup items so we can navigate with index pointers
    // path: array of indices [0] = top item, [0,1] = top item 0's child 1
    var state = {
      mode: 'normal',           // 'normal' | 'setup'
      liveIdx: 0,               // index into LIVE_DISPLAYS
      path: [],                 // indices into MENU.items
      editing: false,           // are we currently editing a value?
      // Selected values per item id
      values: {}
    };
    // Init defaults
    function initDefaults(items) {
      items.forEach(function (item) {
        if (item.type === 'group') initDefaults(item.children);
        else if (item.type === 'enum') state.values[item.id] = item.default || 0;
        else if (item.type === 'int') state.values[item.id] = item.default || 0;
      });
    }
    initDefaults(MENU.items);

    // --- Header ---
    var head = el('div', 'pm-head');
    head.innerHTML =
      '<div class="pm-title">⚡ PM2230 Setup Walker — Schneider Power Meter</div>' +
      '<div class="pm-desc">' +
        'หน้าจอ PM2230 มี 4 ปุ่ม: <strong>Menu</strong> (กลับ/ออก) · <strong>▲</strong> · <strong>▼</strong> · <strong>OK</strong> (เข้า/แก้ค่า) · ' +
        'จากหน้า Normal กด <strong>OK</strong> = เข้า Setup · ในเมนูใด ๆ ▲▼ = เลื่อน · OK = เข้า/แก้ · Menu = ถอยกลับ' +
      '</div>';
    root.appendChild(head);

    // --- Simulated meter ---
    var sim = el('div', 'pm-sim');

    var disp = el('div', 'pm-display');
    disp.innerHTML =
      '<div class="pm-mode-tag" id="pm-mode">NORMAL</div>' +
      '<div class="pm-line-top" id="pm-top"></div>' +
      '<div class="pm-line-bot" id="pm-bot"></div>' +
      '<div class="pm-edit-arrow" id="pm-edit-arrow">▶</div>';
    sim.appendChild(disp);

    var pad = el('div', 'pm-pad');
    pad.innerHTML =
      '<button type="button" class="pm-btn pm-btn-menu" data-key="menu">Menu</button>' +
      '<button type="button" class="pm-btn"            data-key="up">▲</button>' +
      '<button type="button" class="pm-btn"            data-key="down">▼</button>' +
      '<button type="button" class="pm-btn pm-btn-ok"  data-key="ok">OK</button>';
    sim.appendChild(pad);

    root.appendChild(sim);

    // --- Status panel ---
    var status = el('div', 'pm-status');
    root.appendChild(status);

    var topEl = disp.querySelector('#pm-top');
    var botEl = disp.querySelector('#pm-bot');
    var modeEl = disp.querySelector('#pm-mode');
    var editArrow = disp.querySelector('#pm-edit-arrow');

    // --- Helpers ---
    function nodeAtPath(path) {
      var node = MENU;
      for (var i = 0; i < path.length; i++) {
        node = (node.items || node.children)[path[i]];
      }
      return node;
    }
    function childrenAtPath(path) {
      if (path.length === 0) return MENU.items;
      var node = nodeAtPath(path);
      return node.children || null;
    }
    function flash(el) {
      el.classList.remove('pm-flash');
      void el.offsetWidth;
      el.classList.add('pm-flash');
    }
    function valueDisplayFor(item) {
      var v = state.values[item.id];
      if (item.type === 'enum') {
        return item.options[v].v;
      }
      return String(v) + (item.unit ? ' ' + item.unit : '');
    }
    function valueDescFor(item) {
      var v = state.values[item.id];
      if (item.type === 'enum') return item.options[v].desc;
      if (item.note) return item.note;
      return '';
    }

    function render() {
      // Edit arrow visibility
      editArrow.style.opacity = state.editing ? 1 : 0;
      if (state.mode === 'normal') {
        modeEl.textContent = 'NORMAL';
        modeEl.className = 'pm-mode-tag pm-mode-normal';
        var d = LIVE_DISPLAYS[state.liveIdx];
        topEl.textContent = d.label;
        botEl.innerHTML = d.value + (d.unit ? ' <span class="pm-unit">' + d.unit + '</span>' : '');
        status.innerHTML =
          '<div class="pm-status-label">หน้า Normal Display</div>' +
          '<div class="pm-status-name">' + d.label + ' = ' + d.value + ' ' + d.unit + '</div>' +
          '<div class="pm-status-desc">' + d.desc + '</div>' +
          '<div class="pm-status-hint">▲▼ = เปลี่ยนหน้าวัดค่า · <strong>OK</strong> = เข้า Setup Menu</div>';
        return;
      }
      // Setup mode
      modeEl.textContent = 'SETUP';
      modeEl.className = 'pm-mode-tag pm-mode-setup';
      var siblings = state.path.length === 0 ? MENU.items : childrenAtPath(state.path.slice(0, -1));
      var idx = state.path[state.path.length - 1];
      var item = siblings[idx];
      if (!item) {
        topEl.textContent = 'SetUP';
        botEl.textContent = '';
        status.innerHTML = '<div class="pm-status-name">เมนู Setup</div>';
        return;
      }
      topEl.textContent = item.label;
      if (item.type === 'group') {
        botEl.textContent = '----';
        status.innerHTML =
          '<div class="pm-status-label">หมวด</div>' +
          '<div class="pm-status-name">' + item.label + ' — ' + item.desc + '</div>' +
          '<div class="pm-status-hint">▲▼ = หมวดอื่น · <strong>OK</strong> = เข้าหมวดนี้ · <strong>Menu</strong> = ออก</div>';
      } else {
        botEl.innerHTML = (state.editing ? '<span class="pm-editing">' + valueDisplayFor(item) + '</span>' : valueDisplayFor(item));
        var label = state.editing ? 'แก้ค่าอยู่ — กด ▲▼ เปลี่ยน · OK = บันทึก' : '▲▼ = param อื่น · OK = แก้ค่า · Menu = ถอยออก';
        status.innerHTML =
          '<div class="pm-status-label">Parameter</div>' +
          '<div class="pm-status-name">' + item.label + ' = ' + valueDisplayFor(item) + '</div>' +
          '<div class="pm-status-desc">' + item.desc + (valueDescFor(item) ? ' — ' + valueDescFor(item) : '') + '</div>' +
          '<div class="pm-status-hint">' + label + '</div>';
      }
    }

    // --- Input handlers ---
    function press(key) {
      if (state.mode === 'normal') {
        if (key === 'up')   state.liveIdx = (state.liveIdx - 1 + LIVE_DISPLAYS.length) % LIVE_DISPLAYS.length;
        if (key === 'down') state.liveIdx = (state.liveIdx + 1) % LIVE_DISPLAYS.length;
        if (key === 'ok')   { state.mode = 'setup'; state.path = [0]; }
        if (key === 'menu') {/* stays in normal */}
        flash(botEl);
        render();
        return;
      }
      // SETUP MODE
      var siblings = state.path.length === 0 ? MENU.items : childrenAtPath(state.path.slice(0, -1));
      var idx = state.path[state.path.length - 1];
      var item = siblings[idx];

      if (state.editing) {
        // Adjusting value
        if (item.type === 'enum') {
          if (key === 'up')   state.values[item.id] = (state.values[item.id] - 1 + item.options.length) % item.options.length;
          if (key === 'down') state.values[item.id] = (state.values[item.id] + 1) % item.options.length;
        } else if (item.type === 'int') {
          var step = item.step || 1;
          if (key === 'up')   state.values[item.id] = Math.min(item.max, state.values[item.id] + step);
          if (key === 'down') state.values[item.id] = Math.max(item.min, state.values[item.id] - step);
        }
        if (key === 'ok')   state.editing = false;
        if (key === 'menu') state.editing = false; // cancel back, but value was changed live; treat same as save
        flash(botEl);
        render();
        return;
      }

      if (key === 'up') {
        var newIdx = (idx - 1 + siblings.length) % siblings.length;
        state.path[state.path.length - 1] = newIdx;
        flash(topEl);
        render();
        return;
      }
      if (key === 'down') {
        var newIdx2 = (idx + 1) % siblings.length;
        state.path[state.path.length - 1] = newIdx2;
        flash(topEl);
        render();
        return;
      }
      if (key === 'ok') {
        if (item.type === 'group') {
          // Enter group
          state.path.push(0);
        } else {
          state.editing = true;
        }
        flash(botEl);
        render();
        return;
      }
      if (key === 'menu') {
        if (state.path.length > 1) {
          state.path.pop();
        } else {
          // Exit setup
          state.mode = 'normal';
          state.path = [];
        }
        flash(modeEl);
        render();
        return;
      }
    }

    pad.querySelectorAll('.pm-btn').forEach(function (b) {
      b.addEventListener('click', function () { press(b.getAttribute('data-key')); });
    });

    render();
  }

  function init() {
    document.querySelectorAll('.pm2230-walker').forEach(buildWalker);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
