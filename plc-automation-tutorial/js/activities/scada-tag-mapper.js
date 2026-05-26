/* SCADA Tag Mapper — match process variables to CP1L addresses
 *
 * Markup:
 *   <div class="scada-tag-mapper"></div>
 *
 * Drag-and-drop puzzle: given a process scenario (water tank with level
 * sensors, pump, and temperature controller), student drags each process
 * variable to the correct Omron CP1L address.
 *
 * Validates that:
 *   - Inputs go to CIO 0.xx
 *   - Outputs go to CIO 100.xx
 *   - Word values go to DM (D)
 *   - Retained data goes to HR
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // Process scenario: Tank Heating System (matches O02 + O05 themes)
  // Note: validation checks the *area* (input vs output vs DM) only.
  // The specific bit number within an area is arbitrary — any 0.xx slot
  // accepts any Boolean Input, any 100.xx slot accepts any Boolean Output.
  var SCENARIO = {
    title: 'Tank Heating System — CP1L + E5CC',
    description: 'ระบบฮีตเตอร์ถังน้ำ — มี Pump เติม, Sensor Level สูง/ต่ำ, ฮีตเตอร์ + E5CC + ปุ่ม Start/Stop',
    tags: [
      // Discrete inputs (CIO 0.xx) — area: 'in'
      { id: 'btn_start',   name: 'ปุ่ม Start',           type: 'Boolean', io: 'Input',  desc: 'ปุ่ม Start หน้าตู้ — กดเริ่มงาน',     area: 'in' },
      { id: 'btn_stop',    name: 'ปุ่ม Stop',            type: 'Boolean', io: 'Input',  desc: 'ปุ่ม Stop ฉุกเฉิน',                  area: 'in' },
      { id: 'level_low',   name: 'Level Sensor — ต่ำ',   type: 'Boolean', io: 'Input',  desc: 'Reed switch ใต้ถัง · ON เมื่อน้ำลด', area: 'in' },
      { id: 'level_high',  name: 'Level Sensor — สูง',   type: 'Boolean', io: 'Input',  desc: 'Reed switch บนถัง · ON เมื่อน้ำเต็ม',area: 'in' },
      // Discrete outputs (CIO 100.xx) — area: 'out'
      { id: 'pump',        name: 'Pump (เติมน้ำ)',       type: 'Boolean', io: 'Output', desc: 'Pump motor · ขับผ่าน Magnetic Contactor', area: 'out' },
      { id: 'heater',      name: 'Heater Output',         type: 'Boolean', io: 'Output', desc: 'สัญญาณ ON/OFF ไปหา SSR ของฮีตเตอร์',  area: 'out' },
      { id: 'lamp_run',    name: 'Lamp — Running',        type: 'Boolean', io: 'Output', desc: 'หลอดไฟ Running สีเขียวหน้าตู้',         area: 'out' },
      // Data Memory (D) — area: 'dm'
      { id: 'temp_pv',     name: 'อุณหภูมิจริง (PV จาก E5CC)', type: 'Word', io: 'Memory', desc: 'อ่านจาก E5CC ผ่าน Modbus · °C × 10', area: 'dm' },
      { id: 'temp_sp',     name: 'Set Point อุณหภูมิ',    type: 'Word',    io: 'Memory', desc: 'ค่าตั้งจาก HMI · เขียนกลับไป E5CC',    area: 'dm' }
    ],
    slots: [
      { addr: '0.00',   area: 'in',  label: 'CIO Input — Boolean',  bg: 'cyan' },
      { addr: '0.01',   area: 'in',  label: 'CIO Input — Boolean',  bg: 'cyan' },
      { addr: '0.02',   area: 'in',  label: 'CIO Input — Boolean',  bg: 'cyan' },
      { addr: '0.03',   area: 'in',  label: 'CIO Input — Boolean',  bg: 'cyan' },
      { addr: '100.00', area: 'out', label: 'CIO Output — Boolean', bg: 'accent' },
      { addr: '100.01', area: 'out', label: 'CIO Output — Boolean', bg: 'accent' },
      { addr: '100.02', area: 'out', label: 'CIO Output — Boolean', bg: 'accent' },
      { addr: 'D200',   area: 'dm',  label: 'DM Word — Read',       bg: 'violet' },
      { addr: 'D202',   area: 'dm',  label: 'DM Word — Write',      bg: 'violet' }
    ]
  };

  var AREA_NAMES = {
    in:  'CIO Input (0.xx)',
    out: 'CIO Output (100.xx)',
    dm:  'Data Memory (Dxxx)'
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildMapper(root) {
    root.innerHTML = '';
    root.classList.add('stm');

    var head = el('div', 'stm-head');
    head.innerHTML =
      '<div class="stm-title">🏷️ SCADA Tag Mapper — ' + SCENARIO.title + '</div>' +
      '<div class="stm-desc">' + SCENARIO.description + '</div>' +
      '<div class="stm-rule">📏 <strong>กฎ:</strong> ตรวจที่ <em>กลุ่ม Address</em> (ไม่ใช่เลข bit) — ' +
        'Input ต้องลงใน <code>0.xx</code> · Output ต้องลงใน <code>100.xx</code> · Word ต้องลงใน <code>Dxxx</code>' +
        ' · ลำดับ bit ภายในกลุ่มเดียวกัน (เช่น Start อยู่ 0.00 หรือ 0.03) ขึ้นกับช่างเดินสาย ไม่มีถูก/ผิดตายตัว</div>';
    root.appendChild(head);

    // ---------- Address reference card -----------------------------------
    var ref = el('div', 'stm-ref');
    ref.innerHTML =
      '<div class="stm-ref-title">📖 Omron CP1L Addressing — Quick Ref</div>' +
      '<div class="stm-ref-grid">' +
        '<div class="stm-ref-item stm-ref-cyan"><strong>0.xx</strong> CIO Input — Discrete (Boolean)</div>' +
        '<div class="stm-ref-item stm-ref-accent"><strong>100.xx</strong> CIO Output — Discrete (Boolean)</div>' +
        '<div class="stm-ref-item stm-ref-violet"><strong>D0–D32767</strong> Data Memory — Word (16-bit)</div>' +
        '<div class="stm-ref-item stm-ref-violet"><strong>H0–H511</strong> Holding (retained) — Word</div>' +
      '</div>';
    root.appendChild(ref);

    // ---------- Slots area ------------------------------------------------
    var board = el('div', 'stm-board');
    var slotsWrap = el('div', 'stm-slots');
    SCENARIO.slots.forEach(function (s) {
      var slot = el('div', 'stm-slot stm-slot-' + s.bg);
      slot.setAttribute('data-addr', s.addr);
      slot.innerHTML =
        '<div class="stm-slot-addr">' + s.addr + '</div>' +
        '<div class="stm-slot-label">' + s.label + '</div>' +
        '<div class="stm-slot-target"><span class="stm-slot-placeholder">วางที่นี่</span></div>';
      slotsWrap.appendChild(slot);
    });
    board.appendChild(slotsWrap);
    root.appendChild(board);

    // ---------- Tag palette -----------------------------------------------
    var palette = el('div', 'stm-palette');
    var paletteTitle = el('div', 'stm-palette-title', '📦 ตัวแปรในระบบ — ลากไปวางในที่ที่ถูก');
    palette.appendChild(paletteTitle);
    var paletteGrid = el('div', 'stm-palette-grid');
    var shuffledTags = shuffle(SCENARIO.tags);
    shuffledTags.forEach(function (tag) {
      var chip = el('div', 'stm-tag stm-tag-' + (tag.io === 'Input' ? 'cyan' : tag.io === 'Output' ? 'accent' : 'violet'));
      chip.setAttribute('draggable', 'true');
      chip.setAttribute('data-id', tag.id);
      chip.innerHTML =
        '<div class="stm-tag-name">' + tag.name + '</div>' +
        '<div class="stm-tag-meta">' + tag.type + ' · ' + tag.io + '</div>' +
        '<div class="stm-tag-desc">' + tag.desc + '</div>';
      paletteGrid.appendChild(chip);
    });
    palette.appendChild(paletteGrid);
    root.appendChild(palette);

    // ---------- Action bar -----------------------------------------------
    var actions = el('div', 'stm-actions');
    actions.innerHTML =
      '<button type="button" class="stm-check">✓ ตรวจคำตอบ</button>' +
      '<button type="button" class="stm-reset">⟲ Reset</button>' +
      '<div class="stm-result" id="stm-result"></div>';
    root.appendChild(actions);

    // ---------- Wiring ---------------------------------------------------
    var slots = slotsWrap.querySelectorAll('.stm-slot');
    var tags = paletteGrid.querySelectorAll('.stm-tag');
    var placement = {}; // tagId -> slot addr (or null)

    var dragId = null;
    tags.forEach(function (chip) {
      chip.addEventListener('dragstart', function (e) {
        dragId = chip.getAttribute('data-id');
        chip.classList.add('stm-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {}
      });
      chip.addEventListener('dragend', function () {
        chip.classList.remove('stm-dragging');
        dragId = null;
      });
      // Tap-to-pick on touch
      chip.addEventListener('click', function () {
        tags.forEach(function (t) { t.classList.remove('stm-tag-picked'); });
        chip.classList.add('stm-tag-picked');
        dragId = chip.getAttribute('data-id');
      });
    });

    slots.forEach(function (slot) {
      slot.addEventListener('dragover', function (e) {
        e.preventDefault();
        slot.classList.add('stm-slot-hover');
      });
      slot.addEventListener('dragleave', function () {
        slot.classList.remove('stm-slot-hover');
      });
      slot.addEventListener('drop', function (e) {
        e.preventDefault();
        slot.classList.remove('stm-slot-hover');
        if (!dragId) return;
        placeTag(dragId, slot.getAttribute('data-addr'));
      });
      slot.addEventListener('click', function () {
        if (dragId) {
          placeTag(dragId, slot.getAttribute('data-addr'));
          tags.forEach(function (t) { t.classList.remove('stm-tag-picked'); });
          dragId = null;
        }
      });
    });

    function placeTag(tagId, addr) {
      // Remove any existing placement of this tag
      var prevSlot = placement[tagId];
      if (prevSlot) {
        var prev = slotsWrap.querySelector('[data-addr="' + cssEsc(prevSlot) + '"] .stm-slot-target');
        if (prev) prev.innerHTML = '<span class="stm-slot-placeholder">วางที่นี่</span>';
      }
      // If a different tag was on the target slot, kick it out
      Object.keys(placement).forEach(function (id) {
        if (placement[id] === addr) delete placement[id];
      });
      placement[tagId] = addr;
      repaint();
    }

    function repaint() {
      // Clear all slots first
      slots.forEach(function (s) {
        s.classList.remove('stm-slot-correct', 'stm-slot-wrong');
        s.querySelector('.stm-slot-target').innerHTML = '<span class="stm-slot-placeholder">วางที่นี่</span>';
      });
      // Place tags
      Object.keys(placement).forEach(function (tagId) {
        var addr = placement[tagId];
        var slot = slotsWrap.querySelector('[data-addr="' + cssEsc(addr) + '"]');
        if (!slot) return;
        var tag = findTag(tagId);
        slot.querySelector('.stm-slot-target').innerHTML = '<div class="stm-slot-tagged">' + tag.name + '</div>';
      });
      // Hide / show palette chips based on whether placed
      tags.forEach(function (chip) {
        var id = chip.getAttribute('data-id');
        chip.classList.toggle('stm-tag-placed', !!placement[id]);
      });
    }

    function findTag(id) {
      for (var i = 0; i < SCENARIO.tags.length; i++) if (SCENARIO.tags[i].id === id) return SCENARIO.tags[i];
      return null;
    }

    function cssEsc(s) { return String(s).replace(/\./g, '\\.'); }

    var checkBtn = actions.querySelector('.stm-check');
    var resetBtn = actions.querySelector('.stm-reset');
    var resultEl = actions.querySelector('#stm-result');

    function slotByAddr(addr) {
      for (var i = 0; i < SCENARIO.slots.length; i++) if (SCENARIO.slots[i].addr === addr) return SCENARIO.slots[i];
      return null;
    }

    checkBtn.addEventListener('click', function () {
      var correct = 0, placed = 0;
      slots.forEach(function (s) { s.classList.remove('stm-slot-correct', 'stm-slot-wrong'); });
      SCENARIO.tags.forEach(function (tag) {
        var placedAt = placement[tag.id];
        if (!placedAt) return;
        placed++;
        var slot = slotsWrap.querySelector('[data-addr="' + cssEsc(placedAt) + '"]');
        var slotDef = slotByAddr(placedAt);
        if (!slot || !slotDef) return;
        // Match by AREA only — any input bit accepts any Input tag, etc.
        if (tag.area === slotDef.area) {
          slot.classList.add('stm-slot-correct');
          correct++;
        } else {
          slot.classList.add('stm-slot-wrong');
        }
      });
      var total = SCENARIO.tags.length;
      if (correct === total && placed === total) {
        resultEl.className = 'stm-result stm-result-win';
        resultEl.innerHTML = '🎉 ครบทั้งหมด! ' + correct + '/' + total +
          ' · <span style="opacity:0.8">(ลำดับ bit ในแต่ละ area ไม่สำคัญ — Start อยู่ 0.00 หรือ 0.03 ก็ใช้ได้ ขอแค่อยู่ใน CIO Input)</span>';
      } else if (placed < total) {
        resultEl.className = 'stm-result stm-result-partial';
        resultEl.textContent = 'วางแล้ว ' + placed + '/' + total + ' ตัว — ลากที่เหลือไปวางก่อน';
      } else {
        // Find which tags are misplaced and explain
        var misplaced = [];
        SCENARIO.tags.forEach(function (tag) {
          var placedAt = placement[tag.id];
          if (!placedAt) return;
          var slotDef = slotByAddr(placedAt);
          if (slotDef && tag.area !== slotDef.area) {
            misplaced.push(tag.name + ' ควรอยู่ใน ' + AREA_NAMES[tag.area] + ' (ไม่ใช่ ' + AREA_NAMES[slotDef.area] + ')');
          }
        });
        resultEl.className = 'stm-result stm-result-partial';
        resultEl.innerHTML = 'ถูก ' + correct + '/' + total + ' · ' + misplaced.slice(0, 2).join(' · ') + (misplaced.length > 2 ? ' …' : '');
      }
    });

    resetBtn.addEventListener('click', function () {
      placement = {};
      slots.forEach(function (s) { s.classList.remove('stm-slot-correct', 'stm-slot-wrong'); });
      tags.forEach(function (chip) { chip.classList.remove('stm-tag-placed', 'stm-tag-picked'); });
      resultEl.className = 'stm-result';
      resultEl.textContent = '';
      repaint();
    });

    repaint();
  }

  function init() {
    document.querySelectorAll('.scada-tag-mapper').forEach(buildMapper);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
