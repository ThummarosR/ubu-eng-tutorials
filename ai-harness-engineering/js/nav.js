/* Shared sidebar navigation for AI Harness Engineering.
 *
 * One source of truth for the 20-chapter outline (v3). Each page carries a
 * <nav> inside .sidebar; this script fills it with the full chapter list and
 * marks the current page active (matched by filename). Lets us add chapters
 * without hand-editing every page's sidebar. Vanilla JS, no deps.
 */
(function () {
  'use strict';

  var SECTIONS = [
    { h: 'เริ่มต้น', items: [
      { n: '00', t: 'หน้าแรก & ภาพรวม', f: 'index.html' } ] },
    { h: '0 · ปูพื้นทฤษฎี', items: [
      { n: '0·1', t: 'Harness คืออะไร', f: 'th01-what-is-a-harness.html' },
      { n: '0·2', t: 'กายวิภาค & ลูป', f: 'th02-anatomy-and-loop.html' },
      { n: '0·3', t: 'ภูมิทัศน์สนามปี 2026', f: 'th03-the-field-2026.html' } ] },
    { h: '1 · ปัญหา & คำศัพท์', items: [
      { n: '01', t: 'สถานการณ์', f: 'ch01-the-situation.html' },
      { n: '02', t: 'Script & การเรียกครั้งเดียว', f: 'ch02-script-and-call.html' },
      { n: '03', t: 'Loop → Agent', f: 'ch03-loop-to-agent.html' } ] },
    { h: '2 · ประกอบ Harness', items: [
      { n: '04', t: 'Tools — มือ', f: 'ch04-tools.html' },
      { n: '05', t: 'Context — สิ่งที่ต้องรู้', f: 'ch05-context.html' },
      { n: '06', t: 'Memory & State', f: 'ch06-memory-state.html' },
      { n: '07', t: 'Grounding & Verify', f: 'ch07-grounding-verification.html' },
      { n: '08', t: 'Permissions & Safety', f: 'ch08-permissions-safety.html' },
      { n: '09', t: 'ควบคุม & มองเห็น', f: 'ch09-operating-observability.html' },
      { n: '10', t: 'นี่แหละ Harness', f: 'ch10-the-harness.html' } ] },
    { h: '3 · เชื่อมกับโลก', items: [
      { n: '11', t: 'MCP', f: 'ch11-mcp.html' },
      { n: '12', t: 'Skills & Tool Surface', f: 'ch12-skills-tool-surface.html' } ] },
    { h: '4 · Context · เชื่อถือ · สเกล', items: [
      { n: '13', t: 'Context Engineering', f: 'ch13-context-engineering.html' },
      { n: '14', t: 'Security', f: 'ch14-security.html' },
      { n: '15', t: 'Orchestration & บันได', f: 'ch15-orchestration-ladder.html' },
      { n: '16', t: 'Evaluation', f: 'ch16-evaluation.html' } ] },
    { h: '5 · มุมมองมืออาชีพ', items: [
      { n: '17', t: 'Cockpit & Fleet', f: 'ch17-cockpit-fleet.html' } ] },
    { h: '6 · พรมแดนถัดไป', items: [
      { n: '18', t: 'Physical AI', f: 'ch18-physical-ai.html' },
      { n: '19', t: 'Human Integration', f: 'ch19-human-integration.html' },
      { n: '20', t: 'Capstone', f: 'ch20-capstone.html' } ] },
    { h: 'สรุปรวม', items: [
      { n: '🗂️', t: 'Fleet Gallery', f: 'gallery.html' } ] },
    { h: 'แหล่งข้อมูล', items: [
      { n: '📚', t: 'เอกสารอ้างอิง', f: 'references.html' } ] }
  ];

  // Pages that exist yet. Anything not in this set renders as a dimmed "soon"
  // entry (no link), so a partially-built site never shows dead links.
  // Update as each batch lands so the sidebar never links to a page that doesn't exist yet.
  var BUILT = {
    'index.html':1,
    'th01-what-is-a-harness.html':1, 'th02-anatomy-and-loop.html':1, 'th03-the-field-2026.html':1,
    'ch01-the-situation.html':1, 'ch02-script-and-call.html':1, 'ch03-loop-to-agent.html':1,
    'ch04-tools.html':1, 'ch05-context.html':1, 'ch06-memory-state.html':1,
    'ch07-grounding-verification.html':1, 'ch08-permissions-safety.html':1,
    'ch09-operating-observability.html':1, 'ch10-the-harness.html':1,
    'ch11-mcp.html':1, 'ch12-skills-tool-surface.html':1,
    'ch13-context-engineering.html':1, 'ch14-security.html':1,
    'ch15-orchestration-ladder.html':1, 'ch16-evaluation.html':1,
    'ch17-cockpit-fleet.html':1, 'ch18-physical-ai.html':1,
    'ch19-human-integration.html':1, 'ch20-capstone.html':1,
    'gallery.html':1, 'references.html':1
  };

  function esc(s) { return s.replace(/&/g, '&amp;'); }

  var here = (location.pathname.split('/').pop() || 'index.html');
  if (here === '') here = 'index.html';

  var html = '';
  SECTIONS.forEach(function (s) {
    html += '<h4>' + esc(s.h) + '</h4>';
    s.items.forEach(function (it) {
      var label = '<span class="num">' + it.n + '</span> ' + esc(it.t);
      if (!BUILT[it.f]) {
        html += '<a class="soon">' + label + '</a>';
      } else {
        var cls = (it.f === here) ? ' class="active"' : '';
        html += '<a href="' + it.f + '"' + cls + '>' + label + '</a>';
      }
    });
  });

  function mount() {
    var nav = document.querySelector('.sidebar nav');
    if (nav) nav.innerHTML = html;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
