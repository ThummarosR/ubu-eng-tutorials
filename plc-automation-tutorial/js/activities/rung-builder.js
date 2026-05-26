/* Build-the-Rung puzzle (multi-rung capable)
 *
 * Markup:
 *   <div class="rung-builder" data-puzzle="self-hold-puzzle" data-syntax="mit"></div>
 *
 * Puzzle definition (see PUZZLES below):
 *   {
 *     title, prompt,
 *     slots: [{ id, hint? }],
 *     palette: [{ type:'NO'|'NC'|'COIL', device, label, color? }],
 *     solution: { slotId: paletteIdx, ... },
 *     rungs: [
 *       { template: <node>, output: <node>|<fixed> }, ...
 *     ]
 *   }
 *
 * Node forms in template:
 *   { slot: 's1' }                       — empty slot
 *   { type:'and', children:[...] }       — AND group
 *   { type:'or',  children:[...] }       — OR group
 *
 * Output node forms:
 *   { slot: 's1' }                                              — slot expects a COIL block
 *   { kind:'timer', device:'T0', preset:30, label?:'TIM K30' }   — fixed timer (not a slot)
 *   { kind:'counter', device:'C0', preset:5, label?:'CTU K5' }   — fixed counter
 *
 * No deps. Offline.
 */
(function () {
  'use strict';

  // ---------- Puzzle library ------------------------------------------------
  var PUZZLES = {

    'self-hold-puzzle': {
      title: '🧩 Build the Rung — Self-Hold',
      prompt: 'ลากบล็อกจากด้านล่างมาวางในช่องว่างเพื่อสร้าง <strong>Self-Hold ของ Y0</strong>:<br>' +
              '— เมื่อกด <code>X0</code> (Start), <code>Y0</code> ต้อง <strong>ON ค้าง</strong> · กด <code>X1</code> (Stop) จึงดับ',
      slots: [
        { id: 's1', hint: 'ปุ่ม Start' },
        { id: 's2', hint: 'Self-hold contact' },
        { id: 's3', hint: 'ปุ่ม Stop' },
        { id: 's4', hint: 'Output coil' }
      ],
      palette: [
        { type: 'NO',   device: 'X0', label: 'Start',     color: 'ok' },
        { type: 'NO',   device: 'Y0', label: 'Self-hold', color: 'cyan' },
        { type: 'NC',   device: 'X1', label: 'Stop',      color: 'danger' },
        { type: 'COIL', device: 'Y0', label: 'Lamp',      color: 'orange' },
        { type: 'NC',   device: 'X0', label: 'Start (NC)' },
        { type: 'NO',   device: 'X1', label: 'Stop (NO)' }
      ],
      solution: { s1: 0, s2: 1, s3: 2, s4: 3 },
      rungs: [
        { template: { type: 'and', children: [
            { type: 'or', children: [{ slot: 's1' }, { slot: 's2' }] },
            { slot: 's3' }
          ]},
          output: { slot: 's4' }
        }
      ]
    },

    'start-stop-simple': {
      title: '🧩 Start / Stop แบบไม่มี Self-hold',
      prompt: 'สร้าง Rung ที่กด <code>X0</code> <strong>ค้างไว้</strong> → <code>Y0</code> ติด · ปล่อย → ดับ · กด <code>X1</code> = ตัดทันที',
      slots: [
        { id: 's1', hint: 'ปุ่ม Start (กดค้าง)' },
        { id: 's2', hint: 'ปุ่ม Stop' },
        { id: 's3', hint: 'Output coil' }
      ],
      palette: [
        { type: 'NO',   device: 'X0', label: 'Start', color: 'ok' },
        { type: 'NC',   device: 'X1', label: 'Stop',  color: 'danger' },
        { type: 'COIL', device: 'Y0', label: 'Lamp',  color: 'orange' },
        { type: 'NC',   device: 'X0', label: 'Start (NC)' },
        { type: 'NO',   device: 'X1', label: 'Stop (NO)' },
        { type: 'NO',   device: 'Y0', label: 'Y0 (NO)' }
      ],
      solution: { s1: 0, s2: 1, s3: 2 },
      rungs: [
        { template: { type: 'and', children: [{ slot: 's1' }, { slot: 's2' }] },
          output: { slot: 's3' }
        }
      ]
    },

    'timer-on-delay-puzzle': {
      title: '🧩 Build the Rungs — Timer ON-Delay',
      prompt: 'สร้าง 2 Rung ที่เมื่อ <code>X0</code> ค้าง 3 วินาที → <code>T0</code> ครบ → <code>Y0</code> ติด<br>' +
              '<strong>Rung 1</strong>: ใส่ Trigger ของ Timer T0 · <strong>Rung 2</strong>: ใช้ T0 ขับ Coil Y0',
      slots: [
        { id: 's1', hint: 'Trigger ของ T0' },
        { id: 's2', hint: 'Timer Bit (T0)' },
        { id: 's3', hint: 'Output coil' }
      ],
      palette: [
        { type: 'NO',   device: 'X0', label: 'Trigger',   color: 'ok' },
        { type: 'NO',   device: 'T0', label: 'Timer done', color: 'cyan' },
        { type: 'COIL', device: 'Y0', label: 'Lamp',       color: 'orange' },
        { type: 'NC',   device: 'X0', label: 'X0 (NC)' },
        { type: 'NC',   device: 'T0', label: 'T0 (NC)' },
        { type: 'COIL', device: 'X0', label: 'X0 Coil (wrong)' }
      ],
      solution: { s1: 0, s2: 1, s3: 2 },
      rungs: [
        { template: { slot: 's1' },
          output: { kind: 'timer', device: 'T0', preset: 30, label: 'TIM K30 (3.0s)' }
        },
        { template: { slot: 's2' },
          output: { slot: 's3' }
        }
      ]
    },

    'counter-puzzle': {
      title: '🧩 Build the Rungs — Counter (นับ 5 ครั้ง)',
      prompt: 'สร้าง 2 Rung — Rung 1: <code>X0</code> ป้อนให้ <strong>Counter C0</strong> (preset 5) · Rung 2: ใช้ <code>C0</code> ขับ <code>Y0</code>',
      slots: [
        { id: 's1', hint: 'Pulse input ของ C0' },
        { id: 's2', hint: 'Counter Bit (C0)' },
        { id: 's3', hint: 'Output coil' }
      ],
      palette: [
        { type: 'NO',   device: 'X0', label: 'Count input', color: 'ok' },
        { type: 'NO',   device: 'C0', label: 'Counter done', color: 'cyan' },
        { type: 'COIL', device: 'Y0', label: 'Lamp',          color: 'orange' },
        { type: 'NC',   device: 'X0', label: 'X0 (NC)' },
        { type: 'NC',   device: 'C0', label: 'C0 (NC)' }
      ],
      solution: { s1: 0, s2: 1, s3: 2 },
      rungs: [
        { template: { slot: 's1' },
          output: { kind: 'counter', device: 'C0', preset: 5, label: 'CTU K5' }
        },
        { template: { slot: 's2' },
          output: { slot: 's3' }
        }
      ]
    },

    'star-delta-puzzle': {
      title: '🧩 The Big One — Star–Delta Motor Starter',
      prompt: 'ปริศนาประจำบทนี้ — สร้าง <strong>4 Rung</strong> ของ Star–Delta:<br>' +
              '· <strong>Y0 (Main)</strong>: Start หรือ Self-hold · ไม่มี Stop · OL OK<br>' +
              '· <strong>T0</strong>: นับเมื่อ Y0 ON (preset 5.0s)<br>' +
              '· <strong>Y1 (Star)</strong>: Y0 ON และ T0 ยังไม่ครบ<br>' +
              '· <strong>Y2 (Delta)</strong>: Y0 ON และ T0 ครบ และ Y1 ไม่ ON (interlock)',
      slots: [
        { id: 'a1', hint: 'Start' },
        { id: 'a2', hint: 'Self-hold (Y0)' },
        { id: 'a3', hint: 'Stop' },
        { id: 'a4', hint: 'OL OK' },
        { id: 'a5', hint: 'Y0 Main coil' },
        { id: 'b1', hint: 'Y0 trigger สำหรับ T0' },
        { id: 'c1', hint: 'Y0 (Star ต้องมี Y0 ON)' },
        { id: 'c2', hint: 'T0 (Star ต้อง T0 ยังไม่ครบ)' },
        { id: 'c3', hint: 'Y1 Star coil' },
        { id: 'd1', hint: 'Y0 (Delta ต้องมี Y0 ON)' },
        { id: 'd2', hint: 'T0 (Delta ต้อง T0 ครบแล้ว)' },
        { id: 'd3', hint: 'Y1 (Interlock: Star ไม่ ON)' },
        { id: 'd4', hint: 'Y2 Delta coil' }
      ],
      palette: [
        { type: 'NO',   device: 'X0', label: 'Start',  color: 'ok' },
        { type: 'NO',   device: 'Y0', label: 'Self-hold', color: 'cyan' },
        { type: 'NC',   device: 'X1', label: 'Stop',   color: 'danger' },
        { type: 'NO',   device: 'X2', label: 'OL OK',  color: 'warn' },
        { type: 'COIL', device: 'Y0', label: 'Main',   color: 'orange' },
        { type: 'NO',   device: 'Y0', label: 'Y0 ON',  color: 'cyan' },
        { type: 'NO',   device: 'Y0', label: 'Y0 ON',  color: 'cyan' },
        { type: 'NC',   device: 'T0', label: 'T0 ยังไม่ครบ', color: 'cyan' },
        { type: 'COIL', device: 'Y1', label: 'Star',   color: 'orange' },
        { type: 'NO',   device: 'Y0', label: 'Y0 ON',  color: 'cyan' },
        { type: 'NO',   device: 'T0', label: 'T0 ครบ', color: 'cyan' },
        { type: 'NC',   device: 'Y1', label: 'Y1 ไม่ ON (interlock)', color: 'cyan' },
        { type: 'COIL', device: 'Y2', label: 'Delta',  color: 'orange' },
        // Distractors
        { type: 'NC',   device: 'X0', label: 'Start (NC) wrong' },
        { type: 'NO',   device: 'X1', label: 'Stop (NO) wrong' },
        { type: 'NC',   device: 'X2', label: 'OL (NC) wrong' }
      ],
      // Note: palette has duplicate Y0/T0 NO blocks because the puzzle uses
      // them in multiple rungs. We allow each to be used once (separate copies).
      solution: { a1:0, a2:1, a3:2, a4:3, a5:4, b1:5, c1:6, c2:7, c3:8, d1:9, d2:10, d3:11, d4:12 },
      rungs: [
        // Rung 1: Y0 Main — (X0 OR Y0) AND NOT X1 AND X2 → Y0
        { template: { type:'and', children:[
            { type:'or', children:[{ slot:'a1' }, { slot:'a2' }] },
            { slot:'a3' }, { slot:'a4' }
          ]}, output:{ slot:'a5' } },
        // Rung 2: T0 — NO Y0 → T0
        { template: { slot:'b1' }, output:{ kind:'timer', device:'T0', preset:50, label:'TIM K50 (5.0s)' } },
        // Rung 3: Y1 Star — Y0 AND NOT T0 → Y1
        { template: { type:'and', children:[{ slot:'c1' }, { slot:'c2' }] },
          output:{ slot:'c3' } },
        // Rung 4: Y2 Delta — Y0 AND T0 AND NOT Y1 → Y2
        { template: { type:'and', children:[{ slot:'d1' }, { slot:'d2' }, { slot:'d3' }] },
          output:{ slot:'d4' } }
      ]
    }

  };

  // ---------- Syntax relabel ------------------------------------------------
  function relabel(name, syntax) {
    if (syntax !== 'omron') return name;
    var m = name.match(/^([XYM])(\d+)$/);
    if (m) {
      var letter = m[1], n = parseInt(m[2], 10);
      if (letter === 'X') return '0.0' + n;
      if (letter === 'Y') return '100.0' + n;
      if (letter === 'M') return 'W0.0' + n;
    }
    return name;
  }

  // ---------- DOM helpers ---------------------------------------------------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderBlockContent(block, syntax) {
    if (block.type === 'COIL') {
      return '<span class="rb-block-symbol">◯</span>' +
             '<span class="rb-block-bit">' + relabel(block.device, syntax) + '</span>' +
             '<span class="rb-block-meta">Coil · ' + escapeHtml(block.label) + '</span>';
    }
    var symbol = block.type === 'NO' ? '┤ ├' : '┤/├';
    var kindLabel = block.type === 'NO' ? 'NO' : 'NC';
    return '<span class="rb-block-symbol">' + symbol + '</span>' +
           '<span class="rb-block-bit">' + relabel(block.device, syntax) + '</span>' +
           '<span class="rb-block-meta">' + kindLabel + ' · ' + escapeHtml(block.label) + '</span>';
  }

  // ---------- One puzzle instance -------------------------------------------
  function buildPuzzle(root, puzzleName, syntax) {
    var pz = PUZZLES[puzzleName];
    if (!pz) { root.textContent = '[rung-builder: unknown puzzle "' + puzzleName + '"]'; return; }

    root.innerHTML = '';
    root.classList.add('rb');

    var placement = {};
    pz.slots.forEach(function (s) { placement[s.id] = null; });

    function isUsed(idx) {
      return Object.keys(placement).some(function (sid) { return placement[sid] === idx; });
    }

    var selectedPaletteIdx = null;

    // ---------- Header ------------------------------------------------------
    var head = el('div', 'rb-head');
    head.innerHTML =
      '<div class="rb-title">' + escapeHtml(pz.title) + '</div>' +
      '<div class="rb-prompt">' + pz.prompt + '</div>';
    root.appendChild(head);

    // ---------- Rungs panel ------------------------------------------------
    var rungsPanel = el('div', 'rb-panel rb-panel-rung');
    rungsPanel.innerHTML = '<div class="rb-panel-label">Rung ของคุณ</div>';

    var allSlotEls = [];

    function renderTemplateNode(node) {
      if (node.slot) {
        var slotDef = pz.slots.find(function (s) { return s.id === node.slot; });
        var slot = el('div', 'rb-slot');
        slot.dataset.slotId = node.slot;
        slot.innerHTML =
          '<div class="rb-slot-placeholder">+ วางบล็อก</div>' +
          (slotDef && slotDef.hint ? '<div class="rb-slot-hint">' + escapeHtml(slotDef.hint) + '</div>' : '');
        slot.addEventListener('dragover', function (e) {
          e.preventDefault();
          slot.classList.add('drag-over');
        });
        slot.addEventListener('dragleave', function () { slot.classList.remove('drag-over'); });
        slot.addEventListener('drop', function (e) {
          e.preventDefault();
          slot.classList.remove('drag-over');
          var idx = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(idx)) placeBlock(node.slot, idx);
        });
        slot.addEventListener('click', function () {
          if (selectedPaletteIdx !== null) {
            placeBlock(node.slot, selectedPaletteIdx);
          } else if (placement[node.slot] !== null) {
            unplaceBlock(node.slot);
          }
        });
        allSlotEls.push(slot);
        return slot;
      }
      if (node.type === 'and' || node.type === 'or') {
        var group = el('div', 'rb-group rb-' + node.type);
        node.children.forEach(function (child, i) {
          group.appendChild(renderTemplateNode(child));
          if (i < node.children.length - 1) {
            var op = el('div', 'rb-op-chip', node.type.toUpperCase());
            group.appendChild(op);
          }
        });
        return group;
      }
      return el('span');
    }

    function renderOutputNode(node) {
      // Either a slot (expects a COIL block) or a fixed timer/counter
      if (node.slot) {
        return renderTemplateNode({ slot: node.slot });
      }
      // Fixed timer/counter — render as a non-interactive block
      var box = el('div', 'rb-fixed-output');
      var deviceStr = relabel(node.device, syntax);
      var kindStr = node.kind === 'timer' ? 'TIM' : 'CTU';
      box.innerHTML =
        '<span class="rb-fixed-kind">' + kindStr + '</span>' +
        '<span class="rb-fixed-bit">' + deviceStr + '</span>' +
        '<span class="rb-fixed-meta">' + escapeHtml(node.label || (kindStr + ' K' + node.preset)) + '</span>';
      return box;
    }

    pz.rungs.forEach(function (rung, idx) {
      var label = el('div', 'rb-rung-label', 'Rung ' + (idx + 1));
      rungsPanel.appendChild(label);
      var row = el('div', 'rb-rung-row');
      row.appendChild(renderTemplateNode(rung.template));
      row.appendChild(el('div', 'rb-arrow', '<span>→</span>'));
      row.appendChild(renderOutputNode(rung.output));
      rungsPanel.appendChild(row);
    });

    root.appendChild(rungsPanel);

    // ---------- Palette ----------------------------------------------------
    var palPanel = el('div', 'rb-panel rb-panel-palette');
    palPanel.innerHTML = '<div class="rb-panel-label">📦 บล็อกที่มี — ลาก หรือ คลิกเลือก แล้ววางในช่อง</div>';
    var palGrid = el('div', 'rb-palette-grid');
    pz.palette.forEach(function (block, idx) {
      var btn = el('div', 'rb-block ' + (block.color || ''));
      btn.dataset.paletteIdx = String(idx);
      btn.setAttribute('draggable', 'true');
      btn.innerHTML = renderBlockContent(block, syntax);
      btn.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', String(idx));
        e.dataTransfer.effectAllowed = 'move';
        btn.classList.add('dragging');
      });
      btn.addEventListener('dragend', function () { btn.classList.remove('dragging'); });
      btn.addEventListener('click', function () {
        if (btn.classList.contains('used')) return;
        if (selectedPaletteIdx === idx) {
          selectedPaletteIdx = null;
          btn.classList.remove('selected');
        } else {
          selectedPaletteIdx = idx;
          palGrid.querySelectorAll('.rb-block').forEach(function (b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
        }
      });
      palGrid.appendChild(btn);
    });
    palPanel.appendChild(palGrid);
    root.appendChild(palPanel);

    // ---------- Actions ----------------------------------------------------
    var actions = el('div', 'rb-actions');
    var checkBtn = el('button', 'rb-check', 'ตรวจคำตอบ');
    var resetBtn = el('button', 'rb-reset', '↺ ล้าง');
    var feedback = el('div', 'rb-feedback');
    actions.appendChild(checkBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(feedback);
    root.appendChild(actions);

    function placeBlock(slotId, paletteIdx) {
      // Remove the same palette idx from any other slot
      Object.keys(placement).forEach(function (sid) {
        if (placement[sid] === paletteIdx) placement[sid] = null;
      });
      placement[slotId] = paletteIdx;
      selectedPaletteIdx = null;
      palGrid.querySelectorAll('.rb-block').forEach(function (b) { b.classList.remove('selected'); });
      feedback.className = 'rb-feedback';
      feedback.textContent = '';
      repaint();
    }
    function unplaceBlock(slotId) {
      placement[slotId] = null;
      feedback.className = 'rb-feedback';
      feedback.textContent = '';
      repaint();
    }

    function repaint() {
      allSlotEls.forEach(function (slot) {
        var sid = slot.dataset.slotId;
        var idx = placement[sid];
        // Always clear correct/wrong on repaint — they're re-applied by checkBtn.
        slot.classList.remove('correct', 'wrong');
        if (idx === null || idx === undefined) {
          slot.classList.remove('filled');
          var slotDef = pz.slots.find(function (s) { return s.id === sid; });
          slot.innerHTML =
            '<div class="rb-slot-placeholder">+ วางบล็อก</div>' +
            (slotDef && slotDef.hint ? '<div class="rb-slot-hint">' + escapeHtml(slotDef.hint) + '</div>' : '');
        } else {
          slot.classList.add('filled');
          var block = pz.palette[idx];
          slot.innerHTML =
            '<div class="rb-slot-content ' + (block.color || '') + '">' +
              renderBlockContent(block, syntax) +
              '<button type="button" class="rb-slot-x" title="เอาออก">×</button>' +
            '</div>';
          slot.querySelector('.rb-slot-x').addEventListener('click', function (e) {
            e.stopPropagation();
            unplaceBlock(sid);
          });
        }
      });
      palGrid.querySelectorAll('.rb-block').forEach(function (btn) {
        var idx = parseInt(btn.dataset.paletteIdx, 10);
        btn.classList.toggle('used', isUsed(idx));
      });
    }

    checkBtn.addEventListener('click', function () {
      var unfilled = pz.slots.filter(function (s) { return placement[s.id] === null; });
      if (unfilled.length > 0) {
        feedback.className = 'rb-feedback warn';
        feedback.textContent = '⚠️ ยังไม่ได้วางครบ — เหลือ ' + unfilled.length + ' ช่อง';
        return;
      }
      // Compare. Allow palette index swaps if (type, device) are identical
      // (since Star-Delta has duplicate Y0 NO contacts that students can interchange).
      var wrongSlots = [];
      pz.slots.forEach(function (s) {
        var got = pz.palette[placement[s.id]];
        var want = pz.palette[pz.solution[s.id]];
        if (got.type !== want.type || got.device !== want.device) {
          wrongSlots.push(s);
        }
      });
      if (wrongSlots.length === 0) {
        feedback.className = 'rb-feedback ok';
        feedback.innerHTML = '✓ <strong>ถูกต้อง!</strong> Rung นี้จะทำงานตามที่โจทย์ต้องการ — ลองเลื่อนไปดู Simulator ด้านล่างเพื่อทดสอบ';
        allSlotEls.forEach(function (slot) { slot.classList.add('correct'); });
      } else {
        feedback.className = 'rb-feedback err';
        var wrongNames = wrongSlots.map(function (s) { return s.hint || s.id; }).join(', ');
        feedback.innerHTML = '❌ ยังไม่ใช่ — ลองดูช่อง: <strong>' + escapeHtml(wrongNames) + '</strong>';
        allSlotEls.forEach(function (slot) {
          var sid = slot.dataset.slotId;
          var got = pz.palette[placement[sid]];
          var want = pz.palette[pz.solution[sid]];
          var ok = got && want && got.type === want.type && got.device === want.device;
          slot.classList.add(ok ? 'correct' : 'wrong');
        });
      }
    });

    resetBtn.addEventListener('click', function () {
      pz.slots.forEach(function (s) { placement[s.id] = null; });
      selectedPaletteIdx = null;
      feedback.className = 'rb-feedback';
      feedback.textContent = '';
      allSlotEls.forEach(function (slot) {
        slot.classList.remove('correct', 'wrong');
      });
      repaint();
    });

    repaint();
  }

  // ---------- Init -----------------------------------------------------------
  function init() {
    document.querySelectorAll('.rung-builder').forEach(function (el) {
      var name = el.getAttribute('data-puzzle');
      var syntax = el.getAttribute('data-syntax') || 'mit';
      buildPuzzle(el, name, syntax);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
