/**
 * Statistical tests for AYTM Research Pipeline
 * Pure TypeScript implementations — no external dependencies
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Assign ranks with average tie-breaking.
 * Returns an array of ranks (1-based) corresponding to each element.
 */
export function ranks(data: number[]): number[] {
  const indexed = data.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const result = new Array<number>(data.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    // find block of ties
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    // average rank for the tie block (ranks are 1-based)
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      result[indexed[k].i] = avgRank;
    }
    i = j;
  }
  return result;
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Max error ~7.5e-8.
 */
export function normalCDF(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;

  const negative = z < 0;
  if (negative) z = -z;

  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  const t = 1 / (1 + p * z);
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
  let cdf = 1 - pdf * poly;

  if (negative) cdf = 1 - cdf;
  return cdf;
}

/**
 * Upper-tail p-value for the chi-squared distribution.
 * Uses the regularized incomplete gamma function via series expansion.
 */
export function chiSquaredSurvival(x: number, df: number): number {
  if (x <= 0) return 1;
  if (df <= 0) return 0;

  // P(X <= x) = regularized lower incomplete gamma: gammaP(df/2, x/2)
  // Survival = 1 - gammaP(df/2, x/2)
  const a = df / 2;
  const z = x / 2;

  // For large z relative to a, use the continued fraction (upper gamma)
  // For small z, use the series expansion (lower gamma)
  if (z < a + 1) {
    // Series expansion for lower incomplete gamma
    return 1 - gammaPSeries(a, z);
  } else {
    // Continued fraction for upper incomplete gamma
    return gammaQCF(a, z);
  }
}

/** Lower regularized gamma via series expansion */
function gammaPSeries(a: number, z: number): number {
  const lnGammaA = lnGamma(a);
  let sum = 1 / a;
  let term = 1 / a;
  for (let n = 1; n < 200; n++) {
    term *= z / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-z + a * Math.log(z) - lnGammaA);
}

/** Upper regularized gamma via continued fraction (Lentz's method) */
function gammaQCF(a: number, z: number): number {
  const lnGammaA = lnGamma(a);
  const TINY = 1e-30;

  let f = TINY;
  let C = TINY;
  let D = 1 / (z + 1 - a);
  f = D;

  for (let n = 1; n < 200; n++) {
    const an = n * (a - n);
    const bn = z + 2 * n + 1 - a;
    D = bn + an * D;
    if (Math.abs(D) < TINY) D = TINY;
    C = bn + an / C;
    if (Math.abs(C) < TINY) C = TINY;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }

  return f * Math.exp(-z + a * Math.log(z) - lnGammaA);
}

/** Log-gamma via Lanczos approximation */
function lnGamma(x: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    // Reflection formula
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }

  x -= 1;
  let a = coef[0];
  const t = x + g + 0.5;
  for (let i = 1; i < coef.length; i++) {
    a += coef[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ─── Statistical Tests ─────────────────────────────────────────────────────

/**
 * Mann-Whitney U test (two-sided).
 * Non-parametric test for comparing two independent samples.
 */
export function mannWhitneyU(
  x: number[],
  y: number[]
): { U: number; p: number; effectSize: number } {
  const n1 = x.length;
  const n2 = y.length;

  if (n1 === 0 || n2 === 0) {
    return { U: 0, p: 1, effectSize: 0 };
  }

  // Combine and rank
  const combined = [
    ...x.map((v) => ({ v, group: 0 })),
    ...y.map((v) => ({ v, group: 1 })),
  ];
  const values = combined.map((c) => c.v);
  const r = ranks(values);

  // Sum of ranks for group 1 (x)
  let R1 = 0;
  for (let i = 0; i < combined.length; i++) {
    if (combined[i].group === 0) R1 += r[i];
  }

  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Normal approximation for p-value
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = sigma > 0 ? (U1 - mu) / sigma : 0;
  const p = 2 * (1 - normalCDF(Math.abs(z)));

  // Rank-biserial effect size
  const effectSize = 1 - (2 * U) / (n1 * n2);

  return { U, p, effectSize };
}

/**
 * Kruskal-Wallis H test.
 * Non-parametric one-way ANOVA on ranks for k independent samples.
 */
export function kruskalWallisH(
  groups: number[][]
): { H: number; p: number; epsilonSq: number } {
  const k = groups.length;
  if (k < 2) return { H: 0, p: 1, epsilonSq: 0 };

  // Combine all values and assign ranks
  const allValues: number[] = [];
  const groupIndices: number[] = [];
  for (let g = 0; g < k; g++) {
    for (const v of groups[g]) {
      allValues.push(v);
      groupIndices.push(g);
    }
  }

  const n = allValues.length;
  if (n < 2) return { H: 0, p: 1, epsilonSq: 0 };

  const r = ranks(allValues);

  // Sum of ranks per group
  const groupRankSums = new Array<number>(k).fill(0);
  const groupSizes = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    groupRankSums[groupIndices[i]] += r[i];
    groupSizes[groupIndices[i]]++;
  }

  // H statistic
  let sumTerm = 0;
  for (let g = 0; g < k; g++) {
    if (groupSizes[g] > 0) {
      sumTerm += (groupRankSums[g] ** 2) / groupSizes[g];
    }
  }

  const H = ((12 / (n * (n + 1))) * sumTerm) - 3 * (n + 1);

  // p-value from chi-squared distribution with k-1 degrees of freedom
  const df = k - 1;
  const p = chiSquaredSurvival(H, df);

  // Epsilon-squared effect size
  const epsilonSq = H / (n - 1);

  return { H, p, epsilonSq };
}

/**
 * Bootstrap confidence interval using the percentile method.
 */
export function bootstrapCI(
  data: number[],
  statFn: (d: number[]) => number,
  options?: { nBoot?: number; alpha?: number }
): { lower: number; upper: number; point: number } {
  const nBoot = options?.nBoot ?? 1000;
  const alpha = options?.alpha ?? 0.05;
  const n = data.length;

  if (n === 0) return { lower: NaN, upper: NaN, point: NaN };

  const point = statFn(data);

  // Seeded PRNG (simple LCG) for reproducibility within a call
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const bootstrapStats: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    const sample: number[] = [];
    for (let i = 0; i < n; i++) {
      sample.push(data[Math.floor(rand() * n)]);
    }
    bootstrapStats.push(statFn(sample));
  }

  bootstrapStats.sort((a, b) => a - b);

  const lowerIdx = Math.floor((alpha / 2) * nBoot);
  const upperIdx = Math.floor((1 - alpha / 2) * nBoot) - 1;

  return {
    lower: bootstrapStats[Math.max(0, lowerIdx)],
    upper: bootstrapStats[Math.min(nBoot - 1, upperIdx)],
    point,
  };
}

/**
 * Two-sample Kolmogorov-Smirnov test.
 */
export function kolmogorovSmirnovTest(
  x: number[],
  y: number[]
): { D: number; p: number } {
  const n1 = x.length;
  const n2 = y.length;

  if (n1 === 0 || n2 === 0) return { D: 0, p: 1 };

  const xSorted = [...x].sort((a, b) => a - b);
  const ySorted = [...y].sort((a, b) => a - b);

  // Merge all unique values and compute empirical CDFs
  let i = 0;
  let j = 0;
  let D = 0;

  while (i < n1 || j < n2) {
    const xVal = i < n1 ? xSorted[i] : Infinity;
    const yVal = j < n2 ? ySorted[j] : Infinity;

    if (xVal <= yVal) i++;
    if (yVal <= xVal) j++;

    const cdf1 = i / n1;
    const cdf2 = j / n2;
    const diff = Math.abs(cdf1 - cdf2);
    if (diff > D) D = diff;
  }

  // Approximate p-value using asymptotic formula
  // P(D > d) ≈ 2 * sum_{k=1}^{inf} (-1)^{k+1} * exp(-2k^2 * lambda^2)
  // where lambda = D * sqrt(n1*n2/(n1+n2))
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * D;

  let p = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * lambda * lambda);
    p += term;
    if (Math.abs(term) < 1e-12) break;
  }

  p = Math.max(0, Math.min(1, p));

  return { D, p };
}
/**
 * Krippendorff's alpha for ordinal/interval data.
 * Measures inter-rater (inter-LLM) reliability.
 * 
 * @param ratings - 2D array where ratings[coder][item] = value (or null for missing)
 * @returns alpha coefficient (-1 to 1, where 1 = perfect agreement, 0 = chance)
 */
export function krippendorffAlpha(
  ratings: (number | null)[][]
): { alpha: number; De: number; Do: number } {
  const nCoders = ratings.length;
  if (nCoders < 2) return { alpha: 1, De: 0, Do: 0 };

  const nItems = ratings[0]?.length ?? 0;
  if (nItems === 0) return { alpha: 1, De: 0, Do: 0 };

  // Collect all non-null values per item
  const itemValues: number[][] = [];
  for (let u = 0; u < nItems; u++) {
    const vals: number[] = [];
    for (let c = 0; c < nCoders; c++) {
      const v = ratings[c]?.[u];
      if (v !== null && v !== undefined) vals.push(v);
    }
    itemValues.push(vals);
  }

  // Observed disagreement (Do)
  let Do = 0;
  let totalPairs = 0;
  for (const vals of itemValues) {
    const m = vals.length;
    if (m < 2) continue;
    for (let i = 0; i < m; i++) {
      for (let j = i + 1; j < m; j++) {
        Do += (vals[i] - vals[j]) ** 2;
        totalPairs++;
      }
    }
  }
  if (totalPairs > 0) Do /= totalPairs;

  // Expected disagreement (De) — all possible pairs across all items
  const allValues: number[] = [];
  for (const vals of itemValues) {
    for (const v of vals) allValues.push(v);
  }
  const n = allValues.length;
  if (n < 2) return { alpha: 1, De: 0, Do: 0 };

  let De = 0;
  let dePairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      De += (allValues[i] - allValues[j]) ** 2;
      dePairs++;
    }
  }
  if (dePairs > 0) De /= dePairs;

  const alpha = De > 0 ? 1 - Do / De : 1;

  return { alpha: Math.round(alpha * 10000) / 10000, De, Do };
}
