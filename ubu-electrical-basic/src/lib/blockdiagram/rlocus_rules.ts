// Root-locus textbook rules, modelled after Erik Cheever's RLocusGui (Swarthmore, 2007).
// Each rule is a pure function: given the open-loop transfer function H(s), produce
// a Thai-flavoured prose description + a set of overlay marks to draw on the locus
// plot. Selected rule's overlays render on top of the locus trail in RootLocusPlot.

import type { Poly, Rat } from '../analyze/poly';
import { addP, mulP, scaleP } from '../analyze/poly';
import { findRoots, type CRoot } from '../analyze/roots';
import { formatPoly } from './sympoly';

/** d/ds of an ascending-degree polynomial. */
function derivP(p: Poly): Poly {
  if (p.length <= 1) return [0];
  const out: Poly = new Array(p.length - 1).fill(0);
  for (let i = 1; i < p.length; i++) out[i - 1] = p[i] * i;
  return out;
}

/** Evaluate p(s) for real s. */
function evalReal(p: Poly, s: number): number {
  let out = 0;
  let pow = 1;
  for (let i = 0; i < p.length; i++) { out += p[i] * pow; pow *= s; }
  return out;
}

// ─── Overlay primitives ────────────────────────────────────────────────

export type Overlay =
  | { kind: 'realSegment'; from: number; to: number; color?: string }
  | { kind: 'asymptoteRay'; cx: number; cy: number; angleDeg: number; color?: string }
  | { kind: 'centroid'; re: number; color?: string; label?: string }
  | { kind: 'point'; re: number; im: number; color?: string; label?: string; shape?: 'dot' | 'cross' | 'circle' }
  | { kind: 'imagCross'; im: number; color?: string; label?: string }
  | { kind: 'annotation'; re: number; im: number; text: string; color?: string };

// ─── Rule descriptor + result ──────────────────────────────────────────

export interface RuleResult {
  description: string[];
  overlays: Overlay[];
}

export interface Rule {
  id: string;
  name: string;        // English (technical)
  nameTh: string;      // Thai
  compute(H: Rat): RuleResult;
}

// ─── Rules ─────────────────────────────────────────────────────────────

const ruleInfo: Rule = {
  id: 'info',
  name: 'Info',
  nameTh: 'ข้อมูลระบบ',
  compute(H) {
    const poles = findRoots(H.d);
    const zeros = findRoots(H.n);
    const description = [
      `Open-loop transfer function:`,
      `  H(s) = (${formatPoly(H.n)}) / (${formatPoly(H.d)})`,
      ``,
      `จำนวน open-loop poles (n) = ${poles.length}`,
      `จำนวน open-loop zeros (m) = ${zeros.length}`,
    ];
    if (poles.length > 0) {
      description.push(``, `Poles:`);
      for (const p of poles) description.push(`  s = ${fmtComplex(p)}`);
    }
    if (zeros.length > 0) {
      description.push(``, `Zeros:`);
      for (const z of zeros) description.push(`  s = ${fmtComplex(z)}`);
    }
    const overlays: Overlay[] = [];
    for (const p of poles) overlays.push({ kind: 'point', re: p.re, im: p.im, color: '#dc2626', shape: 'cross' });
    for (const z of zeros) overlays.push({ kind: 'point', re: z.re, im: z.im, color: '#059669', shape: 'circle' });
    return { description, overlays };
  },
};

const ruleSymmetry: Rule = {
  id: 'symmetry',
  name: 'Symmetry',
  nameTh: 'ความสมมาตร',
  compute(H) {
    const poles = findRoots(H.d);
    const zeros = findRoots(H.n);
    const hasComplex = [...poles, ...zeros].some((p) => Math.abs(p.im) > 1e-9);
    const description = [
      `Root locus มี symmetry รอบ real axis เสมอ`,
      ``,
      `เหตุผล: H(s) มี coefficient เป็นจำนวนจริงทั้งหมด ดังนั้น`,
      `closed-loop characteristic polynomial 1 + K·H(s) = 0 ก็มี coefficient`,
      `จำนวนจริงด้วย → complex roots ของมันต้องมาเป็นคู่ conjugate เสมอ`,
      ``,
      hasComplex
        ? `วงจรนี้มี complex pole/zero แล้ว — สังเกตว่า locus ทุกจุดจะมี mirror อยู่ครึ่งล่าง`
        : `วงจรนี้ poles + zeros อยู่บน real axis ทั้งหมด → ส่วนใหญ่ locus จะอยู่บนแกนจริง (ดู rule "Real-axis segments")`,
    ];
    return { description, overlays: [] };
  },
};

const ruleBranches: Rule = {
  id: 'branches',
  name: 'Number of branches',
  nameTh: 'จำนวน branch',
  compute(H) {
    const poles = findRoots(H.d);
    const zeros = findRoots(H.n);
    const n = poles.length;
    const m = zeros.length;
    const description = [
      `จำนวน branch ของ root locus = max(n, m) = ${Math.max(n, m)}`,
      `(โดยทั่วไป n ≥ m สำหรับระบบ proper → จำนวน branch = n = ${n})`,
      ``,
      `• ${n} branch เริ่มต้นที่ open-loop poles (เมื่อ K → 0)`,
      m > 0 ? `• ${m} branch จบที่ open-loop zeros (เมื่อ K → ∞)` : `• ไม่มี zero — ทุก branch จบที่ ∞`,
      n > m ? `• อีก ${n - m} branch จบที่ ∞ ตาม asymptote` : ``,
    ].filter(Boolean);
    return { description, overlays: [] };
  },
};

const ruleStartEnd: Rule = {
  id: 'startEnd',
  name: 'Start / End points',
  nameTh: 'จุดเริ่มและจุดจบ',
  compute(H) {
    const poles = findRoots(H.d);
    const zeros = findRoots(H.n);
    const description = [
      `เริ่ม (K = 0): branches เริ่มจาก open-loop poles`,
      ...poles.map((p, i) => `  branch ${i + 1}: s = ${fmtComplex(p)}`),
      ``,
      `จบ (K → ∞): branches จบที่ open-loop zeros หรือ ∞`,
    ];
    if (zeros.length > 0) {
      description.push(...zeros.map((z, i) => `  zero ${i + 1}: s = ${fmtComplex(z)}`));
    }
    const extraToInfinity = poles.length - zeros.length;
    if (extraToInfinity > 0) {
      description.push(`  อีก ${extraToInfinity} branch จะไปยัง ∞ ตาม asymptote (ดู rule ถัดไป)`);
    }
    const overlays: Overlay[] = [
      ...poles.map<Overlay>((p) => ({ kind: 'point', re: p.re, im: p.im, color: '#dc2626', shape: 'cross', label: 'start' })),
      ...zeros.map<Overlay>((z) => ({ kind: 'point', re: z.re, im: z.im, color: '#059669', shape: 'circle', label: 'end' })),
    ];
    return { description, overlays };
  },
};

const ruleRealAxis: Rule = {
  id: 'realAxis',
  name: 'Real-axis segments',
  nameTh: 'ส่วนบนแกนจริง',
  compute(H) {
    const poles = findRoots(H.d);
    const zeros = findRoots(H.n);
    // Only real poles/zeros divide the real axis into segments. Complex ones don't.
    const realPoints = [
      ...poles.filter((p) => Math.abs(p.im) < 1e-9).map((p) => p.re),
      ...zeros.filter((z) => Math.abs(z.im) < 1e-9).map((z) => z.re),
    ].sort((a, b) => a - b);
    if (realPoints.length === 0) {
      return {
        description: [`ไม่มี real pole/zero เลย → ไม่มี real-axis segment`],
        overlays: [],
      };
    }
    // Rule: locus on real axis to the LEFT of an ODD total of real poles+zeros.
    // Walk from +∞ leftward; count real points strictly to the RIGHT of cursor;
    // if odd → segment lies between this point and the next point to the LEFT.
    const segments: Array<{ from: number; to: number }> = [];
    // Walk between consecutive markers; count markers strictly to the right.
    // For markers length n, candidate intervals are:
    //   (markers[n-1], +∞) — never on locus (count = 0 = even)
    //   (markers[i-1], markers[i])  for i = n-1 .. 1
    //   (-∞, markers[0])            for i = 0
    // So loop i from n-1 down to 0, inclusive.
    const markers = [...realPoints];
    for (let i = markers.length - 1; i >= 0; i--) {
      const rightX = markers[i];
      const leftX = i - 1 >= 0 ? markers[i - 1] : -Infinity;
      const mid = Number.isFinite(leftX) ? (rightX + leftX) / 2 : rightX - 1;
      const countToRight = markers.filter((x) => x > mid).length;
      if (countToRight % 2 === 1) {
        segments.push({ from: leftX, to: rightX });
      }
    }
    const description = [
      `กฎ: locus อยู่บน real axis ในส่วนที่อยู่ทางซ้ายของจำนวน real pole + zero ที่เป็น ODD`,
      ``,
      `Real poles: ${poles.filter((p) => Math.abs(p.im) < 1e-9).map((p) => p.re.toFixed(3)).join(', ') || '(ไม่มี)'}`,
      `Real zeros: ${zeros.filter((z) => Math.abs(z.im) < 1e-9).map((z) => z.re.toFixed(3)).join(', ') || '(ไม่มี)'}`,
      ``,
      `Real-axis segments ที่อยู่บน locus:`,
      ...segments.map((s) => {
        const from = Number.isFinite(s.from) ? s.from.toFixed(3) : '−∞';
        const to = Number.isFinite(s.to) ? s.to.toFixed(3) : '+∞';
        return `  [${from}, ${to}]`;
      }),
    ];
    const overlays: Overlay[] = segments.map<Overlay>((s) => ({
      kind: 'realSegment',
      from: Number.isFinite(s.from) ? s.from : -1e6,
      to: Number.isFinite(s.to) ? s.to : 1e6,
      color: '#f59e0b',
    }));
    return { description, overlays };
  },
};

const ruleAsymptotes: Rule = {
  id: 'asymptotes',
  name: 'Asymptotes',
  nameTh: 'Asymptote',
  compute(H) {
    const poles = findRoots(H.d);
    const zeros = findRoots(H.n);
    const n = poles.length;
    const m = zeros.length;
    const k = n - m;
    if (k <= 0) {
      return {
        description: [`n − m = ${k} → ไม่มี asymptote (locus จบที่ zero ทั้งหมด)`],
        overlays: [],
      };
    }
    // Angles (degrees): (2q+1)·180 / (n-m) for q = 0..k-1
    const angles: number[] = [];
    for (let q = 0; q < k; q++) angles.push(((2 * q + 1) * 180) / k);
    // Centroid (intersection of asymptotes on real axis): (Σpoles − Σzeros) / (n−m)
    const sumPoles = poles.reduce((s, p) => s + p.re, 0);
    const sumZeros = zeros.reduce((s, z) => s + z.re, 0);
    const centroid = (sumPoles - sumZeros) / k;
    const description = [
      `n − m = ${n} − ${m} = ${k} → มี ${k} asymptote ที่ไปยัง ∞`,
      ``,
      `Asymptote angles (จากจุด centroid σ):`,
      ...angles.map((a) => `  ${a.toFixed(1)}°`),
      ``,
      `Centroid σ = (Σpoles − Σzeros) / (n − m)`,
      `  = (${sumPoles.toFixed(3)} − ${sumZeros.toFixed(3)}) / ${k}`,
      `  = ${centroid.toFixed(3)}`,
    ];
    const overlays: Overlay[] = [
      { kind: 'centroid', re: centroid, color: '#0ea5e9', label: `σ = ${centroid.toFixed(2)}` },
      ...angles.map<Overlay>((a) => ({ kind: 'asymptoteRay', cx: centroid, cy: 0, angleDeg: a, color: '#0ea5e9' })),
    ];
    return { description, overlays };
  },
};

const ruleBreakInOut: Rule = {
  id: 'breakInOut',
  name: 'Break-out / Break-in',
  nameTh: 'จุดออก / จุดเข้าแกนจริง',
  compute(H) {
    // Break points are real roots of D'·N − D·N' = 0 that lie ON the locus
    // and give a real, non-negative K (= −D(s)/N(s)).
    const N = H.n;
    const D = H.d;
    const Np = derivP(N);
    const Dp = derivP(D);
    // q(s) = D'·N − D·N'
    const q = addP(mulP(Dp, N), scaleP(mulP(D, Np), -1));
    const roots = findRoots(q);
    // Keep only real roots.
    const realRoots = roots.filter((r) => Math.abs(r.im) < 1e-6).map((r) => r.re);

    // Determine which real roots are on the locus: K(s) = −D(s)/N(s) must be ≥ 0.
    const poles = findRoots(H.d);
    const zeros = findRoots(H.n);
    const realPoints = [
      ...poles.filter((p) => Math.abs(p.im) < 1e-9).map((p) => p.re),
      ...zeros.filter((z) => Math.abs(z.im) < 1e-9).map((z) => z.re),
    ];
    const onLocus = (s: number): boolean => {
      // Locus on real axis = strictly to the LEFT of an odd # of real poles+zeros.
      // Allow tolerance so the break-point itself (where it sits at a marker) is OK.
      const countToRight = realPoints.filter((x) => x > s + 1e-9).length;
      return countToRight % 2 === 1;
    };

    const breakPoints = realRoots
      .map((s) => {
        const Ns = evalReal(N, s);
        const Ds = evalReal(D, s);
        if (Math.abs(Ns) < 1e-12) return null; // K undefined here
        const K = -Ds / Ns;
        const kind = K >= 0 ? (onLocus(s) ? 'on-locus' : 'off-locus') : 'negative-K';
        return { s, K, kind };
      })
      .filter((r): r is { s: number; K: number; kind: string } => r !== null);

    const valid = breakPoints.filter((b) => b.kind === 'on-locus');
    const description: string[] = [
      `Break point เกิดที่จุดที่ K(s) = −D(s)/N(s) มี local extremum`,
      `→ หา root จริงของสมการ D'(s)·N(s) − D(s)·N'(s) = 0`,
      `แล้วเก็บเฉพาะ root ที่อยู่บน locus (K ≥ 0 และอยู่บน real-axis segment)`,
      ``,
    ];
    if (q.length <= 1) {
      description.push('D'.length === 0 ? 'ไม่มี polynomial ที่จะหา derivative' : `q(s) = ${formatPoly(q)} → ไม่มีผลเฉลย`);
    } else {
      description.push(`q(s) = D'(s)·N(s) − D(s)·N'(s)`, `     = ${formatPoly(q)}`);
    }
    description.push(``);
    if (breakPoints.length === 0) {
      description.push(`ไม่พบ real root ของ q(s) → ไม่มี break point`);
    } else {
      description.push(`Real roots ของ q(s):`);
      for (const b of breakPoints) {
        const note = b.kind === 'on-locus'
          ? `K = ${b.K.toFixed(3)}  ✓ บน locus`
          : b.kind === 'off-locus'
            ? `K = ${b.K.toFixed(3)}  (ไม่อยู่บน locus segment)`
            : `K = ${b.K.toFixed(3)}  (K < 0 — ตัดทิ้ง)`;
        description.push(`  s = ${b.s.toFixed(3)},  ${note}`);
      }
    }

    const overlays: Overlay[] = valid.map<Overlay>((b) => ({
      kind: 'point',
      re: b.s,
      im: 0,
      color: '#9333ea',
      shape: 'dot',
      label: `K=${b.K.toFixed(2)}`,
    }));
    return { description, overlays };
  },
};

const ruleImagCross: Rule = {
  id: 'imagCross',
  name: 'Imaginary-axis crossings',
  nameTh: 'จุดตัดแกนจินตภาพ',
  compute(H) {
    // Substitute s = jω into 1 + K·H(jω) = 0. Real and imaginary parts → two
    // equations in (K, ω). For numerical robustness, scan the closed-loop pole
    // trail across K and detect sign changes in Re(pole) → these are crossings.
    const N = H.n;
    const D = H.d;
    const STEPS = 240;
    const Kmin = 1e-3, Kmax = 1e3;
    // Get poles at K=K_i for each step; for each pole branch, watch Re(pole)
    // crossing zero. When it crosses, interpolate K and read ω.
    let prevPoles: CRoot[] | null = null;
    let prevK = 0;
    const crossings: Array<{ K: number; omega: number }> = [];

    for (let i = 0; i < STEPS; i++) {
      const t = i / (STEPS - 1);
      const K = Math.pow(10, Math.log10(Kmin) + t * (Math.log10(Kmax) - Math.log10(Kmin)));
      const charPoly = addP(D, scaleP(N, K));
      const poles = findRoots(charPoly);
      if (prevPoles && prevPoles.length === poles.length) {
        // Naïve match: assume order is consistent (Durand-Kerner generally returns
        // similar order between nearby K). For each branch, detect sign change.
        for (let j = 0; j < poles.length; j++) {
          const prev = prevPoles[j], cur = poles[j];
          if (prev.re * cur.re < 0 && Math.abs(cur.im) > 1e-6) {
            // Linear interpolate to estimate crossing K and ω.
            const frac = Math.abs(prev.re) / (Math.abs(prev.re) + Math.abs(cur.re));
            const Kx = prevK + frac * (K - prevK);
            const omega = prev.im + frac * (cur.im - prev.im);
            crossings.push({ K: Kx, omega });
          }
        }
      }
      prevPoles = poles;
      prevK = K;
    }

    // Deduplicate crossings that are very close (different branches at the same point).
    crossings.sort((a, b) => a.omega - b.omega);
    const dedup: typeof crossings = [];
    for (const c of crossings) {
      if (dedup.length === 0 || Math.abs(dedup[dedup.length - 1].omega - c.omega) > 0.05) {
        dedup.push(c);
      }
    }

    const description: string[] = [
      `Locus ตัดแกนจินตภาพที่ s = jω → คือจุดที่ระบบเริ่ม unstable`,
      `วิธีหา: substitute s = jω ใน 1 + K·H(s) = 0 แยก Re กับ Im ให้เท่ากับ 0`,
      `(หรือใช้ Routh-Hurwitz หาขอบเขต K)`,
      ``,
    ];
    if (dedup.length === 0) {
      description.push(`ไม่พบจุดตัดแกนจินตภาพในช่วง K ∈ [${Kmin}, ${Kmax}] → ระบบ stable ตลอด range`);
    } else {
      description.push(`พบ ${dedup.length} จุดตัด:`);
      for (const c of dedup) {
        description.push(`  ω = ${c.omega.toFixed(3)} rad/s  ที่ K ≈ ${c.K.toFixed(3)}`);
      }
      description.push(``, `K_critical ที่เล็กที่สุด ≈ ${Math.min(...dedup.map((c) => c.K)).toFixed(3)} → ระบบจะ unstable เมื่อ K มากกว่าค่านี้`);
    }
    const overlays: Overlay[] = dedup.map<Overlay>((c) => ({
      kind: 'imagCross',
      im: c.omega,
      label: `K=${c.K.toFixed(2)}`,
    }));
    return { description, overlays };
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────

function fmtComplex(c: CRoot): string {
  if (Math.abs(c.im) < 1e-9) return c.re.toFixed(3);
  const sign = c.im >= 0 ? '+' : '−';
  return `${c.re.toFixed(3)} ${sign} ${Math.abs(c.im).toFixed(3)}j`;
}

// ─── Registry ──────────────────────────────────────────────────────────

export const RLOCUS_RULES: Rule[] = [
  ruleInfo,
  ruleSymmetry,
  ruleBranches,
  ruleStartEnd,
  ruleRealAxis,
  ruleAsymptotes,
  ruleBreakInOut,
  ruleImagCross,
];
