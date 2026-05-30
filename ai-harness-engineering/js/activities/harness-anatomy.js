/* Theory 0·2 · "Anatomy of a Harness" — click-to-explore map.
 *
 * Six clickable part-chips (the named pieces of a harness). Clicking one reveals:
 *   - the real-world FAILURE that piece exists to fix,
 *   - a plain everyday ANALOGY,
 *   - and the chapter that builds it by hand (with a link).
 * Doubles as the map of Part 2 of the course. No grading — it's an explorer.
 * Reuses .sib-card styling for the chips; the detail panel uses theme tokens inline.
 * Vanilla JS, no deps, works offline.
 *
 * Mount point: <div class="harness-anatomy"></div>
 */
(function () {
  'use strict';

  var PARTS = [
    { id: 'tools', icon: '🖐️', name: 'Tools — มือ', en: 'tools', ch: '04', href: 'ch04-tools.html',
      fix: 'เครื่องยนต์เอื้อมไปดึงข้อมูลหรือลงมือทำเองไม่ได้ — มันได้แต่ “เดา”',
      ana: 'เหมือนให้ “มือ” กับสมองที่เก่งแต่ไม่มีแขน · ชื่อและคำอธิบายของ tool คือคำสั่งที่โมเดลอ่าน' },
    { id: 'context', icon: '📑', name: 'Context — สิ่งที่ต้องรู้', en: 'context', ch: '05', href: 'ch05-context.html',
      fix: 'มันไม่รู้กติกาแล็บ คาบเรียน วันหยุด หรือช่วงซ่อมบำรุง จึงตอบเพี้ยน',
      ana: 'เหมือนเอกสารสรุปกติกาที่วางให้พนักงานใหม่ — ป้อน “สิ่งที่ใช่” ไม่ใช่ “ทุกอย่าง”' },
    { id: 'memory', icon: '🧠', name: 'Memory & State', en: 'memory', ch: '06', href: 'ch06-memory-state.html',
      fix: 'พอถามต่อ “แล้วพรุ่งนี้ล่ะ?” มันจำเรื่องก่อนหน้าไม่ได้',
      ana: 'เหมือนสมุดโน้ตที่ไม่หายไปเมื่อปิดประชุม — เก็บสิ่งสำคัญไว้นอก context' },
    { id: 'grounding', icon: '⚓', name: 'Grounding & Verify', en: 'grounding', ch: '07', href: 'ch07-grounding-verification.html',
      fix: 'มันสร้างห้องที่ไม่มีอยู่จริงขึ้นมาตอบ — อย่างมั่นใจ',
      ana: 'เหมือนกฎ “พูดได้เฉพาะสิ่งที่เห็นในเอกสารจริง” และต้องตรวจกับสภาพแวดล้อม ไม่ใช่กับตัวเอง' },
    { id: 'permissions', icon: '🚦', name: 'Permissions & Safety', en: 'permissions', ch: '08', href: 'ch08-permissions-safety.html',
      fix: 'ถาม “ว่างไหม” แต่มันไปจองให้เลย — ลงมือทำสิ่งที่ย้อนกลับไม่ได้',
      ana: 'เหมือนกุญแจที่เปิดได้เฉพาะห้องที่อนุญาต + ต้องขอคนก่อนทำเรื่องใหญ่ (แยก อ่าน vs ทำ)' },
    { id: 'observability', icon: '🔭', name: 'Operating & Observability', en: 'observability', ch: '09', href: 'ch09-operating-observability.html',
      fix: 'query ค้างไม่จบ และพอตอบผิดก็ดูไม่ออกว่าทำไม',
      ana: 'เหมือนเพดานเวลา/จำนวนรอบ + กล่องดำ (trace) ที่บันทึกทุกการกระทำไว้ให้ย้อนดู' }
  ];

  function build(el) {
    var sel = null;

    var chips = PARTS.map(function (p) {
      return '<button type="button" class="sib-card ha-chip" data-id="' + p.id + '" ' +
        'style="flex-direction:column;align-items:flex-start;min-width:150px;flex:1 1 150px">' +
        '<span><span style="font-size:16px;margin-right:6px">' + p.icon + '</span>' + p.name + '</span>' +
        '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--ink-faint)">' +
          'แก้ปัญหาอะไร? · บท ' + p.ch + '</span>' +
      '</button>';
    }).join('');

    el.innerHTML =
      '<div class="ha">' +
        '<div class="sib-tray" style="gap:9px">' + chips + '</div>' +
        '<div class="ha-detail" style="margin-top:14px;padding:15px 17px;border-radius:12px;' +
          'border:1px dashed var(--line-2);background:rgba(0,0,0,0.22);min-height:96px"></div>' +
      '</div>';

    var detail = el.querySelector('.ha-detail');
    var chipEls = el.querySelectorAll('.ha-chip');

    function showPrompt() {
      detail.style.borderStyle = 'dashed';
      detail.style.borderColor = 'var(--line-2)';
      detail.innerHTML = '<span style="color:var(--ink-faint)">👆 คลิกชิ้นส่วนด้านบนเพื่อดูว่ามัน ' +
        '<b style="color:var(--ink-dim)">เกิดมาแก้ความพังแบบไหน</b> และบทไหนสร้างมัน</span>';
    }

    function showPart(p) {
      detail.style.borderStyle = 'solid';
      detail.style.borderColor = 'var(--cyan)';
      detail.style.background = 'var(--cyan-soft)';
      detail.innerHTML =
        '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:17px;color:var(--cyan-2);margin-bottom:8px">' +
          p.icon + ' ' + p.name +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--ink-faint);margin-left:8px">' + p.en + '</span>' +
        '</div>' +
        '<div style="font-size:13.5px;line-height:1.6;margin-bottom:6px">' +
          '<b style="color:var(--red)">⚠️ ความพังที่มันแก้:</b> ' + p.fix + '</div>' +
        '<div style="font-size:13.5px;line-height:1.6;margin-bottom:10px">' +
          '<b style="color:var(--cyan-2)">เปรียบเทียบ:</b> ' + p.ana + '</div>' +
        '<a href="' + p.href + '" style="font-family:\'JetBrains Mono\',monospace;font-size:12px">' +
          '→ บทที่ ' + p.ch + ' ลงมือสร้างชิ้นนี้</a>';
    }

    chipEls.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = PARTS.filter(function (x) { return x.id === btn.dataset.id; })[0];
        sel = (sel === p.id) ? null : p.id;
        chipEls.forEach(function (b) { b.classList.toggle('sel', b.dataset.id === sel); });
        if (sel) showPart(p); else showPrompt();
      });
    });

    showPrompt();
  }

  function init() { document.querySelectorAll('.harness-anatomy').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
