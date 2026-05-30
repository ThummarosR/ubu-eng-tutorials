/* Ch9 · "Debug From The Trace: Flat Log vs Span Tree" — before-after-rewrite.
 *
 * Same failed multi-step run shown twice. LEFT: a flat append-only log (ts/tool/
 * status/error only) where the root-cause error is buried among unrelated background
 * lines. The learner hunts for the failing step (misclicks counted). RIGHT (revealed):
 * the same run as a nested span tree with trace_id + parent/child + intent, where the
 * root cause is one obvious red branch. Same data — structure is the observability.
 *
 * Mount point: <div class="debug-the-trace"></div>
 * Vanilla JS, no deps, works offline.
 */
(function () {
  'use strict';

  var ROOT = 'reserve';
  // one failing run (req-7f3a) interleaved with background noise
  var EV = [
    { id:'n1', ts:'03:14:56.701', tool:'building.airquality',   st:'ok',  noise:'puller เบื้องหลัง ไม่เกี่ยวกับงานนี้' },
    { id:'a1', ts:'03:14:56.742', tool:'agent.set_max_turns',   st:'error', err:"ARG_ERROR: missing 'max_turns'", noise:'probe ยิง tool ด้วย args ว่าง — ไม่ใช่ run ของคุณ' },
    { id:'r0', ts:'03:14:56.745', tool:'handle_request',        st:'ok',  trace:'req-7f3a', parent:null, intent:'จองห้องตามตารางสัปดาห์ EE201' },
    { id:'n2', ts:'03:14:56.760', tool:'building.connectivity', st:'ok',  noise:'probe เครือข่ายเบื้องหลัง' },
    { id:'r1', ts:'03:14:56.781', tool:'booking.read',          st:'ok',  trace:'req-7f3a', parent:'r0', intent:'อ่านการจองเดิม' },
    { id:'a2', ts:'03:14:56.799', tool:'autopilot.scheduler_run_now', st:'error', err:"ARG_ERROR: missing 'job'", noise:'probe args ว่าง — ตัวลวง' },
    { id:'r2', ts:'03:14:56.820', tool:'clash.check',           st:'ok',  trace:'req-7f3a', parent:'r0', intent:'ตรวจชนคาบเรียน/ซ่อมบำรุง' },
    { id:'n3', ts:'03:14:56.841', tool:'pm25.pull',             st:'ok',  noise:'puller AQI เบื้องหลัง' },
    { id:'reserve', ts:'03:14:56.870', tool:'room.reserve',     st:'error', err:'HTTP 500 from reserve', trace:'req-7f3a', parent:'r0', intent:'จองห้องตามตาราง (สาเหตุจริง: ชนช่วงซ่อมบำรุง)' },
    { id:'a3', ts:'03:14:56.888', tool:'autopilot.puller_run_now', st:'error', err:"ARG_ERROR: missing 'puller'", noise:'probe args ว่าง — ตัวลวง' },
    { id:'n4', ts:'03:14:56.902', tool:'display.refresh',       st:'ok',  noise:'รีเฟรชจอแสดงผลห้อง' },
    { id:'r3', ts:'03:14:56.930', tool:'notify.staff',          st:'skip', trace:'req-7f3a', parent:'r0', intent:'แจ้งเจ้าหน้าที่ (ไม่ได้ทำ เพราะขั้นก่อนพัง)' },
    { id:'n5', ts:'03:14:56.951', tool:'instrument.scan',       st:'ok',  noise:'สแกนทะเบียนเครื่องมือเบื้องหลัง' },
    { id:'a4', ts:'03:14:56.969', tool:'agent.set_model',       st:'error', err:"ARG_ERROR: missing 'model'", noise:'probe args ว่าง — ตัวลวง' }
  ];

  function build(el) {
    var t0 = 0, misclicks = 0, solvedFlat = false, treeShown = false;

    el.innerHTML =
      '<div class="dt-cols">' +
        '<div class="dt-pane"><h5>Flat log — agent_traces.jsonl (ts · tool · status · error)</h5>' +
          '<div class="dt-flat"></div>' +
          '<div class="dt-board">คลิกบรรทัดที่เป็น “สาเหตุจริง” ของงานจองที่ล้มเหลว · <span data-timer>0.0s</span> · ผิด <span data-mis>0</span> ครั้ง</div>' +
        '</div>' +
        '<div class="dt-foot"><button type="button" class="sib-btn" data-act="reveal">เปิดมุมมอง span tree →</button></div>' +
        '<div class="dt-pane"><div class="dt-tree"></div></div>' +
      '</div>';

    var flat = el.querySelector('.dt-flat');
    var tree = el.querySelector('.dt-tree');
    var timerEl = el.querySelector('[data-timer]');
    var misEl = el.querySelector('[data-mis]');
    var revealBtn = el.querySelector('[data-act="reveal"]');
    var timer = null;

    function startTimer() {
      if (timer) return;
      t0 = Date.now();
      timer = setInterval(function () {
        timerEl.textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's';
      }, 100);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    // LEFT: flat log
    EV.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : 1; }).forEach(function (e) {
      var d = document.createElement('div');
      d.className = 'dt-line' + (e.st === 'error' ? ' err' : '');
      d.dataset.id = e.id;
      d.textContent = e.ts + '  ' + e.tool + '  [' + e.st + ']' + (e.err ? '  ' + e.err : '');
      d.addEventListener('click', function () {
        startTimer();
        if (solvedFlat) return;
        if (e.id === ROOT) {
          solvedFlat = true; stopTimer();
          d.classList.add('right');
          el.querySelector('.dt-board').innerHTML = '✅ เจอแล้ว! room.reserve คืน HTTP 500 — แต่ใช้เวลา ' +
            ((Date.now() - t0) / 1000).toFixed(1) + 's และผิด ' + misclicks + ' ครั้ง กว่าจะเจอในกองบรรทัด';
        } else {
          misclicks++; misEl.textContent = misclicks;
          d.classList.add('wrong');
          var why = e.noise || (e.trace ? 'บรรทัดนี้คือขั้นที่สำเร็จของ run เดียวกัน ไม่ใช่สาเหตุ' : 'ไม่เกี่ยวกับ run นี้');
          d.title = why;
          setTimeout(function () { d.classList.remove('wrong'); }, 600);
        }
      });
      flat.appendChild(d);
    });

    // RIGHT: span tree (hidden until reveal)
    revealBtn.addEventListener('click', function () {
      treeShown = true;
      tree.className = 'dt-tree show';
      var run = EV.filter(function (e) { return e.trace === 'req-7f3a'; });
      function renderChildren(parentId) {
        var kids = run.filter(function (e) { return e.parent === parentId; });
        if (!kids.length) return '';
        var html = '<ul>';
        kids.forEach(function (e) {
          var dot = e.st === 'error' ? 'err' : e.st === 'skip' ? 'run' : 'ok';
          var rc = e.id === ROOT ? ' rootcause' : '';
          html += '<li><div class="dt-span' + rc + '" data-id="' + e.id + '">' +
            '<span class="dt-dot ' + dot + '"></span><b>' + e.tool + '</b>' +
            '<span class="dt-intent">— ' + (e.intent || '') + (e.err ? ' · ' + e.err : '') + '</span>' +
            '<span class="dt-dur" style="width:' + (e.id === ROOT ? 70 : 28) + 'px"></span></div>' +
            renderChildren(e.id) + '</li>';
        });
        return html + '</ul>';
      }
      var rootSpan = run.find(function (e) { return e.parent === null; });
      tree.innerHTML = '<h5>Span tree — trace_id=req-7f3a (+ parent/child + intent)</h5>' +
        '<ul><li><div class="dt-span" data-id="' + rootSpan.id + '">' +
          '<span class="dt-dot run"></span><b>' + rootSpan.tool + '</b>' +
          '<span class="dt-intent">— ' + rootSpan.intent + '</span></div>' +
          renderChildren(rootSpan.id) + '</li></ul>' +
        '<div class="dt-board">ในมุมมองนี้ room.reserve เด้งแดงทันที — ขอบสีแดง + intent + error ชี้สาเหตุใน “คลิกเดียว” ' +
          'ข้อมูลชุดเดียวกันเป๊ะ ต่างกันแค่ “โครงสร้าง” (trace_id + parent + intent) = นั่นแหละ observability</div>';
      tree.querySelectorAll('.dt-span').forEach(function (sp) {
        sp.addEventListener('click', function () {
          if (sp.dataset.id === ROOT) sp.style.outline = '2px solid var(--green)';
        });
      });
      revealBtn.style.display = 'none';
    });
  }

  function init() { document.querySelectorAll('.debug-the-trace').forEach(build); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
