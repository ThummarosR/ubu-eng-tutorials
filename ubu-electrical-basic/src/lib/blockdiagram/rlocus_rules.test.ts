import { describe, it, expect } from 'vitest';
import { RLOCUS_RULES, type Rule } from './rlocus_rules';

const ruleById = (id: string): Rule => {
  const r = RLOCUS_RULES.find((x) => x.id === id);
  if (!r) throw new Error(`no rule "${id}"`);
  return r;
};

// Helpers — build H(s) = N/D from coefficient arrays.
const H = (n: number[], d: number[]) => ({ n, d });

// Standard textbook example:
//   H(s) = 1 / [s(s+1)(s+2)] = 1 / (s³ + 3s² + 2s)
// Coefficients ascending: n = [1], d = [0, 2, 3, 1]
const TYPE1_3RD = H([1], [0, 2, 3, 1]);

// First-order: H(s) = 1/(s+1) ⇒ n=[1], d=[1,1]
const FIRST_ORDER = H([1], [1, 1]);

describe('Info rule', () => {
  it('reports pole/zero counts and listing for type-1 3rd-order plant', () => {
    const r = ruleById('info').compute(TYPE1_3RD);
    // 3 open-loop poles at 0, -1, -2; 0 zeros
    expect(r.description.some((s) => s.includes('n) = 3'))).toBe(true);
    expect(r.description.some((s) => s.includes('m) = 0'))).toBe(true);
    // Overlay points: 3 cross markers, no circles
    const crosses = r.overlays.filter((o) => o.kind === 'point' && o.shape === 'cross');
    expect(crosses).toHaveLength(3);
  });
});

describe('Branches rule', () => {
  it('first-order plant: 1 branch', () => {
    const r = ruleById('branches').compute(FIRST_ORDER);
    expect(r.description.some((s) => s.includes('= 1'))).toBe(true);
  });

  it('3rd-order plant: 3 branches, all to ∞', () => {
    const r = ruleById('branches').compute(TYPE1_3RD);
    expect(r.description.some((s) => s.includes('= 3'))).toBe(true);
    expect(r.description.some((s) => s.includes('∞'))).toBe(true);
  });
});

describe('Real-axis segments rule', () => {
  it('1/[s(s+1)(s+2)]: locus on (−∞,−2] and [−1, 0]', () => {
    const r = ruleById('realAxis').compute(TYPE1_3RD);
    const segments = r.overlays.filter((o) => o.kind === 'realSegment');
    // Expect 2 segments — sorted markers are [-2, -1, 0]:
    // - Between -1 and 0 → countToRight = 1 (odd) → segment
    // - Between -2 and -1 → countToRight = 2 (even) → no segment
    // - Left of -2 → countToRight = 3 (odd) → segment
    expect(segments).toHaveLength(2);
    // The segment between markers contains [-1, 0].
    const finiteSeg = segments.find((s) => s.kind === 'realSegment' && s.from > -10 && s.to < 10);
    expect(finiteSeg).toBeDefined();
    if (finiteSeg && finiteSeg.kind === 'realSegment') {
      expect(finiteSeg.from).toBeCloseTo(-1, 3);
      expect(finiteSeg.to).toBeCloseTo(0, 3);
    }
  });

  it('no real poles/zeros → no segments', () => {
    // H(s) = 1/(s² + 1) — purely imaginary poles
    const r = ruleById('realAxis').compute(H([1], [1, 0, 1]));
    const segments = r.overlays.filter((o) => o.kind === 'realSegment');
    expect(segments).toHaveLength(0);
  });
});

describe('Asymptotes rule', () => {
  it('1/[s(s+1)(s+2)]: 3 asymptotes at 60°, 180°, 300°, centroid = −1', () => {
    const r = ruleById('asymptotes').compute(TYPE1_3RD);
    // n - m = 3 asymptotes
    const rays = r.overlays.filter((o) => o.kind === 'asymptoteRay');
    expect(rays).toHaveLength(3);
    // Angles: (2q+1)·180/3 for q=0,1,2 = 60, 180, 300
    const angles = rays.map((o) => o.kind === 'asymptoteRay' ? o.angleDeg : 0).sort((a, b) => a - b);
    expect(angles[0]).toBeCloseTo(60);
    expect(angles[1]).toBeCloseTo(180);
    expect(angles[2]).toBeCloseTo(300);
    // Centroid σ = (0 + (-1) + (-2) - 0) / 3 = -1
    const centroid = r.overlays.find((o) => o.kind === 'centroid');
    expect(centroid).toBeDefined();
    if (centroid && centroid.kind === 'centroid') {
      expect(centroid.re).toBeCloseTo(-1, 5);
    }
  });

  it('1/(s+1): no asymptotes (n − m = 1 → 1 asymptote at 180°)', () => {
    const r = ruleById('asymptotes').compute(FIRST_ORDER);
    const rays = r.overlays.filter((o) => o.kind === 'asymptoteRay');
    expect(rays).toHaveLength(1);
    if (rays[0].kind === 'asymptoteRay') {
      expect(rays[0].angleDeg).toBeCloseTo(180);
    }
  });

  it('H(s) = (s+1)/(s+2)·(s+3): n=m → no asymptotes (k=0 case)', () => {
    // n=[1,1] (s+1), d=[6,5,1] (s+2)(s+3) → m=1, n=2 → wait that's still asymptote
    // Use: n=[1,1], d=[1,1] → n=m=1. d/n = 1 (degenerate).
    // Better: use n=[2,1,1] over d=[6,5,1] where deg = deg.
    const r = ruleById('asymptotes').compute(H([2, 1, 1], [6, 5, 1]));
    const rays = r.overlays.filter((o) => o.kind === 'asymptoteRay');
    expect(rays).toHaveLength(0);
  });
});

describe('Break-in/Break-out rule', () => {
  it('1/[s(s+2)]: breakaway at s = −1, K = 1', () => {
    // H(s) = 1 / (s² + 2s), N=[1], D=[0,2,1]
    // K(s) = -D/N = -(s² + 2s) = -s² - 2s. dK/ds = -2s - 2 = 0 → s = -1.
    // K(-1) = -(1 - 2) = 1. Real-axis segment is between [-2, 0] (odd count to right).
    const r = ruleById('breakInOut').compute(H([1], [0, 2, 1]));
    const points = r.overlays.filter((o) => o.kind === 'point' && o.color === '#9333ea');
    expect(points).toHaveLength(1);
    if (points[0].kind === 'point') {
      expect(points[0].re).toBeCloseTo(-1, 3);
      expect(points[0].im).toBeCloseTo(0, 5);
    }
  });

  it('1/(s+1): no break points (no real-axis segment between two poles)', () => {
    const r = ruleById('breakInOut').compute(FIRST_ORDER);
    const points = r.overlays.filter((o) => o.kind === 'point' && o.color === '#9333ea');
    expect(points).toHaveLength(0);
  });
});

describe('Imaginary-axis crossings rule', () => {
  it('1/[s(s+1)(s+2)]: crossing at ω = √2 ≈ 1.414, K = 6', () => {
    // Classical textbook example: Routh gives K_crit = 6 at ω = √2.
    const r = ruleById('imagCross').compute(TYPE1_3RD);
    const crossings = r.overlays.filter((o) => o.kind === 'imagCross');
    expect(crossings.length).toBeGreaterThanOrEqual(2); // ±ω

    // Find the positive-ω crossing.
    const pos = crossings
      .filter((o) => o.kind === 'imagCross' && o.im > 0)
      .map((o) => (o.kind === 'imagCross' ? o : null))
      .filter((o): o is NonNullable<typeof o> => o !== null);
    expect(pos.length).toBeGreaterThan(0);
    expect(pos[0].im).toBeCloseTo(Math.sqrt(2), 1);  // wide tolerance — numerical sweep
    // K from the label string "K=6.00"
    const kMatch = /K=([\d.]+)/.exec(pos[0].label ?? '');
    expect(kMatch).toBeTruthy();
    if (kMatch) {
      expect(parseFloat(kMatch[1])).toBeCloseTo(6, 0);
    }
  });

  it('1/(s+1): always stable, no crossings', () => {
    const r = ruleById('imagCross').compute(FIRST_ORDER);
    const crossings = r.overlays.filter((o) => o.kind === 'imagCross');
    expect(crossings).toHaveLength(0);
  });
});
