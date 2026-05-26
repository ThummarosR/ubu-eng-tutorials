/* Modbus RTU Frame Builder
 *
 * Markup:
 *   <div class="modbus-builder"></div>
 *
 * Student picks Slave Address / Function Code / Register / Value-or-Count,
 * the widget builds the actual Modbus RTU frame with CRC-16, color-codes each
 * field, and shows a mock slave response.
 *
 * Supported Function Codes (v1):
 *   01 — Read Coils
 *   03 — Read Holding Registers   (most common)
 *   05 — Write Single Coil
 *   06 — Write Single Register    (second most common)
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // ---------- CRC-16 (Modbus, polynomial 0xA001) ----------------------------
  function crc16Modbus(bytes) {
    var crc = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] & 0xFF;
      for (var j = 0; j < 8; j++) {
        if (crc & 1) crc = (crc >>> 1) ^ 0xA001;
        else crc >>>= 1;
      }
    }
    return crc & 0xFFFF;
  }

  function toHex2(n) {
    var s = (n & 0xFF).toString(16).toUpperCase();
    return s.length < 2 ? '0' + s : s;
  }
  function parseInput(str) {
    if (str == null) return 0;
    str = String(str).trim();
    if (str === '') return 0;
    if (/^0x[0-9a-f]+$/i.test(str)) return parseInt(str, 16);
    if (/^[0-9]+$/.test(str)) return parseInt(str, 10);
    if (/^[0-9a-f]+h?$/i.test(str)) return parseInt(str.replace(/h$/i, ''), 16);
    return 0;
  }

  // ---------- Function-code metadata ---------------------------------------
  // For each FC: how to build the request, what the response looks like, labels.
  var FCS = {
    1: {
      name: 'Read Coils',
      reqFields: [
        { label: 'Address (start)', key: 'addr', bytes: 2, hint: '0x0000 – 0xFFFF' },
        { label: 'Quantity of coils', key: 'count', bytes: 2, hint: '1–2000' }
      ],
      buildResponse: function (slave, p) {
        var n = p.count || 1;
        var byteCount = Math.ceil(n / 8);
        var coilData = [];
        for (var i = 0; i < byteCount; i++) coilData.push(0); // mock all OFF
        // First coil ON for demo
        if (coilData.length) coilData[0] = 0x01;
        return [slave, 1, byteCount].concat(coilData);
      },
      decodeResponse: function (resp) {
        var bc = resp[2];
        var bits = [];
        for (var i = 0; i < bc; i++) {
          var b = resp[3 + i];
          for (var k = 0; k < 8; k++) bits.push((b >> k) & 1);
        }
        return 'Coils[0..' + (bits.length - 1) + '] = [' + bits.join(',') + ']';
      }
    },
    3: {
      name: 'Read Holding Registers',
      reqFields: [
        { label: 'Address (start)', key: 'addr', bytes: 2, hint: '0x0000 – 0xFFFF' },
        { label: 'Quantity of registers', key: 'count', bytes: 2, hint: '1–125' }
      ],
      buildResponse: function (slave, p) {
        var n = p.count || 1;
        var byteCount = n * 2;
        var data = [];
        // Mock value: 0x02EE = 750 (=75.0°C if scaled by 10)
        data.push(0x02, 0xEE);
        for (var i = 1; i < n; i++) data.push(0x00, 0x00);
        return [slave, 3, byteCount].concat(data);
      },
      decodeResponse: function (resp) {
        var bc = resp[2];
        var values = [];
        for (var i = 0; i < bc; i += 2) {
          values.push((resp[3 + i] << 8) | resp[3 + i + 1]);
        }
        var v = values[0];
        return 'Reg[0] = 0x' + toHex4(v) + ' = ' + v + ' (≈ ' + (v / 10).toFixed(1) + ' if ×10 scale)';
      }
    },
    5: {
      name: 'Write Single Coil',
      reqFields: [
        { label: 'Coil Address', key: 'addr', bytes: 2, hint: '0x0000 – 0xFFFF' },
        { label: 'Value', key: 'coilVal', bytes: 2, hint: 'ON = 0xFF00 · OFF = 0x0000', preset: 'coil' }
      ],
      buildResponse: function (slave, p) {
        // Slave echoes the request
        return [slave, 5,
          (p.addr >> 8) & 0xFF, p.addr & 0xFF,
          (p.coilVal >> 8) & 0xFF, p.coilVal & 0xFF
        ];
      },
      decodeResponse: function (resp) {
        var val = (resp[4] << 8) | resp[5];
        return 'Coil ' + (val === 0xFF00 ? 'ON' : 'OFF') + ' (echo)';
      }
    },
    6: {
      name: 'Write Single Register',
      reqFields: [
        { label: 'Register Address', key: 'addr', bytes: 2, hint: '0x0000 – 0xFFFF' },
        { label: 'Value (decimal or 0xhex)', key: 'value', bytes: 2, hint: 'e.g. 500 = 50.0 with ×10 scale' }
      ],
      buildResponse: function (slave, p) {
        // Slave echoes the request
        return [slave, 6,
          (p.addr >> 8) & 0xFF, p.addr & 0xFF,
          (p.value >> 8) & 0xFF, p.value & 0xFF
        ];
      },
      decodeResponse: function (resp) {
        var v = (resp[4] << 8) | resp[5];
        return 'Wrote 0x' + toHex4(v) + ' = ' + v + ' (echo)';
      }
    }
  };

  function toHex4(n) {
    var s = (n & 0xFFFF).toString(16).toUpperCase();
    while (s.length < 4) s = '0' + s;
    return s;
  }

  // ---------- Field colors for visualization --------------------------------
  // Each "field" in the frame gets a color so the byte block + breakdown row
  // share the same hue.
  var FIELD_COLOR = {
    slave: 'sl',    // green
    fc: 'fc',       // orange
    addr: 'ad',     // cyan
    count: 'ct',    // violet
    value: 'ct',
    coilVal: 'ct',
    bc: 'bc',       // pink
    data: 'dt',     // amber
    crc: 'cr'       // red
  };

  // ---------- DOM helpers ---------------------------------------------------
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

  // ---------- Build one instance --------------------------------------------
  function buildBuilder(root) {
    root.innerHTML = '';
    root.classList.add('mbb');

    // State
    var state = {
      slave: 1,
      fc: 3,
      addr: 0x2103,
      count: 1,
      value: 250,
      coilVal: 0xFF00
    };

    // ---------- Header ------------------------------------------------------
    var head = el('div', 'mbb-head');
    head.innerHTML =
      '<div class="mbb-title">📡 Modbus RTU Frame Builder</div>' +
      '<div class="mbb-desc">เลือก Slave / FC / Address / Value → ดู frame จริงพร้อม CRC-16 ที่จะออกสาย RS-485</div>';
    root.appendChild(head);

    // ---------- Inputs panel ------------------------------------------------
    var inPanel = el('div', 'mbb-panel');
    inPanel.innerHTML = '<div class="mbb-panel-label">🎛️ Inputs</div>';
    var inGrid = el('div', 'mbb-input-grid');
    inPanel.appendChild(inGrid);
    root.appendChild(inPanel);

    function makeNumInput(label, hint, val, onChange, idAttr) {
      var w = el('div', 'mbb-field');
      w.innerHTML =
        '<label>' + escapeHtml(label) + '</label>' +
        '<input type="text" value="' + escapeHtml(String(val)) + '">' +
        '<div class="mbb-hint">' + escapeHtml(hint) + '</div>';
      var inp = w.querySelector('input');
      if (idAttr) inp.dataset.field = idAttr;
      inp.addEventListener('input', function () {
        onChange(parseInput(inp.value));
      });
      return w;
    }
    function makeFcSelect(val, onChange) {
      var w = el('div', 'mbb-field');
      var opts = '';
      [1,3,5,6].forEach(function (k) {
        opts += '<option value="' + k + '"' + (k === val ? ' selected' : '') + '>'
              + toHex2(k) + ' — ' + FCS[k].name + '</option>';
      });
      w.innerHTML =
        '<label>Function Code</label>' +
        '<select>' + opts + '</select>' +
        '<div class="mbb-hint">เลือกประเภทคำสั่ง — Read/Write, Coil/Register</div>';
      w.querySelector('select').addEventListener('change', function (e) {
        onChange(parseInt(e.target.value, 10));
      });
      return w;
    }
    function makeCoilValSelect(val, onChange) {
      var w = el('div', 'mbb-field');
      w.innerHTML =
        '<label>Value</label>' +
        '<select>' +
          '<option value="65280"' + (val === 0xFF00 ? ' selected' : '') + '>0xFF00 — ON</option>' +
          '<option value="0"' + (val === 0 ? ' selected' : '') + '>0x0000 — OFF</option>' +
        '</select>' +
        '<div class="mbb-hint">Modbus มีแค่ 2 ค่าที่ใช้ได้ — ON หรือ OFF</div>';
      w.querySelector('select').addEventListener('change', function (e) {
        onChange(parseInt(e.target.value, 10));
      });
      return w;
    }

    // ---------- Frame visual panel -----------------------------------------
    var framePanel = el('div', 'mbb-panel');
    framePanel.innerHTML = '<div class="mbb-panel-label">📤 Master Request Frame</div>';
    var frameBytes = el('div', 'mbb-frame-bytes');
    framePanel.appendChild(frameBytes);
    var frameRow = el('div', 'mbb-frame-row');
    framePanel.appendChild(frameRow);
    root.appendChild(framePanel);

    // ---------- Response panel ---------------------------------------------
    var respPanel = el('div', 'mbb-panel');
    respPanel.innerHTML = '<div class="mbb-panel-label">📥 Slave Response (mock)</div>';
    var respBytes = el('div', 'mbb-frame-bytes');
    respPanel.appendChild(respBytes);
    var respDecoded = el('div', 'mbb-response-decoded');
    respPanel.appendChild(respDecoded);
    root.appendChild(respPanel);

    // ---------- Re-render ---------------------------------------------------
    function rebuildInputs() {
      inGrid.innerHTML = '';
      inGrid.appendChild(makeNumInput('Slave Address', '1–247 (0 = broadcast)', state.slave, function (v) {
        state.slave = Math.max(0, Math.min(247, v)); render();
      }));
      inGrid.appendChild(makeFcSelect(state.fc, function (v) { state.fc = v; rebuildInputs(); render(); }));
      var fc = FCS[state.fc];
      fc.reqFields.forEach(function (f) {
        if (f.preset === 'coil') {
          inGrid.appendChild(makeCoilValSelect(state[f.key], function (v) { state[f.key] = v; render(); }));
        } else {
          var displayVal;
          if (f.key === 'addr') displayVal = '0x' + toHex4(state.addr);
          else displayVal = state[f.key];
          inGrid.appendChild(makeNumInput(f.label, f.hint, displayVal, function (v) {
            state[f.key] = v; render();
          }));
        }
      });
    }

    function render() {
      // Build request bytes + fields
      var bytes = [];
      var fields = []; // {start, len, key, label, value}

      function push(byte, key, label) {
        bytes.push(byte & 0xFF);
        fields.push({ start: bytes.length - 1, len: 1, key: key, label: label, value: byte });
      }
      function pushWord(word, key, label) {
        var hi = (word >> 8) & 0xFF, lo = word & 0xFF;
        bytes.push(hi, lo);
        fields.push({ start: bytes.length - 2, len: 2, key: key, label: label, value: word });
      }

      push(state.slave, 'slave', 'Slave Address');
      push(state.fc, 'fc', 'Function Code');
      var fc = FCS[state.fc];
      fc.reqFields.forEach(function (f) {
        var v = state[f.key];
        pushWord(v, f.key, f.label);
      });
      var crc = crc16Modbus(bytes);
      // Modbus CRC byte order: LSB first
      var crcLo = crc & 0xFF, crcHi = (crc >> 8) & 0xFF;
      bytes.push(crcLo, crcHi);
      fields.push({ start: bytes.length - 2, len: 2, key: 'crc', label: 'CRC-16', value: crc });

      paintFrame(frameBytes, frameRow, bytes, fields);

      // Build response
      var respRaw = fc.buildResponse(state.slave, state);
      var respBytesArr = respRaw.slice();
      var respCrc = crc16Modbus(respBytesArr);
      respBytesArr.push(respCrc & 0xFF, (respCrc >> 8) & 0xFF);

      // Build response field map
      var respFields = [
        { start: 0, len: 1, key: 'slave', label: 'Slave' },
        { start: 1, len: 1, key: 'fc',    label: 'FC' }
      ];
      if (state.fc === 1 || state.fc === 3) {
        respFields.push({ start: 2, len: 1, key: 'bc', label: 'Byte Count' });
        respFields.push({ start: 3, len: respBytesArr.length - 5, key: 'data', label: 'Data' });
      } else if (state.fc === 5 || state.fc === 6) {
        respFields.push({ start: 2, len: 2, key: 'addr',  label: 'Address (echo)' });
        respFields.push({ start: 4, len: 2, key: 'value', label: 'Value (echo)' });
      }
      respFields.push({ start: respBytesArr.length - 2, len: 2, key: 'crc', label: 'CRC-16' });

      paintFrame(respBytes, null, respBytesArr, respFields);

      // Decoded summary
      respDecoded.innerHTML =
        '<strong>→ Decoded:</strong> ' + escapeHtml(fc.decodeResponse(respBytesArr));
    }

    function paintFrame(bytesContainer, rowContainer, bytes, fields) {
      // Render the byte cells
      bytesContainer.innerHTML = '';
      bytes.forEach(function (b, i) {
        // Find which field this byte belongs to
        var f = fields.find(function (ff) {
          return i >= ff.start && i < ff.start + ff.len;
        });
        var cls = f ? ('mbb-byte tone-' + (FIELD_COLOR[f.key] || 'dt')) : 'mbb-byte';
        var cell = el('div', cls);
        cell.innerHTML = '<span class="mbb-byte-hex">' + toHex2(b) + '</span>' +
                         '<span class="mbb-byte-idx">' + i + '</span>';
        if (f) cell.title = f.label;
        bytesContainer.appendChild(cell);
      });
      // Field breakdown row (only for request frame, optional)
      if (rowContainer) {
        rowContainer.innerHTML = '';
        var row = el('div', 'mbb-frame-fields');
        fields.forEach(function (f) {
          var chip = el('div', 'mbb-field-chip tone-' + (FIELD_COLOR[f.key] || 'dt'));
          var valDisp;
          if (f.len === 2) valDisp = '0x' + toHex4(f.value) + ' = ' + (f.value & 0xFFFF);
          else valDisp = '0x' + toHex2(f.value) + ' = ' + f.value;
          chip.innerHTML =
            '<div class="mbb-field-chip-label">' + escapeHtml(f.label) + '</div>' +
            '<div class="mbb-field-chip-val">' + valDisp + '</div>';
          row.appendChild(chip);
        });
        rowContainer.appendChild(row);
      }
    }

    rebuildInputs();
    render();
  }

  // ---------- Init -----------------------------------------------------------
  function init() {
    document.querySelectorAll('.modbus-builder').forEach(function (el) {
      buildBuilder(el);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
