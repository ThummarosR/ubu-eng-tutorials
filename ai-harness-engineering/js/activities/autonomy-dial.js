/* Ch19 · "Autonomy Dial" — slider (Human Integration).
 *
 * Slide from human-in-the-loop -> on-the-loop -> supervisory -> full autonomy.
 * Each level reassigns who acts and who checks, and is appropriate for different
 * stakes. A trust-calibration bar shows the failure each level drifts toward:
 * low autonomy wastes the agent (under-trust / bottleneck), high autonomy invites
 * rubber-stamping (over-trust). The goal is calibrated trust, not max or min.
 *
 * Mount point: <div class="autonomy-dial"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var LEVELS = [
    { name:'Human-in-the-loop', role:'agent <b>เสนอร่าง</b> · คน <b>อนุมัติทุกครั้ง</b>ก่อนลงมือ',
      fit:'เหมาะกับงานเสี่ยงสูง/ย้อนไม่ได้ (ปล่อยเกรด ส่งเชิญหมู่)', risk:'under', riskTxt:'ช้า/คอขวด — และถ้างานเยอะ คนเริ่ม “เซ็นผ่าน” โดยไม่อ่าน (over-trust แอบคืบ)' },
    { name:'Human-on-the-loop', role:'agent <b>ลงมือเอง</b> · คน <b>เฝ้าดู</b> แทรกเมื่อจำเป็น (เหมือนนักบินดู autopilot)',
      fit:'เหมาะกับงานปริมาณมาก เสี่ยงปานกลาง', risk:'cal', riskTxt:'จุดสมดุลที่พบบ่อย — แต่ต้องมีสัญญาณให้คน “รู้ว่าเมื่อไรควรแทรก”' },
    { name:'Supervisory / shared autonomy', role:'agent <b>ทำงานประจำเอง</b> · คนเข้าเฉพาะ <b>เคสยาก/เสี่ยง</b> (dynamic autonomy)',
      fit:'เหมาะเมื่อ agent พิสูจน์ความน่าเชื่อถือในงานประจำแล้ว', risk:'cal', riskTxt:'ต้องมีเกณฑ์ชัดว่าเคสไหน “ยกมือขอคน” — ไม่งั้นเคสเสี่ยงหลุด' },
    { name:'Full autonomy', role:'agent <b>ทำเองทั้งหมด</b> · คนดู <b>สรุปภายหลัง</b>',
      fit:'เหมาะเฉพาะงานเสี่ยงต่ำ/ย้อนได้ที่วัดผลได้แม่น', risk:'over', riskTxt:'อันตรายถ้า stake สูง: คน “ไว้ใจเกิน” จนไม่เหลือคนตรวจจริง (rubber-stamp)' }
  ];

  function build(el) {
    var lvl = 1;
    el.innerHTML =
      '<div class="ad-dial"><input type="range" min="0" max="3" value="1" step="1" data-slider>' +
        '<div class="ad-ticks">' + LEVELS.map(function (l, i) { return '<span data-tick="' + i + '">' + ['in-loop','on-loop','supervisory','autonomous'][i] + '</span>'; }).join('') + '</div></div>' +
      '<div class="ad-card"></div>' +
      '<div class="ad-trust"><div class="lab">การปรับเทียบความเชื่อใจ (trust calibration) — ระดับนี้มักไถลไปทางไหน</div>' +
        '<div class="ad-trustbar">' +
          '<div class="ad-zone under">UNDER-TRUST · เพิกเฉย/คอขวด</div>' +
          '<div class="ad-zone cal">CALIBRATED · พอดี</div>' +
          '<div class="ad-zone over">OVER-TRUST · เซ็นผ่านมั่ว</div>' +
        '</div></div>' +
      '<div class="ad-note"></div>';

    var slider = el.querySelector('[data-slider]');
    slider.addEventListener('input', function () { lvl = +slider.value; render(); });

    function render() {
      var L = LEVELS[lvl];
      el.querySelectorAll('[data-tick]').forEach(function (t) { t.classList.toggle('on', +t.dataset.tick === lvl); });
      el.querySelector('.ad-card').innerHTML = '<h4>' + lvl + ' · ' + L.name + '</h4>' +
        '<div class="role">' + L.role + '<br><span style="color:var(--ink-dim)">เหมาะเมื่อ:</span> ' + L.fit + '</div>';
      el.querySelectorAll('.ad-zone').forEach(function (z) { z.classList.remove('hot'); });
      el.querySelector('.ad-zone.' + L.risk).classList.add('hot');
      el.querySelector('.ad-note').innerHTML = '<b>ระดับนี้มักไถลไปทาง “' +
        (L.risk === 'under' ? 'under-trust' : L.risk === 'over' ? 'over-trust' : 'พอดี') + '”:</b> ' + L.riskTxt +
        '<br><span style="color:var(--ink-faint)">เป้าหมายไม่ใช่ autonomy สูงสุดหรือต่ำสุด แต่คือ <b>จับคู่ระดับให้เข้ากับความเสี่ยง</b> และให้คนเชื่อใจ agent ' +
        '“พอดีกับความน่าเชื่อถือจริง” — ไม่เพิกเฉย ไม่เซ็นผ่านมั่ว (machine self-assessment ช่วยปรับเทียบได้)</span>';
    }
    render();
  }

  function init() { document.querySelectorAll('.autonomy-dial').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
