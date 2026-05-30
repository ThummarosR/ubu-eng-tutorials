/* Ch18 · "Safety Envelope" — toggle-and-observe (Physical AI).
 *
 * The same agent loop, but the "hand" is a real robot: perceive -> policy -> act.
 * A safety envelope is a hard constraint checked BEFORE act; a teleop fallback hands
 * control to a human when the robot is unsure or the envelope trips. The learner
 * injects an unexpected event (a person enters the robot's zone) and sees that
 * permissions + verify matter far more when errors happen in the physical world.
 *
 * Mount point: <div class="safety-envelope"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  function build(el) {
    var envelope = true, teleop = true;

    el.innerHTML =
      '<div class="sh-scenario" style="margin-bottom:10px">หุ่นยนต์ตรวจม้านั่งแล็บกำลังจะ “หยิบเครื่องมือ” ตามแผน — แล้ว ' +
        '<b>มีคนเดินเข้ามาในเขตทำงานของแขนกลกะทันหัน</b></div>' +
      '<div class="tg-list">' +
        '<button type="button" class="tg-row" data-k="env"><span class="tg-txt">Safety envelope (ขีดจำกัดแข็งที่เช็คก่อนลงมือ)' +
          '<small>เช่น “ห้ามขยับถ้ามีคนในระยะ X” — ตรวจจากเซนเซอร์จริง ไม่ใช่จากความมั่นใจของ policy</small></span><span class="tg-sw"></span></button>' +
        '<button type="button" class="tg-row" data-k="tel"><span class="tg-txt">Teleoperation fallback (ส่งคุมให้คน)' +
          '<small>เมื่อไม่มั่นใจหรือ envelope สะดุด → หยุดแล้วยกให้มนุษย์</small></span><span class="tg-sw"></span></button>' +
      '</div>' +
      '<div class="se-pipe"></div>' +
      '<div class="tg-out"></div>' +
      '<button type="button" class="sh-reset">↺ คืนค่า (เปิดทั้งสอง)</button>';

    var rowE = el.querySelector('[data-k="env"]'), rowT = el.querySelector('[data-k="tel"]');
    var pipe = el.querySelector('.se-pipe'), out = el.querySelector('.tg-out');
    rowE.addEventListener('click', function () { envelope = !envelope; render(); });
    rowT.addEventListener('click', function () { teleop = !teleop; render(); });
    el.querySelector('.sh-reset').addEventListener('click', function () { envelope = true; teleop = true; render(); });

    function stage(k, label, cls) { return '<div class="se-stage ' + (cls || '') + '"><span class="k">' + k + '</span>' + label + '</div>'; }
    var arrow = '<div class="se-arrow">→</div>';

    function render() {
      rowE.classList.toggle('on', envelope);
      rowT.classList.toggle('on', teleop);

      var pipeHtml, ok, head, ground = '';
      if (envelope) {
        pipeHtml = stage('perceive', 'เซนเซอร์เห็นคนเข้ามา') + arrow +
          stage('policy', 'VLA วางแผน “หยิบเครื่องมือ”') + arrow +
          stage('gate', 'envelope: คนอยู่ในระยะ → ปฏิเสธ', 'gate') + arrow +
          (teleop ? stage('teleop', 'หยุด + ยกให้มนุษย์', 'teleop') : stage('act', 'หยุดนิ่ง (ไม่ลงมือ)', 'blocked'));
        ok = true;
        head = teleop ? '✅ ปลอดภัย — envelope สกัดไว้ก่อน act แล้วส่งให้คนตัดสิน'
                      : '✅ ปลอดภัย — envelope สกัดไว้ หุ่นหยุดนิ่งแทนที่จะลงมือ';
      } else {
        pipeHtml = stage('perceive', 'เซนเซอร์เห็นคนเข้ามา') + arrow +
          stage('policy', 'VLA วางแผน “หยิบเครื่องมือ”') + arrow +
          stage('act', 'ลงมือทันที (ไม่มีขีดจำกัด)', 'blocked');
        ok = false;
        head = '⚠️ อันตราย — ไม่มี envelope: policy ที่ “มั่นใจแต่ผิด” สั่งแขนกลขยับใส่คน';
        ground = teleop
          ? 'teleop ช่วยได้ก็ต่อเมื่อคน “ทัน” กดเข้าคุม — แต่ไม่มี envelope ให้สะดุดก่อน ความผิดพลาดเกิดในโลกจริงทันที'
          : 'ไม่มีทั้ง envelope และ teleop — ความผิดพลาดของ policy กลายเป็นการชนจริงในโลกกายภาพ';
      }
      pipe.innerHTML = pipeHtml;
      out.className = 'tg-out ' + (ok ? 'ok' : 'bad');
      out.innerHTML = '<div class="tg-status">' + head + '</div>' +
        (ground ? '<div class="tg-ground"><b>ในโลกกายภาพ:</b> ' + ground + '</div>' :
          '<div class="tg-ground" style="border-color:var(--green);background:rgba(52,211,153,0.06);color:var(--cyan-2)">' +
          '<b>บทเรียน:</b> Permissions (envelope) และ Verify (เซนเซอร์จริง ไม่ใช่ความมั่นใจของ policy) ' +
          'ยิ่งคอขาดบาดตายเมื่อ “มือ” เป็นหุ่นจริง — เพราะ undo ไม่มี</div>');
    }
    render();
  }

  function init() { document.querySelectorAll('.safety-envelope').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
