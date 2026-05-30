/* Ch16 · "Grade the Agent: Three Verdicts per Run" — fill-the-scorecard.
 *
 * Three runs, each graded at three levels — Final-task / Trajectory / Step. Run B is
 * the trap: the right answer reached through an unsound path (final PASS, trajectory
 * & step FAIL). The learner sets PASS/FAIL per level, then reveals the expert labels.
 * Aha: one verdict is never enough — correct-by-luck is a real failure mode.
 *
 * Mount point: <div class="grade-the-agent"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var RUNS = [
    { req: 'Lab 3 ว่างพฤหัสบ่ายไหม?',
      steps: ['room.availability(Lab3, พฤหัส) → ดึงการจองจริง',
              'clash.check → 13:00–15:00 มีคาบเรียน',
              'ตอบ: ไม่ว่าง 13:00 (ชนคาบ) · ว่าง 15:00'],
      final: 'ไม่ว่าง 13:00 / ว่าง 15:00',
      expert: { final:'PASS', trajectory:'PASS', step:'PASS' },
      rationale: { final:'ตอบถูก', trajectory:'ดึงของจริง + เช็คคาบ ครบถูกลำดับ', step:'ทุกขั้นสมเหตุสมผล' } },
    { req: 'มีนักศึกษา MAE ที่ยัง “ปกติ” กี่คน?',
      steps: ['query: นับแถวที่ status_text = "ปกติ" → ได้ 0',
              'เห็น 0 แปลก ๆ → query: นับ MAE ทั้งหมด → ได้ 41',
              'ตอบ: “ประมาณ 41 คนยัง active”'],
      final: '≈ 41 คน',
      expert: { final:'PASS', trajectory:'FAIL', step:'FAIL' },
      rationale: {
        final:'41 ใกล้เคียงจริง (MAE เป็นรุ่นใหม่ เกือบทุกคนยังปกติ) — ผ่านแบบ “เฉียด ๆ”',
        trajectory:'ผิดตาราง: คอลัมน์ status_text ว่างทั้งคอลัมน์ ค่าจริงอยู่ที่อื่น · 41 = “MAE ทั้งหมด” ไม่ใช่ “active ที่ตรวจแล้ว”',
        step:'step 2 เอา “MAE ทั้งหมด” มาเท่ากับ “active” เงียบ ๆ — ถูกโดยบังเอิญ ไม่ใช่โดยวิธี' } },
    { req: 'อาคาร EN7 ใช้ไฟเท่าไรเดือนนี้?',
      steps: ['เดาจากความจำ → “ประมาณ 12,000 kWh”', 'ตอบเลยโดยไม่เรียก tool'],
      final: '≈ 12,000 kWh',
      expert: { final:'FAIL', trajectory:'FAIL', step:'FAIL' },
      rationale: { final:'ไม่ได้ดึงค่าจริง ตัวเลขมั่ว', trajectory:'ไม่เรียก tool ไฟเลยสักตัว', step:'เดาตั้งแต่ขั้นแรก' } },
    null
  ].filter(Boolean);

  var LEVELS = [ ['final','Final-task — ถึงเป้าหมายไหม?'], ['trajectory','Trajectory — เส้นทางสมเหตุสมผลไหม?'], ['step','Step — แต่ละขั้นถูกไหม?'] ];

  function build(el) {
    var picks = RUNS.map(function () { return {}; });
    var revealed = false;

    var html = '';
    RUNS.forEach(function (r, ri) {
      html += '<div class="ga-run" data-run="' + ri + '"><h4>Run ' + String.fromCharCode(65 + ri) + ' · “' + r.req + '”</h4>' +
        '<ol>' + r.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
        '<div class="ga-final">คำตอบสุดท้าย: <b>' + r.final + '</b></div>' +
        '<div class="ga-levels">' +
          LEVELS.map(function (lv) {
            return '<div class="ga-level"><div class="lv">' + lv[1] + '</div>' +
              '<div class="ga-opt" data-lvl="' + lv[0] + '">' +
                '<button type="button" data-v="PASS">PASS</button>' +
                '<button type="button" data-v="FAIL">FAIL</button></div>' +
              '<div class="ga-rationale"></div></div>';
          }).join('') +
        '</div></div>';
    });
    html += '<div class="sib-actions"><button type="button" class="sib-btn" data-act="reveal">เฉลย &amp; ให้คะแนน</button>' +
      '<button type="button" class="sib-btn ghost" data-act="reset">↺ เริ่มใหม่</button>' +
      '<span class="sib-tally"></span></div>';
    el.innerHTML = html;

    el.querySelectorAll('.ga-opt').forEach(function (opt) {
      var ri = +opt.closest('[data-run]').dataset.run, lvl = opt.dataset.lvl;
      opt.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          if (revealed) return;
          picks[ri][lvl] = b.dataset.v;
          opt.querySelectorAll('button').forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel');
        });
      });
    });

    el.querySelector('[data-act="reveal"]').addEventListener('click', function () {
      revealed = true;
      var match = { final:0, trajectory:0, step:0 }, totalPer = RUNS.length;
      RUNS.forEach(function (r, ri) {
        var run = el.querySelector('[data-run="' + ri + '"]');
        LEVELS.forEach(function (lv) {
          var lvl = lv[0];
          var opt = run.querySelector('.ga-opt[data-lvl="' + lvl + '"]');
          var expert = r.expert[lvl];
          opt.querySelectorAll('button').forEach(function (b) {
            b.classList.remove('sel');
            if (b.dataset.v === expert) b.classList.add('correct');
            else if (picks[ri][lvl] === b.dataset.v) b.classList.add('wrong');
          });
          if (picks[ri][lvl] === expert) match[lvl]++;
          var rat = opt.parentNode.querySelector('.ga-rationale');
          rat.classList.add('show');
          rat.innerHTML = '<b>เฉลย: ' + expert + '.</b> ' + r.rationale[lvl];
        });
      });
      el.querySelector('.sib-tally').innerHTML = 'ตรงกับผู้เชี่ยวชาญ — Final ' + match.final + '/' + totalPer +
        ' · Trajectory ' + match.trajectory + '/' + totalPer + ' · Step ' + match.step + '/' + totalPer +
        ' · <b>Run B = ถูกโดยบังเอิญ</b>';
    });

    el.querySelector('[data-act="reset"]').addEventListener('click', function () {
      revealed = false; picks = RUNS.map(function () { return {}; });
      el.querySelectorAll('.ga-opt button').forEach(function (b) { b.classList.remove('sel', 'correct', 'wrong'); });
      el.querySelectorAll('.ga-rationale').forEach(function (r) { r.classList.remove('show'); r.innerHTML = ''; });
      el.querySelector('.sib-tally').textContent = '';
    });
  }

  function init() { document.querySelectorAll('.grade-the-agent').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
