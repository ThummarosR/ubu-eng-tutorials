/* Theory 0·3 · "Map the Pain to the Concept" — multi-item quiz.
 *
 * Each item is a real failure symptom seen when shipping agents. The learner picks which
 * field concept / harness piece exists to fix it; the widget reveals the correct one plus
 * the chapter that goes deep. The payoff: every pain has a name and a chapter — the learner
 * walks into the story holding the whole map.
 * Reuses the .ga-* styles from activities.css. Vanilla JS, no deps, works offline.
 *
 * Mount point: <div class="field-map"></div>
 */
(function () {
  'use strict';

  // Each: symptom + 3 options; `c` = index of the correct option; why includes the chapter.
  var Q = [
    { sym: 'ถามต่อว่า “แล้วสัปดาห์หน้าล่ะ?” แต่มันจำสิ่งที่เพิ่งคุยกันไม่ได้',
      opts: ['Tools', 'Memory & State', 'Evaluation'], c: 1,
      why: 'เครื่องยนต์ลืมทุกอย่างเมื่อจบรอบ ต้องเก็บสิ่งสำคัญไว้นอก context → <b>บทที่ 06 · Memory & State</b>' },
    { sym: 'มันตอบชื่อห้องที่ไม่มีอยู่จริงในระบบ — อย่างมั่นใจ',
      opts: ['Grounding & Verify', 'Permissions', 'Orchestration'], c: 0,
      why: 'โมเดลมั่นใจเท่ากันทั้งตอนถูกและตอนแต่งเรื่อง ต้องตอบจากข้อมูลจริงและตรวจกับสภาพแวดล้อม → <b>บทที่ 07 · Grounding &amp; Verification</b>' },
    { sym: 'ถาม “ห้องนี้ว่างไหม” แล้วมันไปกดจองให้เลยโดยไม่ถาม',
      opts: ['Context engineering', 'Permissions & Safety', 'Memory'], c: 1,
      why: 'ต้องแยก “อ่าน” ออกจาก “ทำ” และกั้นสิ่งที่ย้อนไม่ได้ด้วยคน → <b>บทที่ 08 · Permissions &amp; Safety</b>' },
    { sym: 'ยัดเอกสารเข้าไปทั้งกอง “เผื่อไว้” แต่คุณภาพคำตอบกลับแย่ลง',
      opts: ['Tools', 'Observability', 'Context engineering'], c: 2,
      why: 'attention มีจำกัด ยิ่งยัดยิ่งเจือจาง (lost-in-the-middle · context rot) — คัดชุดสัญญาณสูงที่เล็กที่สุด → <b>บทที่ 05 · 13 · Context engineering</b>' },
    { sym: 'จะต่อ agent เข้ากับระบบภายนอกหลายตัว แต่ละตัวคนละมาตรฐาน วุ่นไปหมด',
      opts: ['MCP', 'Skills', 'Evaluation'], c: 0,
      why: 'ต้องมีโปรโตคอลกลางมาตรฐาน (host/client/server · tools/resources/prompts) → <b>บทที่ 11 · MCP</b>' },
    { sym: 'ข้อความที่ผู้ใช้พิมพ์มา แอบมีคำสั่งหลอกให้ agent ทำสิ่งที่ไม่ควร',
      opts: ['Memory', 'Security (prompt injection)', 'Tools'], c: 1,
      why: 'ข้อความจากผู้ใช้ = ไม่น่าเชื่อถือ และอยู่ใน context เดียวกับโมเดล — ต้องตัดขาของ “สามเหลี่ยมอันตราย” → <b>บทที่ 14 · Security</b>' }
  ];

  function build(el) {
    var picks = new Array(Q.length).fill(null);

    var html = '';
    Q.forEach(function (q, i) {
      html += '<div class="ga-run" data-i="' + i + '">' +
        '<h4>อาการที่ ' + (i + 1) + ' · <span style="color:var(--ink-dim);font-weight:500">' + q.sym + '</span></h4>' +
        '<div class="ga-opt">' +
          q.opts.map(function (o, j) {
            return '<button type="button" data-j="' + j + '">' + o + '</button>';
          }).join('') +
        '</div>' +
        '<div class="ga-rationale"></div>' +
      '</div>';
    });
    html += '<div class="ga-final" style="display:none"></div>';
    el.innerHTML = html;

    var final = el.querySelector('.ga-final');

    el.querySelectorAll('.ga-run').forEach(function (run) {
      var i = +run.dataset.i;
      var q = Q[i];
      var rat = run.querySelector('.ga-rationale');
      var btns = run.querySelectorAll('.ga-opt button');

      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (picks[i] !== null) return;          // lock after first answer
          var j = +btn.dataset.j;
          picks[i] = j;
          btns.forEach(function (b, k) {
            if (k === q.c) b.classList.add('correct');
            else if (k === j) b.classList.add('wrong');
            b.disabled = true;
          });
          rat.classList.add('show');
          rat.innerHTML = (j === q.c ? '✅ ใช่เลย — ' : '⚠️ ที่ตรงที่สุดคือ <b>' + q.opts[q.c] + '</b> · ') + q.why;
          maybeFinal();
        });
      });
    });

    function maybeFinal() {
      if (picks.some(function (p) { return p === null; })) return;
      var right = picks.filter(function (p, i) { return p === Q[i].c; }).length;
      final.style.display = 'block';
      final.style.cssText += ';margin-top:8px;padding:13px 16px;border:1px solid var(--green);' +
        'border-radius:12px;background:rgba(52,211,153,0.10);color:var(--cyan-2);font-size:14px;line-height:1.6';
      final.innerHTML = '<b>จับคู่ถูก ' + right + ' / ' + Q.length + '</b> — ' +
        'สังเกตว่า <b>ทุกอาการพังมี “ชื่อ” และ “บท” ของมัน</b> นี่แหละแผนที่ของคอร์ส: ' +
        'เริ่มจาก <em>อะไรพัง</em> แล้วหยิบเฉพาะชิ้นส่วนที่แก้ตรงนั้น — ไม่ใช่ไล่เก็บศัพท์ให้ครบ ' +
        'พร้อมแล้ว ไปเริ่มลงมือที่บทที่ 01 กันได้เลย';
    }
  }

  function init() { document.querySelectorAll('.field-map').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
