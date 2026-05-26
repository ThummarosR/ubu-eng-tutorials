/* PLC Model Code Decoder
 *
 * Markup:
 *   <div class="model-decoder" data-series="fx5u"></div>
 *   <div class="model-decoder" data-series="cp1l"></div>
 *
 * Each segment of the model code is a clickable chip → dropdown to swap option.
 * Bottom panel shows what changes when you do (output type, power source, etc).
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // --- Series definitions --------------------------------------------------
  var SERIES = {
    fx5u: {
      title: 'Mitsubishi MELSEC iQ-F — FX5U',
      prefix: 'FX5U-',
      separator: '',
      segments: [
        {
          id: 'io', label: 'I/O Count', type: 'select',
          options: [
            { v: '16', n: '16 I/O', desc: '8 IN + 8 OUT — งานเล็ก' },
            { v: '32', n: '32 I/O', desc: '16 IN + 16 OUT — รุ่นที่ใช้ในคู่มือนี้', recommended: true },
            { v: '64', n: '64 I/O', desc: '32 IN + 32 OUT — งานกลาง' },
            { v: '80', n: '80 I/O', desc: '40 IN + 40 OUT — งานใหญ่' }
          ]
        },
        {
          id: 'type', label: 'Unit Type', type: 'fixed', value: 'M',
          desc: 'M = Main Unit (CPU หลัก ไม่ใช่ Extension)'
        },
        {
          id: 'out', label: 'Output Type', type: 'select',
          options: [
            { v: 'T', n: 'T = Transistor', desc: 'เร็ว · ทำ PWM/Pulse ได้ · อายุยืน · กระแสต่ำ (~0.5A)', recommended: true },
            { v: 'R', n: 'R = Relay',      desc: 'ทนกระแสสูง (~2A) · อายุจำกัด ~100k ครั้ง · ช้ากว่า' }
          ]
        },
        {
          id: 'power', label: 'Power + Input', type: 'select', prefix: '/',
          options: [
            { v: 'ES',  n: '/ES — AC + Sink IN',      desc: '100–240VAC · Input ต่อ +V Common (Sink)', recommended: true },
            { v: 'ESS', n: '/ESS — AC + Source IN',   desc: '100–240VAC · Input ต่อ 0V Common (Source)' },
            { v: 'DS',  n: '/DS — DC24V + Sink IN',   desc: 'DC 24V · Sink Input' },
            { v: 'DSS', n: '/DSS — DC24V + Source IN',desc: 'DC 24V · Source Input' }
          ]
        }
      ],
      defaults: { io: '32', out: 'T', power: 'ES' },
      sinkSource: 'power'
    },
    cp1l: {
      title: 'Omron CP1L (Micro PLC)',
      prefix: 'CP1L-',
      separator: '',
      segments: [
        {
          id: 'expansion', label: 'Expansion', type: 'select',
          options: [
            { v: '',  n: '(เว้นว่าง) — Basic', desc: 'CP1L มาตรฐาน · ไม่มี Ethernet ในตัว' },
            { v: 'E', n: 'E — Ethernet',       desc: 'มี Ethernet port (FINS + Modbus TCP)', recommended: true }
          ]
        },
        {
          id: 'memory', label: 'Memory', type: 'select',
          options: [
            { v: 'L', n: 'L — 5k step', desc: 'Memory 5,000 step — งานเล็ก' },
            { v: 'M', n: 'M — 10k step',desc: 'Memory 10,000 step — งานทั่วไป', recommended: true }
          ]
        },
        {
          id: 'io', label: 'I/O Count', type: 'select',
          options: [
            { v: '10', n: '10 I/O', desc: '6 IN + 4 OUT' },
            { v: '14', n: '14 I/O', desc: '8 IN + 6 OUT' },
            { v: '20', n: '20 I/O', desc: '12 IN + 8 OUT' },
            { v: '30', n: '30 I/O', desc: '18 IN + 12 OUT — รุ่นที่ใช้ในคู่มือนี้', recommended: true },
            { v: '40', n: '40 I/O', desc: '24 IN + 16 OUT' },
            { v: '60', n: '60 I/O', desc: '36 IN + 24 OUT' }
          ]
        },
        {
          id: 'input', label: 'Input Type', type: 'fixed', value: 'D',
          desc: 'D = DC 24V Input (มาตรฐาน)'
        },
        {
          id: 'out', label: 'Output Type', type: 'select',
          options: [
            { v: 'T',  n: 'T — Transistor Sink',  desc: 'Output ต่อ Load → +24V (Sink) · เร็ว · PWM ได้', recommended: true },
            { v: 'T1', n: 'T1 — Transistor Source',desc: 'Output ต่อ Load → 0V (Source)' },
            { v: 'R',  n: 'R — Relay',             desc: 'ทนกระแสสูง · ช้า · อายุจำกัด' }
          ]
        },
        {
          id: 'power', label: 'Power Supply', type: 'select', prefix: '-',
          options: [
            { v: 'A', n: '-A — AC 100–240V', desc: 'ปลั๊กไฟบ้านได้เลย — รุ่น Lab' },
            { v: 'D', n: '-D — DC 24V',      desc: 'ใช้กับแหล่งจ่าย DC 24V (เช่น MEAN WELL)', recommended: true }
          ]
        }
      ],
      defaults: { expansion: 'E', memory: 'M', io: '30', out: 'T', power: 'D' }
    }
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function getValue(seg, state) {
    if (seg.type === 'fixed') return seg.value;
    return state[seg.id];
  }
  function buildModelString(series, state) {
    var parts = [series.prefix];
    series.segments.forEach(function (seg) {
      var v = getValue(seg, state);
      if (seg.prefix) parts.push(seg.prefix + v);
      else parts.push(v);
    });
    return parts.join('');
  }
  function findOption(seg, v) {
    if (seg.type === 'fixed') return { v: seg.value, n: seg.value, desc: seg.desc };
    for (var i = 0; i < seg.options.length; i++) if (seg.options[i].v === v) return seg.options[i];
    return seg.options[0];
  }

  function buildDecoder(root) {
    var seriesId = root.getAttribute('data-series') || 'fx5u';
    var series = SERIES[seriesId];
    if (!series) {
      root.innerHTML = '<div class="md-error">ไม่รู้จัก series: ' + seriesId + '</div>';
      return;
    }
    root.innerHTML = '';
    root.classList.add('md');
    var state = Object.assign({}, series.defaults);

    // ---------- Header ----------------------------------------------------
    var head = el('div', 'md-head');
    head.innerHTML =
      '<div class="md-title">🔍 ' + escapeHtml(series.title) + ' — ถอดรหัสรุ่น</div>' +
      '<div class="md-desc">คลิกที่ตัวอักษรในรหัสรุ่นเพื่อดูตัวเลือกอื่น ๆ และเปรียบเทียบ</div>';
    root.appendChild(head);

    // ---------- Model string display --------------------------------------
    var modelLine = el('div', 'md-model-line');
    var modelText = el('span', 'md-model-text');
    modelLine.appendChild(modelText);
    root.appendChild(modelLine);

    // ---------- Segment chips ---------------------------------------------
    var chipRow = el('div', 'md-chip-row');
    var chipEls = {}; // id -> { chip, valEl, descBlock }

    series.segments.forEach(function (seg) {
      var chip = el('div', 'md-chip md-chip-' + (seg.type === 'fixed' ? 'fixed' : 'interactive'));
      var labelEl = el('div', 'md-chip-label', seg.label);
      var valEl = el('div', 'md-chip-val');
      chip.appendChild(labelEl);
      chip.appendChild(valEl);

      if (seg.type === 'select') {
        var arrow = el('span', 'md-chip-arrow', '▾');
        valEl.appendChild(arrow);
        chip.style.cursor = 'pointer';
      }

      chipRow.appendChild(chip);
      chipEls[seg.id] = { chip: chip, valEl: valEl, seg: seg };
    });
    root.appendChild(chipRow);

    // ---------- Detail panel (clicking chip opens options here) -----------
    var detailWrap = el('div', 'md-detail');
    root.appendChild(detailWrap);
    var activeSegId = null;

    function renderDetail(segId) {
      activeSegId = segId;
      detailWrap.innerHTML = '';
      // De-highlight all chips
      Object.keys(chipEls).forEach(function (id) {
        chipEls[id].chip.classList.toggle('md-chip-active', id === segId);
      });
      if (!segId) return;
      var seg = chipEls[segId].seg;
      var card = el('div', 'md-detail-card');

      var titleRow = el('div', 'md-detail-title', seg.label);
      card.appendChild(titleRow);

      if (seg.type === 'fixed') {
        card.appendChild(el('div', 'md-detail-fixed', '<strong>' + seg.value + '</strong> — ' + escapeHtml(seg.desc) + ' <span class="md-locked">🔒 ไม่เปลี่ยนได้</span>'));
      } else {
        var optsWrap = el('div', 'md-options');
        seg.options.forEach(function (opt) {
          var optEl = el('button', 'md-option' + (opt.v === state[seg.id] ? ' md-option-selected' : '') + (opt.recommended ? ' md-option-rec' : ''));
          optEl.type = 'button';
          optEl.innerHTML =
            '<div class="md-option-val">' + (opt.recommended ? '★ ' : '') + escapeHtml(opt.n) + '</div>' +
            '<div class="md-option-desc">' + escapeHtml(opt.desc) + '</div>';
          optEl.addEventListener('click', function () {
            state[seg.id] = opt.v;
            refreshAll();
            renderDetail(segId);
          });
          optsWrap.appendChild(optEl);
        });
        card.appendChild(optsWrap);
      }
      detailWrap.appendChild(card);
    }

    function refreshAll() {
      // Update model line
      var modelStr = buildModelString(series, state);
      modelText.innerHTML = '';
      // Build with each segment as a span
      var prefixSpan = el('span', 'md-mt-prefix', escapeHtml(series.prefix));
      modelText.appendChild(prefixSpan);
      series.segments.forEach(function (seg) {
        if (seg.prefix) {
          var sep = el('span', 'md-mt-sep', escapeHtml(seg.prefix));
          modelText.appendChild(sep);
        }
        var v = getValue(seg, state);
        var span = el('span', 'md-mt-part md-mt-' + seg.id + (seg.type === 'fixed' ? ' md-mt-fixed' : ' md-mt-interactive') + (activeSegId === seg.id ? ' md-mt-active' : ''), escapeHtml(v));
        if (seg.type === 'select') {
          span.style.cursor = 'pointer';
          span.addEventListener('click', function () {
            renderDetail(seg.id);
          });
        }
        modelText.appendChild(span);
      });
      // Update chips
      series.segments.forEach(function (seg) {
        var opt = findOption(seg, state[seg.id]);
        var label = seg.type === 'fixed' ? seg.value : opt.v;
        chipEls[seg.id].valEl.textContent = '';
        var val = el('span', 'md-chip-v', label);
        chipEls[seg.id].valEl.appendChild(val);
        if (seg.type === 'select') {
          var arrow = el('span', 'md-chip-arrow', ' ▾');
          chipEls[seg.id].valEl.appendChild(arrow);
        }
      });
    }

    // Wire chip clicks
    series.segments.forEach(function (seg) {
      if (seg.type === 'select') {
        chipEls[seg.id].chip.addEventListener('click', function () {
          renderDetail(seg.id);
        });
      }
    });

    refreshAll();
    // Open first interactive segment by default for visual cue
    var firstInteractive = series.segments.find(function (s) { return s.type === 'select'; });
    if (firstInteractive) renderDetail(firstInteractive.id);
  }

  function init() {
    document.querySelectorAll('.model-decoder').forEach(buildDecoder);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
