/* Ch14 · "Cut an Edge" — arm and disarm the lethal trifecta (toggle-and-observe).
 *
 * Three capability boxes — PRIVATE DATA, UNTRUSTED CONTENT, EXFIL — wired into an
 * attack triangle. All three on = armed (a poisoned tool result can read private
 * data and mail it out). Un-checking ANY one collapses the attack. A Docker decoy
 * checkbox changes nothing: it sandboxes the process, not the model's tool choices.
 *
 * Mount point: <div class="cut-an-edge"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var NODES = [
    { k: 'priv', cls: 'ce-p1', t: 'PRIVATE DATA', d: 'อ่านเกรด/ข้อมูลส่วนตัว', off:
      'ข้อความฉีดสั่งได้ แต่<b>ไม่มีของลับให้ขโมย</b> — แย่สุดแค่คำตอบสับสน' },
    { k: 'untr', cls: 'ce-p2', t: 'UNTRUSTED CONTENT', d: 'คู่มือ/หน้าเว็บ/สแครป', off:
      '<b>ไม่มีข้อความอันตรายเข้ามาใน context</b> เลย คำสั่งที่ถูกฉีดจึงไม่เคยมาถึงโมเดล' },
    { k: 'exfil', cls: 'ce-p3', t: 'EXFIL', d: 'ส่งอีเมล/สร้าง event/LINE', off:
      'โมเดลถูกหลอกได้ทั้งวัน แต่<b>ไม่มีช่องส่งข้อมูลออก</b> — แย่สุดแค่ตอบมั่ว' }
  ];

  function build(el) {
    var on = { priv: true, untr: true, exfil: true }, docker = false;

    var nodesHtml = NODES.map(function (n) {
      return '<div class="ce-node ' + n.cls + '" data-node="' + n.k + '">' +
        '<div class="t">' + n.t + '</div><div class="d">' + n.d + '</div>' +
        '<label><input type="checkbox" checked data-chk="' + n.k + '"> เปิดความสามารถ</label></div>';
    }).join('');

    el.innerHTML =
      '<div class="ce-stage">' +
        '<svg class="ce-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
          '<line data-edge="priv-untr" x1="50" y1="16" x2="16" y2="84"/>' +
          '<line data-edge="untr-exfil" x1="16" y1="84" x2="84" y2="84"/>' +
          '<line data-edge="exfil-priv" x1="84" y1="84" x2="50" y2="16"/>' +
        '</svg>' + nodesHtml +
      '</div>' +
      '<div class="ce-banner"></div>' +
      '<div class="ce-conseq"></div>' +
      '<div class="ce-decoy"><label><input type="checkbox" data-docker> 🐳 รัน agent ทั้งตัวใน Docker container</label>' +
        '<div class="tip">Docker กั้น <b>process</b> (ไฟล์/เครือข่าย) ไม่ได้กั้น <b>การตัดสินใจเรียก tool</b> ของโมเดล — ไม่ใช่ขาของ trifecta · triangle ยัง armed อยู่</div></div>';

    el.querySelectorAll('[data-chk]').forEach(function (c) {
      c.addEventListener('change', function () { on[c.dataset.chk] = c.checked; render(); });
    });
    el.querySelector('[data-docker]').addEventListener('change', function (e) {
      docker = e.target.checked;
      el.querySelector('.ce-decoy .tip').classList.toggle('show', docker);
    });

    var EDGES = { 'priv-untr': ['priv', 'untr'], 'untr-exfil': ['untr', 'exfil'], 'exfil-priv': ['exfil', 'priv'] };

    function render() {
      NODES.forEach(function (n) { el.querySelector('[data-node="' + n.k + '"]').classList.toggle('off', !on[n.k]); });
      el.querySelectorAll('.ce-svg line').forEach(function (ln) {
        var pair = EDGES[ln.dataset.edge];
        var live = on[pair[0]] && on[pair[1]];
        ln.setAttribute('stroke', live ? '#fb7185' : '#3a3f4a');
        ln.setAttribute('stroke-width', live ? '2.5' : '1.5');
        ln.style.strokeDasharray = live ? '0' : '4';
        if (live) ln.classList.add('ce-live'); else ln.classList.remove('ce-live');
      });
      var armed = on.priv && on.untr && on.exfil;
      var banner = el.querySelector('.ce-banner');
      var conseq = el.querySelector('.ce-conseq');
      if (armed) {
        banner.className = 'ce-banner armed';
        banner.textContent = '🔴 TRIFECTA ARMED — ผลลัพธ์ tool ที่ถูกวางยา อ่านเกรดแล้วส่งออกได้';
        conseq.innerHTML = 'ทั้งสามขาเขียวพร้อมกัน → เส้นทางโจมตีครบ ลองเอาเช็คออก <b>ขาเดียว</b> แล้วดูมันพังทั้งสาย';
      } else {
        var cut = NODES.find(function (n) { return !on[n.k]; });
        banner.className = 'ce-banner safe';
        banner.textContent = '🟢 ATTACK COLLAPSED — ตัดขาแล้ว: ' + cut.t;
        conseq.innerHTML = cut.off;
      }
    }

    render();
  }

  function init() { document.querySelectorAll('.cut-an-edge').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
