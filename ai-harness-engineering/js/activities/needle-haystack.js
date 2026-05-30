/* Ch13 · "Needle in the Haystack" — slider-meter + canvas.
 *
 * A transparent toy model of two real findings: lost-in-the-middle (recall sags
 * when the needle sits mid-context — a U-curve) and context rot (recall drops as
 * raw length grows, even with the window nearly empty). The learner slides the
 * needle's position and grows the haystack, predicts recall, and watches the meter.
 *
 * Mount point: <div class="needle-haystack"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var BASE = 0.96, DIP = 0.40, ROT = 0.06, TOK_PER_LINE = 12, WINDOW = 200000;

  function acc(pos, N) {
    var v = BASE - DIP * Math.sin(pos * Math.PI) - ROT * (Math.log(N / 50) / Math.LN2);
    return Math.max(0.02, Math.min(1, v));
  }

  function build(el) {
    var pos = 0.5, N = 50, prediction = null;

    el.innerHTML =
      '<canvas class="nh-canvas" width="600" height="150"></canvas>' +
      '<div class="nh-meter-lab"><span>recall ที่ตำแหน่งนี้</span><b data-recall>—</b></div>' +
      '<div class="nh-track"><div class="nh-fill" data-fill></div></div>' +
      '<div class="nh-ctrl">' +
        '<div><label>ตำแหน่ง needle ในก้อน context: <b data-pos></b> (0% = ต้น · 100% = ท้าย)</label>' +
          '<input type="range" min="0" max="100" value="50" data-slider></div>' +
        '<div><label>ขนาด haystack (จำนวนบรรทัด distractor) — needle ตรึงที่ 50%</label>' +
          '<div class="nh-sizes" data-sizes></div></div>' +
        '<div class="nh-predict"><label style="margin:0">ทายก่อน: recall = </label>' +
          '<input type="number" min="0" max="100" data-pred placeholder="%"> %' +
          '<button type="button" class="sib-btn" data-run>รัน retrieval</button></div>' +
      '</div>' +
      '<div><div class="nh-meter-lab" style="margin-top:14px"><span>window เต็มแค่ไหน</span><b data-wf>—</b></div>' +
        '<div class="nh-windowbar"><div class="nh-windowfill" data-wfill></div></div></div>' +
      '<div class="nh-note" data-note></div>';

    var cv = el.querySelector('.nh-canvas'), ctx = cv.getContext('2d');
    var slider = el.querySelector('[data-slider]');
    var predInput = el.querySelector('[data-pred]');
    var sizesWrap = el.querySelector('[data-sizes]');
    [50, 200, 500, 2000].forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'nh-size' + (s === 50 ? ' on' : '');
      b.textContent = s + ' บรรทัด'; b.dataset.n = s;
      b.addEventListener('click', function () { N = s; prediction = null; sync(); });
      sizesWrap.appendChild(b);
    });

    slider.addEventListener('input', function () { pos = +slider.value / 100; prediction = null; render(); });
    el.querySelector('[data-run]').addEventListener('click', function () {
      var v = parseFloat(predInput.value);
      prediction = isNaN(v) ? null : Math.max(0, Math.min(100, v)) / 100;
      render();
    });

    function sync() {
      sizesWrap.querySelectorAll('.nh-size').forEach(function (b) { b.classList.toggle('on', +b.dataset.n === N); });
      render();
    }

    function drawCurve() {
      var w = cv.width, h = cv.height; ctx.clearRect(0, 0, w, h);
      // grid baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(function (g) { ctx.beginPath(); ctx.moveTo(0, h - g * h); ctx.lineTo(w, h - g * h); ctx.stroke(); });
      // U curve
      ctx.beginPath(); ctx.strokeStyle = '#2ee6c8'; ctx.lineWidth = 2.5;
      for (var px = 0; px <= w; px += 4) {
        var p = px / w, a = acc(p, N), y = h - a * h;
        if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
      // model dot at current pos
      var mx = pos * w, my = h - acc(pos, N) * h;
      ctx.fillStyle = '#7ff5e2'; ctx.beginPath(); ctx.arc(mx, my, 6, 0, 7); ctx.fill();
      // prediction dot
      if (prediction !== null) {
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(mx, h - prediction * h, 5, 0, 7); ctx.fill();
      }
    }

    function render() {
      var a = acc(pos, N);
      el.querySelector('[data-pos]').textContent = Math.round(pos * 100) + '%';
      el.querySelector('[data-recall]').textContent = Math.round(a * 100) + '%';
      var f = el.querySelector('[data-fill]');
      f.style.width = (a * 100) + '%';
      f.style.background = 'hsl(' + (a * 120) + ',70%,50%)';
      var fullPct = Math.min(100, N * TOK_PER_LINE / WINDOW * 100);
      el.querySelector('[data-wf]').textContent = fullPct.toFixed(1) + '% เต็ม';
      el.querySelector('[data-wfill]').style.width = fullPct + '%';
      var note = 'recall = clamp(0.96 − 0.40·sin(pos·π) − 0.06·log₂(N/50)) — โมเดลของเล่นโปร่งใส ไม่ใช่ LLM จริง';
      if (prediction !== null) {
        var err = Math.abs(prediction - a) * 100;
        note = 'คุณทาย ' + Math.round(prediction * 100) + '% · จริง ' + Math.round(a * 100) + '% · คลาด ' + err.toFixed(0) + ' จุด — ' +
          (N >= 500 ? 'สังเกต: haystack ใหญ่ขึ้น recall ตกทั้งที่ window แทบว่าง (context rot)' : 'ลองเลื่อน needle ไปกลางก้อนแล้วดู recall แอ่นลง (lost-in-the-middle)');
      }
      el.querySelector('[data-note]').textContent = note;
      drawCurve();
    }

    sync();
  }

  function init() { document.querySelectorAll('.needle-haystack').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
