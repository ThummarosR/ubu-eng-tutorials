/* SCADA Workshop · Step 1 — Blink (Boolean Point + Visibility/Color animation)
 *
 * Markup:
 *   <div class="scada-ws-blink"></div>
 *
 * Mini CX-Supervisor mockup:
 *   - Left panel: "Point Editor" — student creates 1 Boolean Point
 *   - Middle: "Mimic Page" with a Lamp shape — student selects an Animation
 *   - Right: "Runtime" — Build & Run. Toggle button + auto-blink mode
 *
 * Grounded in: การประยุกต์ใช้โปรแกรม SCADA ในงานอุตสาหกรรม 2559, Vol 1 · Exam 1 (Blink)
 * No deps. Offline.
 */
(function () {
  'use strict';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function buildBlink(root) {
    root.innerHTML = '';
    root.classList.add('scada-ws');

    var state = {
      point: null,           // { name, type, addr }
      animation: null,       // 'visibility' | 'color' | null
      running: false,
      bit: 0,                // current Boolean value
      blinkTimer: null,
      mode: 'manual'         // 'manual' | 'auto'
    };

    // ============================================================
    // HEADER
    // ============================================================
    var head = el('div', 'scada-ws-head');
    head.innerHTML =
      '<div class="scada-ws-step">🔴 Step 1 · BLINK</div>' +
      '<div class="scada-ws-title">หลอดไฟกะพริบ — Boolean Point + Animation</div>' +
      '<div class="scada-ws-desc">โจทย์: สร้าง Point Boolean 1 ตัว ใส่ Animation ให้ shape บนหน้า Mimic แล้ว Run ให้กะพริบ — ' +
      'ตามตำรา <em>การประยุกต์ใช้โปรแกรม SCADA ในอุตสาหกรรม</em> เล่ม 1 · Exam 1</div>';
    root.appendChild(head);

    // ============================================================
    // TASK PROGRESS
    // ============================================================
    var progress = el('div', 'scada-ws-progress');
    progress.innerHTML =
      '<div class="scada-ws-prog-item" data-key="point">1. สร้าง Point</div>' +
      '<div class="scada-ws-prog-item" data-key="anim">2. ใส่ Animation</div>' +
      '<div class="scada-ws-prog-item" data-key="run">3. กด Run</div>' +
      '<div class="scada-ws-prog-item" data-key="blink">4. ทำให้กะพริบ</div>';
    root.appendChild(progress);

    // ============================================================
    // 3-COLUMN WORKBENCH
    // ============================================================
    var bench = el('div', 'scada-ws-bench');

    // ---------- LEFT: Point Editor --------------------------------------
    var pointPanel = el('div', 'scada-ws-panel');
    pointPanel.innerHTML =
      '<div class="scada-ws-panel-title">📍 Point Editor</div>' +
      '<div class="scada-ws-panel-sub">เพิ่ม Tag ที่จะใช้บน Mimic</div>' +
      '<div class="scada-ws-form">' +
      '  <label>ชื่อ Point</label>' +
      '  <input type="text" class="ws-input" id="ws-blink-name" placeholder="Lamp_Run" value="Lamp_Run">' +
      '  <label>ประเภท</label>' +
      '  <select class="ws-input" id="ws-blink-type">' +
      '    <option value="">— เลือก —</option>' +
      '    <option value="Boolean">Boolean</option>' +
      '    <option value="Integer">Integer</option>' +
      '    <option value="Real">Real</option>' +
      '  </select>' +
      '  <label>I/O Source — Address</label>' +
      '  <input type="text" class="ws-input" id="ws-blink-addr" placeholder="100.00" value="100.00">' +
      '  <button type="button" class="ws-btn-primary" id="ws-blink-add-point">+ Add Point</button>' +
      '</div>' +
      '<div class="scada-ws-pointlist" id="ws-blink-points"><div class="scada-ws-empty">ยังไม่มี Point</div></div>';

    // ---------- MIDDLE: Mimic Page --------------------------------------
    var mimicPanel = el('div', 'scada-ws-panel scada-ws-mimic-wrap');
    mimicPanel.innerHTML =
      '<div class="scada-ws-panel-title">🖼️ Mimic Page — "Main"</div>' +
      '<div class="scada-ws-panel-sub">หลอดไฟตรงกลางคือ Shape · คลิกเพื่อเลือก → ใส่ Animation</div>' +
      '<div class="scada-ws-mimic" id="ws-blink-mimic">' +
      '  <div class="scada-ws-lamp" id="ws-blink-lamp">' +
      '    <div class="scada-ws-lamp-bulb"></div>' +
      '    <div class="scada-ws-lamp-cap"></div>' +
      '    <div class="scada-ws-lamp-label">LAMP</div>' +
      '  </div>' +
      '</div>' +
      '<div class="scada-ws-anim-row">' +
      '  <div class="scada-ws-anim-title">🎬 Animation บน Shape:</div>' +
      '  <button type="button" class="ws-chip" data-anim="visibility" id="ws-blink-anim-v">Visibility</button>' +
      '  <button type="button" class="ws-chip" data-anim="color" id="ws-blink-anim-c">Color</button>' +
      '</div>' +
      '<div class="scada-ws-anim-bind" id="ws-blink-bind">' +
      '  <span class="scada-ws-anim-bind-empty">— เลือก Animation แล้ว link กับ Point —</span>' +
      '</div>';

    // ---------- RIGHT: Runtime ------------------------------------------
    var runtimePanel = el('div', 'scada-ws-panel');
    runtimePanel.innerHTML =
      '<div class="scada-ws-panel-title">▶️ Runtime</div>' +
      '<div class="scada-ws-panel-sub">เมื่อพร้อมแล้ว — Build &amp; Run</div>' +
      '<button type="button" class="ws-btn-run" id="ws-blink-run">▶ Build &amp; Run</button>' +
      '<div class="scada-ws-runtime-state" id="ws-blink-rt-state">⏸ Editor Mode</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-runtime-ctrl">' +
      '  <div class="scada-ws-runtime-label">ควบคุม <code>Lamp_Run</code>:</div>' +
      '  <button type="button" class="ws-btn-toggle" id="ws-blink-toggle" disabled>Toggle ค่า</button>' +
      '  <label class="ws-switch">' +
      '    <input type="checkbox" id="ws-blink-auto" disabled>' +
      '    <span>Auto-blink (script · 0.5s)</span>' +
      '  </label>' +
      '</div>' +
      '<div class="scada-ws-runtime-divider"></div>' +
      '<div class="scada-ws-runtime-watch">' +
      '  <div class="scada-ws-watch-row">' +
      '    <span>Lamp_Run.Value</span>' +
      '    <span class="ws-bit" id="ws-blink-watch">—</span>' +
      '  </div>' +
      '</div>';

    bench.appendChild(pointPanel);
    bench.appendChild(mimicPanel);
    bench.appendChild(runtimePanel);
    root.appendChild(bench);

    // ============================================================
    // STATUS / HINT BAR
    // ============================================================
    var hint = el('div', 'scada-ws-hint', '👉 เริ่มจากกรอก Point ในช่องซ้าย แล้วกด <strong>+ Add Point</strong>');
    root.appendChild(hint);

    // ============================================================
    // WIRING
    // ============================================================
    var nameI   = pointPanel.querySelector('#ws-blink-name');
    var typeI   = pointPanel.querySelector('#ws-blink-type');
    var addrI   = pointPanel.querySelector('#ws-blink-addr');
    var addBtn  = pointPanel.querySelector('#ws-blink-add-point');
    var listEl  = pointPanel.querySelector('#ws-blink-points');
    var animV   = mimicPanel.querySelector('#ws-blink-anim-v');
    var animC   = mimicPanel.querySelector('#ws-blink-anim-c');
    var bindEl  = mimicPanel.querySelector('#ws-blink-bind');
    var lamp    = mimicPanel.querySelector('#ws-blink-lamp');
    var runBtn  = runtimePanel.querySelector('#ws-blink-run');
    var rtState = runtimePanel.querySelector('#ws-blink-rt-state');
    var togBtn  = runtimePanel.querySelector('#ws-blink-toggle');
    var autoCb  = runtimePanel.querySelector('#ws-blink-auto');
    var watch   = runtimePanel.querySelector('#ws-blink-watch');

    function setHint(html, cls) {
      hint.className = 'scada-ws-hint' + (cls ? ' ' + cls : '');
      hint.innerHTML = html;
    }

    function setProg(key, done) {
      var node = progress.querySelector('[data-key="' + key + '"]');
      if (node) node.classList.toggle('done', !!done);
    }

    function renderPointList() {
      listEl.innerHTML = '';
      if (!state.point) {
        listEl.appendChild(el('div', 'scada-ws-empty', 'ยังไม่มี Point'));
        return;
      }
      var p = state.point;
      var typeCls = p.type === 'Boolean' ? 'cyan' : p.type === 'Integer' ? 'violet' : 'accent';
      var row = el('div', 'scada-ws-pointrow ' + typeCls);
      row.innerHTML =
        '<div class="ws-pr-name">' + p.name + '</div>' +
        '<div class="ws-pr-meta">' + p.type + ' · ' + p.addr + '</div>';
      listEl.appendChild(row);
    }

    function renderBind() {
      bindEl.innerHTML = '';
      if (!state.animation) {
        bindEl.appendChild(el('span', 'scada-ws-anim-bind-empty', '— เลือก Animation แล้ว link กับ Point —'));
        return;
      }
      if (!state.point) {
        bindEl.innerHTML =
          '<div class="scada-ws-anim-card ws-warn">' +
          '  Animation: <strong>' + state.animation + '</strong> · ⚠️ ยังไม่มี Point ให้ link' +
          '</div>';
        return;
      }
      var expr = state.animation === 'visibility'
        ? state.point.name + '.Value = 1'
        : state.point.name + '.Value';
      bindEl.innerHTML =
        '<div class="scada-ws-anim-card ws-ok">' +
        '  <div class="ws-ab-row"><span>Animation:</span><strong>' + state.animation + '</strong></div>' +
        '  <div class="ws-ab-row"><span>Linked Point:</span><strong>' + state.point.name + '</strong></div>' +
        '  <div class="ws-ab-row"><span>Expression:</span><code>' + expr + '</code></div>' +
        '</div>';
    }

    function refreshLamp() {
      var on = !!state.bit;
      lamp.classList.toggle('on', on && state.running);
      // visibility animation = hide entire lamp; color animation = change bulb color
      var anim = state.animation;
      if (state.running && anim === 'visibility') {
        lamp.classList.toggle('ws-hidden', !on);
      } else {
        lamp.classList.remove('ws-hidden');
      }
      lamp.classList.toggle('ws-anim-color', state.running && anim === 'color');
    }

    function refreshWatch() {
      if (!state.point) { watch.textContent = '—'; watch.className = 'ws-bit'; return; }
      watch.textContent = state.running ? String(state.bit) : '(stopped)';
      watch.className = 'ws-bit' + (state.running ? (state.bit ? ' on' : ' off') : '');
    }

    function checkBlinkAchievement() {
      if (state.running && state.point && state.animation && state.bit !== state.lastBitForAchieve) {
        state.toggleCount = (state.toggleCount || 0) + 1;
        if (state.toggleCount >= 2) {
          setProg('blink', true);
          setHint('🎉 <strong>สำเร็จ!</strong> Lamp กะพริบครบ — Concept ของ Boolean Point + Animation พร้อมเข้าสู่ Step 2 (Water Flow)', 'ok');
        }
      }
      state.lastBitForAchieve = state.bit;
    }

    // ---- Add Point ---------------------------------------------------
    addBtn.addEventListener('click', function () {
      var name = (nameI.value || '').trim();
      var type = typeI.value;
      var addr = (addrI.value || '').trim();
      if (!name) { setHint('⚠️ กรุณาตั้งชื่อ Point', 'warn'); return; }
      if (type !== 'Boolean') {
        setHint('⚠️ Step นี้ใช้ <strong>Boolean</strong> เพื่อทำหลอดกะพริบ — เลือก Boolean', 'warn');
        return;
      }
      if (!addr) { setHint('⚠️ ใส่ Address (เช่น 100.00 = Q0)', 'warn'); return; }
      state.point = { name: name, type: type, addr: addr };
      renderPointList();
      renderBind();
      setProg('point', true);
      setHint('✓ เพิ่ม Point <code>' + name + '</code> แล้ว — ต่อไป: คลิกหลอด แล้วเลือก Animation (Visibility หรือ Color)');
    });

    // ---- Choose Animation -------------------------------------------
    function pickAnim(which) {
      if (!state.point) {
        setHint('⚠️ ต้องสร้าง Point ก่อน แล้วค่อยใส่ Animation', 'warn');
        return;
      }
      state.animation = which;
      animV.classList.toggle('active', which === 'visibility');
      animC.classList.toggle('active', which === 'color');
      lamp.classList.add('selected');
      renderBind();
      setProg('anim', true);
      setHint('✓ ใส่ Animation <strong>' + which + '</strong> link กับ <code>' + state.point.name + '</code> — ต่อไป: กด ▶ Build &amp; Run');
    }
    animV.addEventListener('click', function () { pickAnim('visibility'); });
    animC.addEventListener('click', function () { pickAnim('color'); });
    lamp.addEventListener('click', function () {
      lamp.classList.add('selected');
      if (!state.animation) {
        setHint('💡 เลือก Animation ใต้ Mimic — Visibility (ซ่อน/แสดง) หรือ Color (เปลี่ยนสี)');
      }
    });

    // ---- Build & Run -------------------------------------------------
    runBtn.addEventListener('click', function () {
      if (!state.point) { setHint('⚠️ ต้องมี Point ก่อนจึงรันได้', 'warn'); return; }
      if (!state.animation) { setHint('⚠️ ต้องใส่ Animation ก่อนรัน', 'warn'); return; }
      state.running = !state.running;
      if (state.running) {
        runBtn.textContent = '⏹ Stop';
        runBtn.classList.add('running');
        rtState.textContent = '▶ Running…';
        rtState.classList.add('on');
        togBtn.disabled = false;
        autoCb.disabled = false;
        setProg('run', true);
        setHint('🟢 รันแล้ว — กด <strong>Toggle ค่า</strong> หรือเปิด <strong>Auto-blink</strong> เพื่อให้กะพริบ ≥ 2 ครั้ง');
      } else {
        runBtn.textContent = '▶ Build & Run';
        runBtn.classList.remove('running');
        rtState.textContent = '⏸ Editor Mode';
        rtState.classList.remove('on');
        togBtn.disabled = true;
        autoCb.disabled = true;
        autoCb.checked = false;
        stopAutoBlink();
      }
      refreshLamp();
      refreshWatch();
    });

    togBtn.addEventListener('click', function () {
      state.bit = state.bit ? 0 : 1;
      refreshLamp();
      refreshWatch();
      checkBlinkAchievement();
    });

    function startAutoBlink() {
      stopAutoBlink();
      state.blinkTimer = setInterval(function () {
        state.bit = state.bit ? 0 : 1;
        refreshLamp();
        refreshWatch();
        checkBlinkAchievement();
      }, 500);
    }
    function stopAutoBlink() {
      if (state.blinkTimer) { clearInterval(state.blinkTimer); state.blinkTimer = null; }
    }
    autoCb.addEventListener('change', function () {
      if (autoCb.checked) startAutoBlink(); else stopAutoBlink();
    });
  }

  function init() {
    var nodes = document.querySelectorAll('.scada-ws-blink');
    for (var i = 0; i < nodes.length; i++) buildBlink(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
