/**
 * H65検証: 超長期では空間的分散が進む
 * 
 * 仮説: 人口増加に伴いHHIが低下し、空間的に分散する傾向がある。
 * 「都市化」ではなく「分散化」が進行。
 * 
 * 検証方法:
 * 1. 超長期シミュレーション（50,000 tick）を実行
 * 2. HHI（空間集中度）の時間変化を追跡
 * 3. 人口とHHIの相関を分析
 * 4. ノード占有率の変化を観察
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface SpatialAnalysis {
  tick: number;
  population: number;
  hhi: number;
  occupiedNodes: number;
  totalNodes: number;
  occupancyRate: number;  // 占有率 = 占有ノード / 総ノード
  maxNodePop: number;  // 最大ノード人口
  avgNodePop: number;  // 平均ノード人口（占有ノードのみ）
  gini: number;  // ジニ係数（空間的不平等度）
}

function calculateHHI(distribution: Map<string, number>): number {
  const values = Array.from(distribution.values());
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  
  let hhi = 0;
  for (const v of values) {
    const share = v / total;
    hhi += share * share;
  }
  return hhi;
}

function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  
  let sumOfDiffs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfDiffs += Math.abs(sorted[i]! - sorted[j]!);
    }
  }
  
  return sumOfDiffs / (2 * n * n * (total / n));
}

function runSimulation(seed: number, ticks: number, nodeCount: number): SpatialAnalysis[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: 0.020,
  };

  const universe = new Universe(config);
  const analyses: SpatialAnalysis[] = [];
  const sampleInterval = 2500;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const stats = universe.getStats();
      const distribution = stats.spatialDistribution;
      
      const hhi = calculateHHI(distribution);
      const values = Array.from(distribution.values());
      const occupiedNodes = values.filter(v => v > 0).length;
      const maxNodePop = values.length > 0 ? Math.max(...values) : 0;
      const avgNodePop = occupiedNodes > 0 ? values.filter(v => v > 0).reduce((s, v) => s + v, 0) / occupiedNodes : 0;
      const gini = calculateGini(values.filter(v => v > 0));
      
      analyses.push({
        tick: t + 1,
        population: stats.entityCount,
        hhi,
        occupiedNodes,
        totalNodes: nodeCount,
        occupancyRate: occupiedNodes / nodeCount,
        maxNodePop,
        avgNodePop,
        gini,
      });
    }
    
    universe.clearEventLog();
  }

  return analyses;
}

// 相関係数を計算
function correlation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  
  const avgX = x.reduce((s, v) => s + v, 0) / n;
  const avgY = y.reduce((s, v) => s + v, 0) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - avgX;
    const dy = y[i]! - avgY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denom = Math.sqrt(denomX * denomY);
  return denom > 0 ? numerator / denom : 0;
}

// メイン実行
console.log('=== H65検証: 超長期では空間的分散が進む ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 50000;
const nodeCount = 20;

interface SeedResult {
  seed: number;
  hhiChange: number;
  occupancyChange: number;
  giniChange: number;
  timeVsHHICorr: number;
  popVsHHICorr: number;
  timeVsOccupancyCorr: number;
  survived: boolean;
}

const results: SeedResult[] = [];

for (const seed of seeds) {
  console.log(`=== Seed ${seed} (${ticks.toLocaleString()} tick) ===\n`);
  const analyses = runSimulation(seed, ticks, nodeCount);
  
  if (analyses.length < 2) {
    console.log('データ不足\n');
    results.push({
      seed,
      hhiChange: NaN,
      occupancyChange: NaN,
      giniChange: NaN,
      timeVsHHICorr: NaN,
      popVsHHICorr: NaN,
      timeVsOccupancyCorr: NaN,
      survived: false,
    });
    continue;
  }
  
  // 絶滅チェック
  const finalPop = analyses[analyses.length - 1]!.population;
  if (finalPop === 0) {
    console.log('絶滅\n');
    results.push({
      seed,
      hhiChange: NaN,
      occupancyChange: NaN,
      giniChange: NaN,
      timeVsHHICorr: NaN,
      popVsHHICorr: NaN,
      timeVsOccupancyCorr: NaN,
      survived: false,
    });
    continue;
  }
  
  // 前半と後半の比較
  const half = Math.floor(analyses.length / 2);
  const firstHalf = analyses.slice(0, half);
  const secondHalf = analyses.slice(half);
  
  const firstHHI = firstHalf.reduce((s, a) => s + a.hhi, 0) / firstHalf.length;
  const secondHHI = secondHalf.reduce((s, a) => s + a.hhi, 0) / secondHalf.length;
  
  const firstOccupancy = firstHalf.reduce((s, a) => s + a.occupancyRate, 0) / firstHalf.length;
  const secondOccupancy = secondHalf.reduce((s, a) => s + a.occupancyRate, 0) / secondHalf.length;
  
  const firstGini = firstHalf.reduce((s, a) => s + a.gini, 0) / firstHalf.length;
  const secondGini = secondHalf.reduce((s, a) => s + a.gini, 0) / secondHalf.length;
  
  const firstPop = firstHalf.reduce((s, a) => s + a.population, 0) / firstHalf.length;
  const secondPop = secondHalf.reduce((s, a) => s + a.population, 0) / secondHalf.length;
  
  // 時系列相関
  const ticks_arr = analyses.map(a => a.tick);
  const hhis = analyses.map(a => a.hhi);
  const pops = analyses.map(a => a.population);
  const occupancies = analyses.map(a => a.occupancyRate);
  
  const timeVsHHICorr = correlation(ticks_arr, hhis);
  const popVsHHICorr = correlation(pops, hhis);
  const timeVsOccupancyCorr = correlation(ticks_arr, occupancies);
  
  console.log('前半 vs 後半の比較:\n');
  console.log('| 指標 | 前半 | 後半 | 変化 |');
  console.log('|------|------|------|------|');
  console.log(`| 人口 | ${firstPop.toFixed(1)} | ${secondPop.toFixed(1)} | ${((secondPop - firstPop) / firstPop * 100).toFixed(1)}% |`);
  console.log(`| HHI | ${firstHHI.toFixed(4)} | ${secondHHI.toFixed(4)} | ${((secondHHI - firstHHI) / firstHHI * 100).toFixed(1)}% |`);
  console.log(`| 占有率 | ${(firstOccupancy * 100).toFixed(1)}% | ${(secondOccupancy * 100).toFixed(1)}% | ${((secondOccupancy - firstOccupancy) / firstOccupancy * 100).toFixed(1)}% |`);
  console.log(`| ジニ係数 | ${firstGini.toFixed(4)} | ${secondGini.toFixed(4)} | ${((secondGini - firstGini) / firstGini * 100).toFixed(1)}% |`);
  
  console.log(`\n相関係数:`);
  console.log(`  時間 vs HHI: ${timeVsHHICorr.toFixed(3)}`);
  console.log(`  人口 vs HHI: ${popVsHHICorr.toFixed(3)}`);
  console.log(`  時間 vs 占有率: ${timeVsOccupancyCorr.toFixed(3)}`);
  
  // 最終状態
  const final = analyses[analyses.length - 1]!;
  console.log(`\n最終状態 (tick ${final.tick}):`);
  console.log(`  人口: ${final.population}`);
  console.log(`  HHI: ${final.hhi.toFixed(4)}`);
  console.log(`  占有ノード: ${final.occupiedNodes}/${final.totalNodes} (${(final.occupancyRate * 100).toFixed(1)}%)`);
  console.log(`  最大ノード人口: ${final.maxNodePop}`);
  console.log(`  平均ノード人口: ${final.avgNodePop.toFixed(1)}`);
  console.log(`  ジニ係数: ${final.gini.toFixed(4)}`);
  console.log();
  
  results.push({
    seed,
    hhiChange: (secondHHI - firstHHI) / firstHHI * 100,
    occupancyChange: (secondOccupancy - firstOccupancy) / firstOccupancy * 100,
    giniChange: (secondGini - firstGini) / firstGini * 100,
    timeVsHHICorr,
    popVsHHICorr,
    timeVsOccupancyCorr,
    survived: true,
  });
}

// 総合分析
console.log('=== 総合分析 ===\n');

const validResults = results.filter(r => r.survived && !isNaN(r.hhiChange));
console.log(`有効なseed数: ${validResults.length}/${results.length}\n`);

if (validResults.length > 0) {
  const hhiChangeAvg = validResults.reduce((s, r) => s + r.hhiChange, 0) / validResults.length;
  const occupancyChangeAvg = validResults.reduce((s, r) => s + r.occupancyChange, 0) / validResults.length;
  const giniChangeAvg = validResults.reduce((s, r) => s + r.giniChange, 0) / validResults.length;
  const timeVsHHICorrAvg = validResults.reduce((s, r) => s + r.timeVsHHICorr, 0) / validResults.length;
  const popVsHHICorrAvg = validResults.reduce((s, r) => s + r.popVsHHICorr, 0) / validResults.length;
  const timeVsOccupancyCorrAvg = validResults.reduce((s, r) => s + r.timeVsOccupancyCorr, 0) / validResults.length;
  
  console.log('| 指標 | 平均変化/相関 | 解釈 |');
  console.log('|------|--------------|------|');
  console.log(`| HHI変化 | ${hhiChangeAvg.toFixed(1)}% | ${hhiChangeAvg < -10 ? '分散化が進行' : hhiChangeAvg > 10 ? '集中化が進行' : '変化なし'} |`);
  console.log(`| 占有率変化 | ${occupancyChangeAvg.toFixed(1)}% | ${occupancyChangeAvg > 10 ? '拡散が進行' : '変化なし'} |`);
  console.log(`| ジニ係数変化 | ${giniChangeAvg.toFixed(1)}% | ${giniChangeAvg < -10 ? '平等化が進行' : giniChangeAvg > 10 ? '不平等化が進行' : '変化なし'} |`);
  console.log(`| 時間-HHI相関 | ${timeVsHHICorrAvg.toFixed(3)} | ${timeVsHHICorrAvg < -0.3 ? '時間とともに分散' : timeVsHHICorrAvg > 0.3 ? '時間とともに集中' : '弱い相関'} |`);
  console.log(`| 人口-HHI相関 | ${popVsHHICorrAvg.toFixed(3)} | ${popVsHHICorrAvg < -0.3 ? '人口増で分散' : popVsHHICorrAvg > 0.3 ? '人口増で集中' : '弱い相関'} |`);
  console.log(`| 時間-占有率相関 | ${timeVsOccupancyCorrAvg.toFixed(3)} | ${timeVsOccupancyCorrAvg > 0.3 ? '時間とともに拡散' : '弱い相関'} |`);
  
  // H65の判定
  console.log('\n=== H65の判定 ===\n');
  
  const dispersionIndicators = [
    hhiChangeAvg < -10,  // HHIが10%以上減少
    occupancyChangeAvg > 10,  // 占有率が10%以上増加
    timeVsHHICorrAvg < -0.3,  // 時間とHHIに負の相関
    popVsHHICorrAvg < -0.3,  // 人口とHHIに負の相関
  ];
  
  const supportCount = dispersionIndicators.filter(x => x).length;
  
  console.log(`支持する指標: ${supportCount}/4`);
  console.log(`  - HHI減少 > 10%: ${hhiChangeAvg < -10 ? '✓' : '✗'} (${hhiChangeAvg.toFixed(1)}%)`);
  console.log(`  - 占有率増加 > 10%: ${occupancyChangeAvg > 10 ? '✓' : '✗'} (${occupancyChangeAvg.toFixed(1)}%)`);
  console.log(`  - 時間-HHI相関 < -0.3: ${timeVsHHICorrAvg < -0.3 ? '✓' : '✗'} (${timeVsHHICorrAvg.toFixed(3)})`);
  console.log(`  - 人口-HHI相関 < -0.3: ${popVsHHICorrAvg < -0.3 ? '✓' : '✗'} (${popVsHHICorrAvg.toFixed(3)})`);
  
  if (supportCount >= 3) {
    console.log('\n結論: H65を**支持**。超長期では空間的分散が進む。');
  } else if (supportCount >= 2) {
    console.log('\n結論: H65を**部分的に支持**。分散傾向は見られるが、明確ではない。');
  } else {
    console.log('\n結論: H65を**棄却**。空間的分散が進む傾向は観察されない。');
  }
}
