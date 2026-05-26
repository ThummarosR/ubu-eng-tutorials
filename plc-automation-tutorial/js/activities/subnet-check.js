/* IP Subnet Validator
 *
 * Markup:
 *   <div class="subnet-check"></div>
 *
 * Helps students figure out: can PLC (192.168.3.250/24) talk to HMI (192.168.3.100/24)?
 * Shows network/broadcast/host range and a "same subnet?" check between 2 devices.
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

  function parseIp(s) {
    var parts = String(s).trim().split('.');
    if (parts.length !== 4) return null;
    var out = [];
    for (var i = 0; i < 4; i++) {
      var n = parseInt(parts[i], 10);
      if (isNaN(n) || n < 0 || n > 255 || !/^\d+$/.test(parts[i])) return null;
      out.push(n);
    }
    return out;
  }
  function ipToInt(b) { return ((b[0]<<24)|(b[1]<<16)|(b[2]<<8)|b[3]) >>> 0; }
  function intToIp(n) {
    return [(n>>>24)&0xFF, (n>>>16)&0xFF, (n>>>8)&0xFF, n&0xFF].join('.');
  }
  function prefixToMaskInt(prefix) {
    if (prefix <= 0) return 0;
    if (prefix >= 32) return 0xFFFFFFFF;
    return (0xFFFFFFFF << (32 - prefix)) >>> 0;
  }
  function maskIntToPrefix(m) {
    var p = 0; var seen0 = false;
    for (var i = 31; i >= 0; i--) {
      var b = (m >>> i) & 1;
      if (b === 1) {
        if (seen0) return -1; // invalid (1 after 0)
        p++;
      } else {
        seen0 = true;
      }
    }
    return p;
  }
  function ipClass(firstOctet) {
    if (firstOctet >= 1   && firstOctet <= 126) return 'A';
    if (firstOctet >= 128 && firstOctet <= 191) return 'B';
    if (firstOctet >= 192 && firstOctet <= 223) return 'C';
    if (firstOctet >= 224 && firstOctet <= 239) return 'D (Multicast)';
    return 'E (Experimental)';
  }
  function isPrivate(b) {
    if (b[0] === 10) return true;
    if (b[0] === 172 && b[1] >= 16 && b[1] <= 31) return true;
    if (b[0] === 192 && b[1] === 168) return true;
    return false;
  }

  // Common masks list
  var MASKS = [
    { prefix: 24, mask: '255.255.255.0',   note: 'มาตรฐาน /24 · 256 IP · งานทั่วไป' },
    { prefix: 16, mask: '255.255.0.0',     note: 'Class B · 65,536 IP' },
    { prefix: 8,  mask: '255.0.0.0',       note: 'Class A · 16.7M IP' },
    { prefix: 25, mask: '255.255.255.128', note: '128 IP — แยก 2 segment' },
    { prefix: 26, mask: '255.255.255.192', note: '64 IP — quad segments' },
    { prefix: 30, mask: '255.255.255.252', note: 'P2P link · 2 host' }
  ];

  function buildChecker(root) {
    root.innerHTML = '';
    root.classList.add('sn');

    var head = el('div', 'sn-head');
    head.innerHTML =
      '<div class="sn-title">🌐 IP Subnet Checker — PLC คุยกับ HMI ได้ไหม?</div>' +
      '<div class="sn-desc">กรอก IP ของอุปกรณ์ 2 ตัว + Subnet Mask → ระบบบอกว่าอยู่ subnet เดียวกันไหม (คุยกันตรงได้)</div>';
    root.appendChild(head);

    var devs = [
      { name: 'PLC',      ip: '192.168.3.250', placeholder: 'FX5U / CP1L' },
      { name: 'HMI / PC', ip: '192.168.3.100', placeholder: 'Samkoon / PC' }
    ];

    var inputs = el('div', 'sn-inputs');
    devs.forEach(function (d, idx) {
      var row = el('div', 'sn-input-row');
      row.innerHTML =
        '<div class="sn-input-name">' + d.name + '</div>' +
        '<input type="text" class="sn-ip" value="' + d.ip + '" placeholder="' + d.placeholder + '" data-idx="' + idx + '">';
      inputs.appendChild(row);
    });
    // Mask
    var maskRow = el('div', 'sn-input-row sn-input-row-mask');
    var maskOptions = MASKS.map(function (m) {
      return '<option value="' + m.prefix + '" ' + (m.prefix === 24 ? 'selected' : '') + '>/' + m.prefix + ' — ' + m.mask + ' · ' + m.note + '</option>';
    }).join('');
    maskRow.innerHTML =
      '<div class="sn-input-name">Subnet Mask</div>' +
      '<select class="sn-mask">' + maskOptions + '</select>';
    inputs.appendChild(maskRow);
    root.appendChild(inputs);

    // Verdict + details
    var verdict = el('div', 'sn-verdict');
    root.appendChild(verdict);

    var details = el('div', 'sn-details');
    root.appendChild(details);

    var ipInputs = root.querySelectorAll('.sn-ip');
    var maskSel = root.querySelector('.sn-mask');
    ipInputs.forEach(function (i) { i.addEventListener('input', refresh); });
    maskSel.addEventListener('change', refresh);

    function refresh() {
      var prefix = parseInt(maskSel.value, 10);
      var maskInt = prefixToMaskInt(prefix);
      var maskStr = intToIp(maskInt);

      var ips = []; var errs = []; var parsed = [];
      for (var i = 0; i < ipInputs.length; i++) {
        var raw = ipInputs[i].value;
        var b = parseIp(raw);
        ips.push(raw);
        if (b === null) {
          errs.push(devs[i].name + ': IP ไม่ถูกต้อง (รูปแบบต้องเป็น A.B.C.D ที่ 0–255)');
          parsed.push(null);
        } else {
          parsed.push(b);
        }
      }

      details.innerHTML = '';
      verdict.innerHTML = '';

      if (errs.length) {
        verdict.className = 'sn-verdict sn-verdict-err';
        verdict.innerHTML = '<div class="sn-verdict-icon">⚠️</div><div>' + errs.join(' · ') + '</div>';
        return;
      }

      // Compute network for each
      var nets = parsed.map(function (b) {
        var ipInt = ipToInt(b);
        var netInt = (ipInt & maskInt) >>> 0;
        var bcastInt = (netInt | (~maskInt >>> 0)) >>> 0;
        return { ipInt: ipInt, netInt: netInt, bcastInt: bcastInt, bytes: b };
      });
      var sameSubnet = nets[0].netInt === nets[1].netInt;
      var sameIp = nets[0].ipInt === nets[1].ipInt;

      // Special invalid cases per device
      var notes = []; var anyInvalid = false;
      [0, 1].forEach(function (i) {
        var n = nets[i];
        if (n.ipInt === n.netInt && prefix < 31) {
          notes.push(devs[i].name + ': IP ตรงกับ Network address (ห้ามใช้)');
          anyInvalid = true;
        } else if (n.ipInt === n.bcastInt && prefix < 31) {
          notes.push(devs[i].name + ': IP ตรงกับ Broadcast address (ห้ามใช้)');
          anyInvalid = true;
        }
      });

      // Verdict
      if (sameIp) {
        verdict.className = 'sn-verdict sn-verdict-fail';
        verdict.innerHTML =
          '<div class="sn-verdict-icon">✗</div>' +
          '<div><strong>IP ชนกัน!</strong> — ' + devs[0].name + ' และ ' + devs[1].name +
          ' ตั้งเป็น IP เดียวกัน — จะเกิด <em>IP Conflict</em> · อุปกรณ์ใด ๆ ในเครือข่ายต้องมี IP <strong>ไม่ซ้ำกัน</strong></div>';
      } else if (anyInvalid) {
        verdict.className = 'sn-verdict sn-verdict-fail';
        verdict.innerHTML =
          '<div class="sn-verdict-icon">✗</div>' +
          '<div><strong>IP ที่ใช้ไม่ได้</strong> — ' + notes.join(' · ') + '</div>';
      } else if (sameSubnet) {
        verdict.className = 'sn-verdict sn-verdict-ok';
        verdict.innerHTML =
          '<div class="sn-verdict-icon">✓</div>' +
          '<div><strong>Same Subnet</strong> — ' + devs[0].name + ' กับ ' + devs[1].name + ' คุยกันได้โดยตรง (ผ่าน Switch / สาย LAN ตรง ไม่ต้องมี Router)</div>';
      } else {
        verdict.className = 'sn-verdict sn-verdict-fail';
        verdict.innerHTML =
          '<div class="sn-verdict-icon">✗</div>' +
          '<div><strong>Different Subnets!</strong> — คุยตรงไม่ได้ ต้องผ่าน Router หรือเปลี่ยน Mask/IP ให้ตรงกัน</div>';
      }

      // Details — single unified card with all subnet info + per-device breakdown
      var hostBits = 32 - prefix;
      var hostCount = hostBits >= 31 ? 0 : Math.pow(2, hostBits) - 2;
      var netStr = intToIp(nets[0].netInt);
      var bcastStr = intToIp(nets[0].bcastInt);
      var firstStr = intToIp((nets[0].netInt + 1) >>> 0);
      var lastStr = intToIp((nets[0].bcastInt - 1) >>> 0);

      // Subnet card for device 1
      var card1 = el('div', 'sn-card');
      card1.innerHTML =
        '<div class="sn-card-label">Subnet ของ ' + devs[0].name + '  ·  /' + prefix + '  =  ' + maskStr + '</div>' +
        '<div class="sn-card-grid">' +
          '<div class="sn-kv"><span>Network</span><code>' + netStr + '</code></div>' +
          '<div class="sn-kv"><span>Broadcast</span><code>' + bcastStr + '</code></div>' +
          '<div class="sn-kv"><span>Host range</span><code>' + firstStr + ' – ' + lastStr + '</code></div>' +
          '<div class="sn-kv"><span>Host count</span><code>' + hostCount.toLocaleString() + '</code></div>' +
          '<div class="sn-kv"><span>IP Class</span><code>' + ipClass(parsed[0][0]) + (isPrivate(parsed[0]) ? ' · Private' : ' · Public') + '</code></div>' +
          '<div class="sn-kv"><span>Mask (binary)</span><code class="sn-binary">' + maskBinary(maskInt) + '</code></div>' +
        '</div>';
      details.appendChild(card1);

      // Subnet card for device 2 — show always, side-by-side
      var hostBits2 = 32 - prefix;
      var net2Str = intToIp(nets[1].netInt);
      var bcast2Str = intToIp(nets[1].bcastInt);
      var first2Str = intToIp((nets[1].netInt + 1) >>> 0);
      var last2Str = intToIp((nets[1].bcastInt - 1) >>> 0);
      var card2 = el('div', 'sn-card' + (sameSubnet ? '' : ' sn-card-2'));
      card2.innerHTML =
        '<div class="sn-card-label">Subnet ของ ' + devs[1].name + (sameSubnet ? '  ·  เหมือนกับด้านบน' : '  ·  /' + prefix + '  =  ' + maskStr) + '</div>' +
        '<div class="sn-card-grid">' +
          '<div class="sn-kv"><span>Network</span><code>' + net2Str + '</code></div>' +
          '<div class="sn-kv"><span>Broadcast</span><code>' + bcast2Str + '</code></div>' +
          '<div class="sn-kv"><span>Host range</span><code>' + first2Str + ' – ' + last2Str + '</code></div>' +
          '<div class="sn-kv"><span>Host count</span><code>' + hostCount.toLocaleString() + '</code></div>' +
          '<div class="sn-kv"><span>IP Class</span><code>' + ipClass(parsed[1][0]) + (isPrivate(parsed[1]) ? ' · Private' : ' · Public') + '</code></div>' +
          '<div class="sn-kv"><span>Mask (binary)</span><code class="sn-binary">' + maskBinary(maskInt) + '</code></div>' +
        '</div>' +
        (sameSubnet ? '' : '<div class="sn-tip">💡 ทางแก้: เปลี่ยน ' + devs[1].name + ' ให้ใช้ IP ในช่วง <code>' + firstStr + ' – ' + lastStr + '</code> · หรือเปลี่ยน Mask ให้กว้างขึ้น เช่น /16 จะรวม 192.168.x.y ทั้งหมด</div>');
      details.appendChild(card2);

      // Explanation panel — only shown once (after the cards)
      var expl = el('div', 'sn-explain');
      expl.innerHTML =
        '<div class="sn-explain-title">📖 อ่านยังไง?</div>' +
        '<ul>' +
          '<li><strong>Network</strong> = ที่อยู่ของวงเครือข่าย (ไม่ใช่ device — ห้ามใส่ให้อุปกรณ์)</li>' +
          '<li><strong>Broadcast</strong> = ที่อยู่ "ส่งให้ทุกคนใน vong" (ก็ห้ามใส่ให้อุปกรณ์เช่นกัน)</li>' +
          '<li><strong>Host range</strong> = ช่วง IP ที่ใส่ให้อุปกรณ์ได้ — PLC, HMI, PC ทุกตัวต้องอยู่ใน vong นี้</li>' +
          '<li><strong>Same Subnet?</strong> ตรวจง่าย ๆ — เอา <em>IP AND Mask</em> ของทั้ง 2 ตัว ถ้าได้ค่า Network เท่ากัน = vong เดียวกัน</li>' +
          '<li><strong>Private vs Public</strong> — สำหรับ Lab ใช้ Private (192.168.x.x หรือ 10.x.x.x) เท่านั้น</li>' +
        '</ul>';
      details.appendChild(expl);
    }

    function maskBinary(m) {
      var s = '';
      for (var i = 31; i >= 0; i--) {
        s += ((m >>> i) & 1);
        if (i % 8 === 0 && i !== 0) s += '.';
      }
      return s;
    }

    refresh();
  }

  function init() {
    document.querySelectorAll('.subnet-check').forEach(buildChecker);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
