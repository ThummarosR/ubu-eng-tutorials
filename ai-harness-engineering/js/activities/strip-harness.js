/* Ch1 · "Strip the Harness" — toggle-and-observe activity.
 *
 * Renders the 7 harness components as toggle chips (all ON = a reliable agent).
 * Turn one OFF and the outcome panel shows the specific failure it causes —
 * the model never changed; only the scaffolding did.
 *
 * Mount point: <div class="strip-harness"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var PARTS = [
    { key: 'loop',          th: 'Loop',          en: 'ลูป',
      breaks: 'ตอบครั้งเดียวแล้วจบ — เรียกเครื่องมือไม่ได้ ตรวจงานตัวเองไม่ได้ และกู้คืนจาก step ที่พลาดไม่ได้' },
    { key: 'tools',         th: 'Tools',         en: 'เครื่องมือ',
      breaks: 'ไม่มี "มือ" — ดึงการจอง/ตารางจริงไม่ได้ จึงเดาว่า "ห้องว่าง" ออกมาแบบมั่นใจ' },
    { key: 'context',       th: 'Context',       en: 'บริบท',
      breaks: 'ไม่รู้คาบเรียน วันหยุด หรือช่วงซ่อมบำรุง — ตอบว่า "ว่าง" ทั้งที่จริง ๆ จองไม่ได้' },
    { key: 'memory',        th: 'Memory',        en: 'ความจำ',
      breaks: 'ลืมบทสนทนาก่อนหน้า — คำถามต่อยอดอย่าง "แล้วพรุ่งนี้ล่ะ?" ไม่มีความหมาย' },
    { key: 'permissions',   th: 'Permissions',   en: 'สิทธิ์',
      breaks: 'ไม่มีรั้วกั้น — คุณแค่ถามว่า "ว่างไหม" แต่มันไป "จอง" ห้องให้จริง (การกระทำที่ย้อนยาก)' },
    { key: 'orchestration', th: 'Orchestration', en: 'การคุมรอบ',
      breaks: 'tool ค้าง = ค้างตลอดกาล ไม่มี timeout หรือ max_turns คอยหยุด' },
    { key: 'observability', th: 'Observability',  en: 'การมองเห็น',
      breaks: 'ตอบผิดแล้ว "ดูไม่ออก" ว่าทำไม — ไม่มี trace ให้ไล่ย้อน' }
  ];

  function build(el) {
    var state = {};
    PARTS.forEach(function (p) { state[p.key] = true; });

    el.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'sh-grid';

    PARTS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sh-chip';
      b.dataset.k = p.key;
      b.innerHTML =
        '<span class="sh-led"></span>' +
        '<span class="sh-name">' + p.th + '</span>' +
        '<span class="sh-en">' + p.en + '</span>';
      b.addEventListener('click', function () { state[p.key] = !state[p.key]; render(); });
      grid.appendChild(b);
    });

    var out = document.createElement('div');
    out.className = 'sh-outcome';

    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'sh-reset';
    reset.textContent = '↺ ใส่กลับครบทั้ง 7 ชิ้น';
    reset.addEventListener('click', function () {
      PARTS.forEach(function (p) { state[p.key] = true; });
      render();
    });

    el.appendChild(grid);
    el.appendChild(out);
    el.appendChild(reset);

    function render() {
      grid.querySelectorAll('.sh-chip').forEach(function (b) {
        b.classList.toggle('off', !state[b.dataset.k]);
      });
      var broken = PARTS.filter(function (p) { return !state[p.key]; });
      if (broken.length === 0) {
        out.innerHTML =
          '<div class="sh-status ok">✅ Agent เชื่อถือได้ — โมเดลตัวเดิม แต่มี harness ครบทั้ง 7 ชิ้นล้อมรอบ</div>';
      } else {
        var items = broken.map(function (p) {
          return '<li><b>− ' + p.th + ' (' + p.en + '):</b> ' + p.breaks + '</li>';
        }).join('');
        out.innerHTML =
          '<div class="sh-status bad">⚠️ พังแล้ว — ถอดออก ' + broken.length +
          ' ชิ้น โมเดลเท่าเดิมทุกประการ แต่ใช้งานไม่ได้</div>' +
          '<ul class="sh-broken">' + items + '</ul>';
      }
    }
    render();
  }

  function init() {
    document.querySelectorAll('.strip-harness').forEach(build);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
