/* Float32 / 32-bit Modbus Register Converter
 *
 * Markup:
 *   <div class="f32-converter"></div>
 *
 * Solves a common pain point: power meters / inverters return 32-bit floats
 * across two 16-bit Modbus registers — but word order varies by vendor.
 * Schneider PM2230, Delta, Omron, Schneider VFD all do it differently.
 *
 * Widget supports both directions:
 *   - Enter a real value (220.5) → see hex bytes + 4 register orderings
 *   - Enter 2 register hex values → see decoded float in 4 orderings
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // --- IEEE 754 float ⇄ bytes via DataView ----------------------------------
  function floatToBytes(f) {
    var buf = new ArrayBuffer(4);
    var view = new DataView(buf);
    view.setFloat32(0, f, false); // big-endian
    return [view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)];
  }
  function bytesToFloat(b0, b1, b2, b3) {
    var buf = new ArrayBuffer(4);
    var view = new DataView(buf);
    view.setUint8(0, b0); view.setUint8(1, b1); view.setUint8(2, b2); view.setUint8(3, b3);
    return view.getFloat32(0, false);
  }
  function hex2(n) { return ('00' + (n & 0xFF).toString(16).toUpperCase()).slice(-2); }
  function hex4(n) { return ('0000' + (n & 0xFFFF).toString(16).toUpperCase()).slice(-4); }
  function parseHexWord(s) {
    s = String(s).trim().toUpperCase().replace(/^0X/, '').replace(/H$/, '');
    if (!/^[0-9A-F]{1,4}$/.test(s)) return NaN;
    return parseInt(s, 16);
  }

  // 4 word orderings — given bytes [b0,b1,b2,b3] from big-endian float
  // Reg1 holds bytes (b0,b1) by default; Reg2 holds (b2,b3).
  // Standards:
  //   AB CD = big-endian (network) — most "documented" devices like PM2230 manual
  //   CD AB = word-swapped little-endian — Schneider Modicon default
  //   BA DC = byte-swapped — rare
  //   DC BA = full little-endian — Wago, some Delta
  var ORDERINGS = [
    { id: 'ABCD', name: 'AB CD (Big-endian)', vendor: 'PM2230, Omron E5CC' },
    { id: 'CDAB', name: 'CD AB (Word-swap)',  vendor: 'Schneider Modicon, Delta VFD-M' },
    { id: 'BADC', name: 'BA DC (Byte-swap)',  vendor: 'หายาก' },
    { id: 'DCBA', name: 'DC BA (Little-endian)', vendor: 'Wago, Delta บางรุ่น' }
  ];

  function regsForOrder(bytes, order) {
    var b = bytes; // [b0,b1,b2,b3] big-endian
    switch (order) {
      case 'ABCD': return [(b[0]<<8)|b[1], (b[2]<<8)|b[3]];
      case 'CDAB': return [(b[2]<<8)|b[3], (b[0]<<8)|b[1]];
      case 'BADC': return [(b[1]<<8)|b[0], (b[3]<<8)|b[2]];
      case 'DCBA': return [(b[3]<<8)|b[2], (b[1]<<8)|b[0]];
    }
  }
  function bytesFromRegs(reg1, reg2, order) {
    // Reverse of above: given registers as they came off the wire IN the
    // device's order, reconstruct the original IEEE bytes
    var h1 = (reg1 >> 8) & 0xFF, l1 = reg1 & 0xFF;
    var h2 = (reg2 >> 8) & 0xFF, l2 = reg2 & 0xFF;
    switch (order) {
      case 'ABCD': return [h1, l1, h2, l2];
      case 'CDAB': return [h2, l2, h1, l1];
      case 'BADC': return [l1, h1, l2, h2];
      case 'DCBA': return [l2, h2, l1, h1];
    }
  }

  function buildConverter(root) {
    root.innerHTML = '';
    root.classList.add('f32');

    var head = el('div', 'f32-head');
    head.innerHTML =
      '<div class="f32-title">🔢 Float32 ⇄ Modbus Registers</div>' +
      '<div class="f32-desc">เครื่องวัดเหล่านี้ส่งค่าจริง (เช่น แรงดัน 220.5V) เป็น <strong>32-bit float</strong> ' +
      'ที่กระจายอยู่ใน 2 register × 16-bit — แต่ <em>ลำดับ Word</em> ต่างกันตามยี่ห้อ!</div>';
    root.appendChild(head);

    // Mode tabs
    var tabs = el('div', 'f32-tabs');
    var tabFwd = el('button', 'f32-tab f32-tab-active', '🔵 ค่า → Register');
    var tabBack = el('button', 'f32-tab', '🟢 Register → ค่า');
    tabFwd.type = 'button'; tabBack.type = 'button';
    tabs.appendChild(tabFwd); tabs.appendChild(tabBack);
    root.appendChild(tabs);

    // Panels
    var panelFwd = el('div', 'f32-panel');
    var panelBack = el('div', 'f32-panel f32-hidden');

    // ---------- Forward panel: float → registers --------------------------
    panelFwd.innerHTML =
      '<div class="f32-input-row">' +
        '<label class="f32-input-label">ค่าจริง</label>' +
        '<input type="number" class="f32-num" value="220.5" step="0.01">' +
        '<span class="f32-input-hint">(เช่น แรงดัน, กระแส, พลังงาน — IEEE 754 32-bit)</span>' +
      '</div>' +
      '<div class="f32-bytes-section">' +
        '<div class="f32-section-label">IEEE 754 Hex (Big-endian)</div>' +
        '<div class="f32-byte-grid">' +
          '<div class="f32-byte"><div class="f32-byte-tag">A</div><div class="f32-byte-val" id="f32-byte-A">--</div></div>' +
          '<div class="f32-byte"><div class="f32-byte-tag">B</div><div class="f32-byte-val" id="f32-byte-B">--</div></div>' +
          '<div class="f32-byte"><div class="f32-byte-tag">C</div><div class="f32-byte-val" id="f32-byte-C">--</div></div>' +
          '<div class="f32-byte"><div class="f32-byte-tag">D</div><div class="f32-byte-val" id="f32-byte-D">--</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="f32-orderings">' +
        '<div class="f32-section-label">Register Pair (4 รูปแบบ)</div>' +
        '<div class="f32-order-grid" id="f32-order-grid"></div>' +
      '</div>';

    var numInput = panelFwd.querySelector('.f32-num');
    var orderGrid = panelFwd.querySelector('#f32-order-grid');
    var byteEls = {
      A: panelFwd.querySelector('#f32-byte-A'),
      B: panelFwd.querySelector('#f32-byte-B'),
      C: panelFwd.querySelector('#f32-byte-C'),
      D: panelFwd.querySelector('#f32-byte-D')
    };

    function refreshForward() {
      var v = parseFloat(numInput.value);
      if (isNaN(v)) {
        byteEls.A.textContent = byteEls.B.textContent = byteEls.C.textContent = byteEls.D.textContent = '--';
        orderGrid.innerHTML = '<div class="f32-empty">ใส่ค่าที่เป็นตัวเลข</div>';
        return;
      }
      var bytes = floatToBytes(v);
      byteEls.A.textContent = '0x' + hex2(bytes[0]);
      byteEls.B.textContent = '0x' + hex2(bytes[1]);
      byteEls.C.textContent = '0x' + hex2(bytes[2]);
      byteEls.D.textContent = '0x' + hex2(bytes[3]);
      orderGrid.innerHTML = '';
      ORDERINGS.forEach(function (ord) {
        var pair = regsForOrder(bytes, ord.id);
        var card = el('div', 'f32-order-card');
        card.innerHTML =
          '<div class="f32-order-name">' + ord.name + '</div>' +
          '<div class="f32-order-vendor">' + ord.vendor + '</div>' +
          '<div class="f32-order-regs">' +
            '<div class="f32-reg"><span class="f32-reg-tag">Reg 1</span><span class="f32-reg-val">0x' + hex4(pair[0]) + '</span><span class="f32-reg-dec">= ' + pair[0] + '</span></div>' +
            '<div class="f32-reg"><span class="f32-reg-tag">Reg 2</span><span class="f32-reg-val">0x' + hex4(pair[1]) + '</span><span class="f32-reg-dec">= ' + pair[1] + '</span></div>' +
          '</div>';
        orderGrid.appendChild(card);
      });
    }
    numInput.addEventListener('input', refreshForward);
    refreshForward();

    // ---------- Backward panel: registers → float -------------------------
    panelBack.innerHTML =
      '<div class="f32-input-row f32-input-pair">' +
        '<div>' +
          '<label class="f32-input-label">Reg 1 (Hex)</label>' +
          '<input type="text" class="f32-hex" value="437C" maxlength="6" placeholder="0x437C">' +
        '</div>' +
        '<div>' +
          '<label class="f32-input-label">Reg 2 (Hex)</label>' +
          '<input type="text" class="f32-hex" value="C000" maxlength="6" placeholder="0xC000">' +
        '</div>' +
      '</div>' +
      '<div class="f32-decode-grid"></div>' +
      '<div class="f32-hint-strip">' +
        '💡 <strong>วิธีใช้:</strong> เอาค่า Reg 1 และ Reg 2 ที่อ่านได้จาก Modbus (FC 03) มาใส่ → ' +
        'ดูว่าค่าจริงตามรูปแบบไหนสมเหตุสมผล (เช่น แรงดัน 220V → ต้องอยู่ในช่วง 0–500)' +
      '</div>';

    var hexInputs = panelBack.querySelectorAll('.f32-hex');
    var decodeGrid = panelBack.querySelector('.f32-decode-grid');
    function refreshBackward() {
      var r1 = parseHexWord(hexInputs[0].value);
      var r2 = parseHexWord(hexInputs[1].value);
      decodeGrid.innerHTML = '';
      if (isNaN(r1) || isNaN(r2)) {
        decodeGrid.innerHTML = '<div class="f32-empty">ใส่ค่า Hex 4 หลัก (เช่น 437C)</div>';
        return;
      }
      ORDERINGS.forEach(function (ord) {
        var bytes = bytesFromRegs(r1, r2, ord.id);
        var f = bytesToFloat(bytes[0], bytes[1], bytes[2], bytes[3]);
        var fStr;
        if (!isFinite(f)) fStr = '∞ / NaN';
        else if (Math.abs(f) > 1e9 || (Math.abs(f) < 0.001 && f !== 0)) fStr = f.toExponential(4);
        else fStr = f.toFixed(Math.abs(f) >= 1000 ? 1 : 4);
        var likely = isFinite(f) && Math.abs(f) > 0.0001 && Math.abs(f) < 1e8;
        var card = el('div', 'f32-decode-card' + (likely ? ' f32-likely' : ' f32-unlikely'));
        card.innerHTML =
          '<div class="f32-order-name">' + ord.name + '</div>' +
          '<div class="f32-order-vendor">' + ord.vendor + '</div>' +
          '<div class="f32-decode-val">' + fStr + '</div>' +
          (likely ? '<div class="f32-likely-tag">✓ น่าจะใช่</div>' : '<div class="f32-unlikely-tag">⚠️ ดูไม่เข้าท่า</div>');
        decodeGrid.appendChild(card);
      });
    }
    hexInputs.forEach(function (i) { i.addEventListener('input', refreshBackward); });
    refreshBackward();

    root.appendChild(panelFwd);
    root.appendChild(panelBack);

    // Tab wiring
    function switchTab(forward) {
      tabFwd.classList.toggle('f32-tab-active', forward);
      tabBack.classList.toggle('f32-tab-active', !forward);
      panelFwd.classList.toggle('f32-hidden', !forward);
      panelBack.classList.toggle('f32-hidden', forward);
    }
    tabFwd.addEventListener('click', function () { switchTab(true); });
    tabBack.addEventListener('click', function () { switchTab(false); });
  }

  function init() {
    document.querySelectorAll('.f32-converter').forEach(buildConverter);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
