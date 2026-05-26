/* Omron E5CC Front-Panel Menu Walker
 *
 * Markup:
 *   <div class="e5cc-walker"></div>
 *
 * Simulates the E5CC's 4-button + dual-display interface. Students click
 * PF / ▼ / ▲ / O↩ to navigate the same way as the real device:
 *   - Hold O↩ for 3s → enter Initial Setting Level
 *   - From Initial, hold O↩ for 1s → Communications Setting Level
 *   - Short press O↩ → cycle through parameters in current level
 *   - ▲ / ▼ → adjust the active value
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // --- Menu data ----------------------------------------------------------
  // Each level: list of params. PV is shown on top display (red), SV on
  // bottom display (green). When editing a param, label shows on top,
  // value on bottom.
  var LEVELS = {
    operation: {
      name: 'Operation Level',
      indicator: 'op',
      items: [
        { id: 'pv_sv', label: null,   isMain: true },              // Main PV/SV display
        { id: 'at',    label: 'at',   options: ['oFF', 'AT-2'], desc: 'Auto-Tune (oFF / AT-2=100%)' },
        { id: 'lck',   label: 'lck',  options: ['oFF', 'on'],   desc: 'Setting Lock — กันการแก้ค่า' }
      ]
    },
    initial: {
      name: 'Initial Setting Level',
      indicator: 'init',
      items: [
        { id: 'in-t', label: 'in-t', options: ['5', '0', '4', '12'], optsDesc: ['K Thermocouple','Pt100 RTD','J Thermocouple','PL2 Pt100'], desc: 'Input Type (5=K · 0=Pt100)' },
        { id: 'd-u',  label: 'd-u',  options: ['C', 'F'], optsDesc: ['°C','°F'], desc: 'Temperature Unit' },
        { id: 'cp',   label: 'cp',   options: ['2', '20'], optsDesc: ['2s (SSR)','20s (Relay)'], desc: 'Control Period' },
        { id: 's-hc', label: 's-hc', options: ['H', 'C'], optsDesc: ['Heating','Cooling'], desc: 'Standard/Heating-Cooling' }
      ]
    },
    comms: {
      name: 'Communications Setting',
      indicator: 'comm',
      items: [
        { id: 'psel', label: 'PSEL', options: ['Mod', 'Cwf'], optsDesc: ['Modbus','Omron CompoWay/F'], desc: 'Protocol Select' },
        { id: 'u-no', label: 'U-No', options: ['1', '2', '3'], desc: 'Slave Address (1–99)' },
        { id: 'bps',  label: 'bPS',  options: ['96', '192', '384'], optsDesc: ['9600 bps','19200 bps','38400 bps'], desc: 'Baud Rate' },
        { id: 'len',  label: 'LEn',  options: ['8', '7'], desc: 'Data Length (bits)' },
        { id: 'sbtl', label: 'SbtL', options: ['1', '2'], desc: 'Stop Bits' },
        { id: 'prty', label: 'PrtY', options: ['NonE', 'EvEn', 'odd'], desc: 'Parity' }
      ]
    }
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function buildWalker(root) {
    root.innerHTML = '';
    root.classList.add('ec');

    var state = {
      level: 'operation',
      itemIdx: 0,        // index within level
      // Operation mode: actual PV/SV values
      pv: 60.0,
      sv: 60.0,
      mv: 23,            // %
      // Selected option per param (level -> itemId -> optionIdx)
      selections: {
        operation: { at: 0, lck: 0 },
        initial:   { 'in-t': 0, 'd-u': 0, cp: 0, 's-hc': 0 },
        comms:     { psel: 0, 'u-no': 0, bps: 0, len: 0, sbtl: 0, prty: 0 }
      },
      // Hold timer
      holdStart: null,
      holdTimer: null
    };

    var head = el('div', 'ec-head');
    head.innerHTML =
      '<div class="ec-title">📟 E5CC Menu Walker — กดปุ่มเหมือนของจริง</div>' +
      '<div class="ec-desc">กด <strong>O↩</strong> สั้น = หมุน param ในระดับเดียวกัน · <strong>กดค้าง 3 วินาที</strong> = เข้า Initial Setting Level · จาก Initial กดค้าง 1 วินาที = เข้า Communications · ▲▼ = ปรับค่า</div>';
    root.appendChild(head);

    var simWrap = el('div', 'ec-sim');

    // ---- Display ---------------------------------------------------------
    var display = el('div', 'ec-display');
    display.innerHTML =
      '<div class="ec-level-indicator" id="ec-lvl">OPER</div>' +
      '<div class="ec-disp-top" id="ec-top">60.0</div>' +
      '<div class="ec-disp-bottom" id="ec-bot">60.0</div>' +
      '<div class="ec-disp-mv" id="ec-mvbar"><div class="ec-disp-mv-fill" id="ec-mvfill"></div><span id="ec-mvtxt">MV 23%</span></div>';
    simWrap.appendChild(display);

    // ---- Button pad ------------------------------------------------------
    var pad = el('div', 'ec-pad');
    pad.innerHTML =
      '<button type="button" class="ec-btn" data-key="pf">PF</button>' +
      '<button type="button" class="ec-btn" data-key="down">▼</button>' +
      '<button type="button" class="ec-btn" data-key="up">▲</button>' +
      '<button type="button" class="ec-btn ec-btn-mode" data-key="mode" id="ec-btn-mode">O↩</button>' +
      '<div class="ec-hold-progress" id="ec-hold-progress"><div class="ec-hold-bar" id="ec-hold-bar"></div></div>';
    simWrap.appendChild(pad);
    root.appendChild(simWrap);

    // ---- Status panel ----------------------------------------------------
    var status = el('div', 'ec-status');
    status.innerHTML =
      '<div class="ec-status-label">Param ปัจจุบัน</div>' +
      '<div class="ec-status-name" id="ec-pname">PV / SV</div>' +
      '<div class="ec-status-desc" id="ec-pdesc">หน้า Operation — PV (อุณหภูมิจริง) บน · SV (ตั้ง) ล่าง · กด ▲▼ ปรับ SV</div>' +
      '<div class="ec-status-action" id="ec-paction"></div>';
    root.appendChild(status);

    // ---- Helper render functions ----------------------------------------
    var topEl = display.querySelector('#ec-top');
    var botEl = display.querySelector('#ec-bot');
    var lvlEl = display.querySelector('#ec-lvl');
    var mvBar = display.querySelector('#ec-mvbar');
    var mvFill = display.querySelector('#ec-mvfill');
    var mvTxt = display.querySelector('#ec-mvtxt');
    var pname = status.querySelector('#ec-pname');
    var pdesc = status.querySelector('#ec-pdesc');
    var paction = status.querySelector('#ec-paction');
    var holdBar = pad.querySelector('#ec-hold-bar');
    var holdProg = pad.querySelector('#ec-hold-progress');

    function currentItem() {
      return LEVELS[state.level].items[state.itemIdx];
    }
    function currentSelection() {
      var item = currentItem();
      if (item.isMain) return null;
      return state.selections[state.level][item.id];
    }
    function setSelection(idx) {
      var item = currentItem();
      if (item.isMain) return;
      state.selections[state.level][item.id] = idx;
    }

    function render() {
      var level = LEVELS[state.level];
      lvlEl.textContent = level.indicator.toUpperCase();
      lvlEl.className = 'ec-level-indicator ec-level-' + level.indicator;

      var item = currentItem();
      if (item.isMain) {
        // PV/SV display
        topEl.textContent = state.pv.toFixed(1);
        botEl.textContent = state.sv.toFixed(1);
        topEl.className = 'ec-disp-top ec-disp-pv';
        botEl.className = 'ec-disp-bottom ec-disp-sv';
        mvBar.style.display = '';
        var pct = state.mv;
        mvFill.style.width = pct + '%';
        mvTxt.textContent = 'MV ' + pct + '%';
        pname.textContent = 'PV / SV';
        pdesc.textContent = 'หน้า Operation — PV บน · SV ล่าง · กด ▲▼ ปรับ SV';
        paction.textContent = '';
      } else {
        // Parameter view
        topEl.textContent = item.label;
        topEl.className = 'ec-disp-top ec-disp-param';
        var sel = state.selections[state.level][item.id];
        botEl.textContent = item.options[sel];
        botEl.className = 'ec-disp-bottom ec-disp-val';
        mvBar.style.display = 'none';
        pname.textContent = item.label + ' = ' + item.options[sel];
        var optsDesc = item.optsDesc ? (item.optsDesc[sel] ? ' — ' + item.optsDesc[sel] : '') : '';
        pdesc.textContent = (item.desc || '') + optsDesc;
        paction.innerHTML = 'กด <strong>▲▼</strong> เพื่อเปลี่ยนค่า · <strong>O↩</strong> สั้น = param ถัดไป';
      }
    }

    function step(deltaIdx) {
      var item = currentItem();
      if (item.isMain) {
        // PV/SV: ▲▼ adjust SV
        state.sv = Math.max(0, Math.min(200, state.sv + deltaIdx));
        // Drift PV toward SV slightly to simulate response
        flashDisplay(botEl);
      } else {
        var sel = state.selections[state.level][item.id];
        sel = (sel + deltaIdx + item.options.length) % item.options.length;
        state.selections[state.level][item.id] = sel;
        flashDisplay(botEl);
      }
      render();
    }
    function flashDisplay(el) {
      el.classList.remove('ec-disp-flash');
      void el.offsetWidth;
      el.classList.add('ec-disp-flash');
    }
    function nextParam() {
      var items = LEVELS[state.level].items;
      state.itemIdx = (state.itemIdx + 1) % items.length;
      render();
    }

    // Mode key behavior:
    //  Short press: cycle param within current level
    //  Hold 1s (from initial): → comms
    //  Hold 3s (from operation): → initial
    //  Hold 1s (from comms): → back to operation
    var HOLD_INITIAL_MS = 3000;
    var HOLD_COMMS_MS   = 1000;
    var HOLD_BACK_MS    = 1000;

    function transitionFor(level, holdMs) {
      if (level === 'operation' && holdMs >= HOLD_INITIAL_MS) return 'initial';
      if (level === 'initial'   && holdMs >= HOLD_COMMS_MS)   return 'comms';
      if (level === 'comms'     && holdMs >= HOLD_BACK_MS)    return 'operation';
      return null;
    }

    function startHold() {
      state.holdStart = Date.now();
      holdProg.classList.add('ec-hold-active');
      holdBar.style.transition = 'none';
      holdBar.style.width = '0%';
      void holdBar.offsetWidth;
      // Animate to full over the relevant max duration
      var maxMs = state.level === 'operation' ? HOLD_INITIAL_MS : HOLD_COMMS_MS;
      holdBar.style.transition = 'width ' + maxMs + 'ms linear';
      holdBar.style.width = '100%';
    }

    function endHold() {
      if (state.holdStart === null) return;
      var elapsed = Date.now() - state.holdStart;
      state.holdStart = null;
      holdProg.classList.remove('ec-hold-active');
      holdBar.style.transition = 'width 200ms ease-out';
      holdBar.style.width = '0%';

      var next = transitionFor(state.level, elapsed);
      if (next) {
        state.level = next;
        state.itemIdx = 0;
        render();
      } else {
        // Short press → next param
        nextParam();
      }
    }

    // Wire buttons
    pad.querySelectorAll('.ec-btn').forEach(function (b) {
      var key = b.getAttribute('data-key');
      b.addEventListener('click', function () {
        if (key === 'up') step(+1);
        else if (key === 'down') step(-1);
        else if (key === 'pf') {
          // PF: short demo — flash and do nothing significant in our model
          flashDisplay(topEl);
        }
        // mode handled below via mousedown/up
      });
      if (key === 'mode') {
        var dn = function () { startHold(); };
        var up = function () { endHold(); };
        b.addEventListener('mousedown', dn);
        b.addEventListener('mouseup', up);
        b.addEventListener('mouseleave', up);
        b.addEventListener('touchstart', function (e) { e.preventDefault(); dn(); }, { passive: false });
        b.addEventListener('touchend',   function (e) { e.preventDefault(); up(); }, { passive: false });
      }
    });

    render();
  }

  function init() {
    document.querySelectorAll('.e5cc-walker').forEach(buildWalker);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
