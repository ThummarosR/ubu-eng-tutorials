/* Ziegler-Nichols Closed-Loop Calculator
 *
 * Markup:
 *   <div class="zn-calc"></div>
 *
 * Reactive: student enters Ku (ultimate gain) + Pu (ultimate period in seconds),
 * widget computes Kp/Ti/Td for 5 standard ZN controller forms.
 *
 * Bonus: if a .pid-tuner widget is on the same page, an "ลองค่านี้ใน Playground"
 * button per row will inject the values into the tuner's sliders.
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // ZN classic table — each row: { name, kp_factor, ti_factor (Pu/x), td_factor (Pu/x) }
  // ti_factor / td_factor of null = disabled (∞ / 0)
  var FORMS = [
    { name: 'P',                 kp: 0.50, ti_div: null, td_div: null, hint: 'ง่ายสุด · มี SS error เสมอ' },
    { name: 'PI',                kp: 0.45, ti_div: 1.2,  td_div: null, hint: 'ไม่มี SS error · ช้ากว่า PID' },
    { name: 'PID (Classic)',     kp: 0.60, ti_div: 2.0,  td_div: 8.0,  hint: 'มาตรฐาน · OS ~15–25%', recommended: true },
    { name: 'PID (Pessen)',      kp: 0.70, ti_div: 2.5,  td_div: 20/3, hint: 'เร็วกว่า Classic · OS สูงกว่า' },
    { name: 'PID (Some OS)',     kp: 0.33, ti_div: 2.0,  td_div: 3.0,  hint: 'OS น้อย · ช้ากว่า' }
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function compute(Ku, Pu, form) {
    return {
      Kp: form.kp * Ku,
      Ti: form.ti_div ? Pu / form.ti_div : null,
      Td: form.td_div ? Pu / form.td_div : null
    };
  }

  function fmt(v, dec) { return v.toFixed(dec === undefined ? 2 : dec); }

  function applyToPidTuner(Kp, Ti, Td) {
    var tuner = document.querySelector('.pid-tuner');
    if (!tuner) return false;
    var inputs = tuner.querySelectorAll('input.pt-slider');
    if (inputs.length < 3) return false;
    // Clip to slider ranges to avoid going past min/max
    function setSlider(input, value) {
      var min = parseFloat(input.min);
      var max = parseFloat(input.max);
      var v = Math.max(min, Math.min(max, value));
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setSlider(inputs[0], Kp);
    setSlider(inputs[1], Ti === null ? 200 : Ti); // map ∞ → slider max
    setSlider(inputs[2], Td === null ? 0 : Td);
    // Scroll into view so student sees the result
    tuner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function buildCalc(root) {
    root.innerHTML = '';
    root.classList.add('zn');

    var head = el('div', 'zn-head');
    head.innerHTML =
      '<div class="zn-title">🧮 Ziegler-Nichols Calculator</div>' +
      '<div class="zn-desc">กรอก <strong>Ku</strong> (Ultimate Gain — Kp ที่ทำให้แกว่งคงที่) และ ' +
      '<strong>Pu</strong> (Ultimate Period — เวลา 1 รอบการแกว่ง) → ระบบคำนวณ Kp/Ti/Td ให้</div>';
    root.appendChild(head);

    // ---------- Inputs ----------------------------------------------------
    var params = { Ku: 4.0, Pu: 30.0 };

    var inputs = el('div', 'zn-inputs');

    function makeInput(label, key, min, max, step, unit) {
      var wrap = el('div', 'zn-input-row');
      var lbl = el('label', 'zn-input-label', label);
      var slider = el('input', 'zn-input-slider');
      slider.type = 'range';
      slider.min = String(min); slider.max = String(max); slider.step = String(step);
      slider.value = String(params[key]);
      var num = el('input', 'zn-input-num');
      num.type = 'number';
      num.min = String(min); num.max = String(max); num.step = String(step);
      num.value = String(params[key]);
      var unitEl = el('span', 'zn-input-unit', unit || '');
      function refresh(v) {
        v = parseFloat(v);
        if (isNaN(v)) v = params[key];
        v = Math.max(min, Math.min(max, v));
        params[key] = v;
        slider.value = String(v);
        num.value = String(v);
        update();
      }
      slider.addEventListener('input', function () { refresh(slider.value); });
      num.addEventListener('input', function () { refresh(num.value); });
      wrap.appendChild(lbl);
      wrap.appendChild(slider);
      wrap.appendChild(num);
      wrap.appendChild(unitEl);
      return wrap;
    }

    inputs.appendChild(makeInput('Ku — Ultimate Gain', 'Ku', 0.1, 20, 0.1, ''));
    inputs.appendChild(makeInput('Pu — Ultimate Period', 'Pu', 1, 200, 0.5, 's'));
    root.appendChild(inputs);

    // ---------- Output table ----------------------------------------------
    var tableWrap = el('div', 'zn-table-wrap');
    var table = el('table', 'zn-table');
    var thead = el('thead', '', '<tr><th>Controller</th><th>Kp</th><th>Ti (s)</th><th>Td (s)</th><th>หมายเหตุ</th><th></th></tr>');
    table.appendChild(thead);
    var tbody = el('tbody');
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    root.appendChild(tableWrap);

    // ---------- Update ----------------------------------------------------
    function update() {
      tbody.innerHTML = '';
      FORMS.forEach(function (form) {
        var res = compute(params.Ku, params.Pu, form);
        var tr = el('tr', form.recommended ? 'zn-row-rec' : '');
        var nameCell = '<td class="zn-name">' +
          (form.recommended ? '★ ' : '') +
          form.name + '</td>';
        var kpCell = '<td class="zn-val">' + fmt(res.Kp, 2) + '</td>';
        var tiCell = '<td class="zn-val">' + (res.Ti === null ? '<span class="zn-na">—</span>' : fmt(res.Ti, 2)) + '</td>';
        var tdCell = '<td class="zn-val">' + (res.Td === null ? '<span class="zn-na">—</span>' : fmt(res.Td, 2)) + '</td>';
        var hintCell = '<td class="zn-hint">' + form.hint + '</td>';
        var btnCell = '<td class="zn-action"><button type="button" class="zn-apply-btn" data-kp="' + res.Kp +
          '" data-ti="' + (res.Ti === null ? 'null' : res.Ti) +
          '" data-td="' + (res.Td === null ? 'null' : res.Td) +
          '">ลองค่านี้ →</button></td>';
        tr.innerHTML = nameCell + kpCell + tiCell + tdCell + hintCell + btnCell;
        tbody.appendChild(tr);
      });
      // Wire apply buttons
      tbody.querySelectorAll('.zn-apply-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var kp = parseFloat(btn.getAttribute('data-kp'));
          var ti = btn.getAttribute('data-ti');
          var td = btn.getAttribute('data-td');
          ti = (ti === 'null') ? null : parseFloat(ti);
          td = (td === 'null') ? null : parseFloat(td);
          var ok = applyToPidTuner(kp, ti, td);
          if (!ok) {
            btn.textContent = 'ไม่พบ Playground บนหน้านี้';
            setTimeout(function () { btn.textContent = 'ลองค่านี้ →'; }, 1800);
          } else {
            var orig = btn.textContent;
            btn.textContent = '✓ ใส่แล้ว';
            setTimeout(function () { btn.textContent = orig; }, 1200);
          }
        });
      });
    }

    update();

    // ---------- Formula footer ---------------------------------------------
    var formula = el('div', 'zn-formula');
    formula.innerHTML =
      '<strong>สูตรอ้างอิง:</strong> ' +
      'P: Kp=0.50·Ku · ' +
      'PI: Kp=0.45·Ku, Ti=Pu/1.2 · ' +
      '<strong>PID Classic: Kp=0.60·Ku, Ti=Pu/2, Td=Pu/8</strong>';
    root.appendChild(formula);
  }

  function init() {
    document.querySelectorAll('.zn-calc').forEach(buildCalc);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
