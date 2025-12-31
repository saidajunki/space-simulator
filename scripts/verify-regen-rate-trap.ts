/**
 * H52/H53検証: 資源再生率と文明の罠の関係
 * 
 * H52: 文明の持続には「適度な資源再生率」が必要
 * H53: 「文明の罠」の発生頻度は資源再生率に比例する
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface TrapData {
  regenRate: number;
  seed: number;
  trapCount: number;
  recoveryCount: number;
  recoveryRate: number;
  avgCivScore: number;
  fourFourRate: number;  // 4/4達成率
  avgPopulation: number;
  avgArtPerPop: number;
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

function getCivScore(pop: number, artPerPop: number, coopRate: number, hhi: number): number {
  let score = 0;
  if (pop >= 10) score++;
  if (artPerPop >= 5) score++;
  if (coopRate >= 0.5) score++;
  if (hhi >= 0.15) score++;
  return score;
}

function runSimulation(seed: number, regenRate: number, ticks: number): TrapData {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 15,
      initialEntityCount: 30,
    },
    resourceRegenerationRate: regenRate,
  };

  const universe = new Universe(config);
  
  let prevCivScore = 0;
  let trapCount = 0;
  let recoveryCount = 0;
  let inTrap = false;
  let fourFourCount = 0;
  let totalCivScore = 0;
  let totalPopulation = 0;
  let totalArtPerPop = 0;
  let sampleCount = 0;
  
  const sampleInterval = 100;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const stats = universe.getStats();
      const events = universe.getEventLog();
      
      const replications = events.filter(e => e.type === 'replication');
      const cooperativeReplications = events.filter(e => e.type === 'partnerSelected').length;
      const coopRate = replications.length > 0 ? cooperativeReplications / replications.length : 0;
      const hhi = calculateHHI(stats.spatialDistribution);
      const artPerPop = stats.entityCount > 0 ? stats.artifactCount / stats.entityCount : 0;
      const civScore = getCivScore(stats.entityCount, artPerPop, coopRate, hhi);
      
      // 罠と回復の追跡
      if (prevCivScore === 4 && civScore < 4 && !inTrap) {
        trapCount++;
        inTrap = true;
      } else if (civScore === 4 && inTrap) {
        recoveryCount++;
        inTrap = false;
      }
      prevCivScore = civScore;
      
      // 統計
      if (civScore === 4) fourFourCount++;
      totalCivScore += civScore;
      totalPopulation += stats.entityCount;
      totalArtPerPop += artPerPop;
      sampleCount++;
    }
    
    universe.clearEventLog();
  }

  return {
    regenRate,
    seed,
    trapCount,
    recoveryCount,
    recoveryRate: trapCount > 0 ? recoveryCount / trapCount : 1,
    avgCivScore: sampleCount > 0 ? totalCivScore / sampleCount : 0,
    fourFourRate: sampleCount > 0 ? fourFourCount / sampleCount : 0,
    avgPopulation: sampleCount > 0 ? totalPopulation / sampleCount : 0,
    avgArtPerPop: sampleCount > 0 ? totalArtPerPop / sampleCount : 0,
  };
}

// メイン実行
console.log('=== H52/H53検証: 資源再生率と文明の罠の関係 ===\n');

const seeds = [42, 123, 456];
const regenRates = [0.012, 0.016, 0.020, 0.024, 0.028, 0.032];
const ticks = 15000;

const allResults: TrapData[] = [];

for (const regenRate of regenRates) {
  console.log(`=== 資源再生率 ${regenRate} ===\n`);
  
  for (const seed of seeds) {
    const result = runSimulation(seed, regenRate, ticks);
    allResults.push(result);
    
    console.log(`Seed ${seed}:`);
    console.log(`  罠発生: ${result.trapCount}, 回復: ${result.recoveryCount}, 回復率: ${(result.recoveryRate * 100).toFixed(1)}%`);
    console.log(`  平均文明スコア: ${result.avgCivScore.toFixed(2)}, 4/4達成率: ${(result.fourFourRate * 100).toFixed(1)}%`);
    console.log(`  平均人口: ${result.avgPopulation.toFixed(1)}, 平均Art/人: ${result.avgArtPerPop.toFixed(2)}`);
  }
  console.log();
}

// 資源再生率ごとの集計
console.log('=== 資源再生率ごとの集計 ===\n');
console.log('| 再生率 | 平均罠発生 | 平均回復率 | 平均文明スコア | 4/4達成率 | 平均人口 |');
console.log('|--------|-----------|-----------|---------------|----------|---------|');

const regenRateStats: Map<number, { trapCount: number[]; recoveryRate: number[]; civScore: number[]; fourFourRate: number[]; population: number[] }> = new Map();

for (const result of allResults) {
  if (!regenRateStats.has(result.regenRate)) {
    regenRateStats.set(result.regenRate, { trapCount: [], recoveryRate: [], civScore: [], fourFourRate: [], population: [] });
  }
  const stats = regenRateStats.get(result.regenRate)!;
  stats.trapCount.push(result.trapCount);
  stats.recoveryRate.push(result.recoveryRate);
  stats.civScore.push(result.avgCivScore);
  stats.fourFourRate.push(result.fourFourRate);
  stats.population.push(result.avgPopulation);
}

const sortedRegenRates = Array.from(regenRateStats.keys()).sort((a, b) => a - b);
const avgTrapCounts: number[] = [];
const avgFourFourRates: number[] = [];

for (const rate of sortedRegenRates) {
  const stats = regenRateStats.get(rate)!;
  const avgTrap = stats.trapCount.reduce((s, v) => s + v, 0) / stats.trapCount.length;
  const avgRecovery = stats.recoveryRate.reduce((s, v) => s + v, 0) / stats.recoveryRate.length;
  const avgCiv = stats.civScore.reduce((s, v) => s + v, 0) / stats.civScore.length;
  const avgFourFour = stats.fourFourRate.reduce((s, v) => s + v, 0) / stats.fourFourRate.length;
  const avgPop = stats.population.reduce((s, v) => s + v, 0) / stats.population.length;
  
  avgTrapCounts.push(avgTrap);
  avgFourFourRates.push(avgFourFour);
  
  console.log(`| ${rate} | ${avgTrap.toFixed(1)} | ${(avgRecovery * 100).toFixed(1)}% | ${avgCiv.toFixed(2)} | ${(avgFourFour * 100).toFixed(1)}% | ${avgPop.toFixed(1)} |`);
}

// 相関分析
function correlation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denom = Math.sqrt(denomX * denomY);
  return denom > 0 ? numerator / denom : 0;
}

const corrRegenTrap = correlation(sortedRegenRates, avgTrapCounts);
const corrRegenFourFour = correlation(sortedRegenRates, avgFourFourRates);

console.log(`\n相関分析:`);
console.log(`  資源再生率 vs 罠発生回数: ${corrRegenTrap.toFixed(3)}`);
console.log(`  資源再生率 vs 4/4達成率: ${corrRegenFourFour.toFixed(3)}`);

console.log('\n=== 結論 ===\n');

// H52の判定
if (corrRegenFourFour > 0.3) {
  console.log('H52を支持: 文明の持続には「適度な資源再生率」が必要');
  console.log('→ 資源再生率が高いほど4/4達成率が高い');
} else if (corrRegenFourFour < -0.3) {
  console.log('H52を棄却: 資源再生率が低いほど文明が持続');
} else {
  console.log('H52は不明確: 資源再生率と文明持続の関係は複雑');
}

// H53の判定
if (corrRegenTrap > 0.5) {
  console.log('\nH53を支持: 「文明の罠」の発生頻度は資源再生率に比例する');
  console.log('→ 資源が豊かなほど成長が速く、罠に陥りやすい');
} else if (corrRegenTrap < -0.5) {
  console.log('\nH53を棄却: 資源再生率が低いほど罠が多い');
} else {
  console.log('\nH53は不明確: 資源再生率と罠発生の関係は複雑');
}

console.log('\n現世界との対応:');
console.log('- 資源の豊かさと文明発達: 豊かな環境での文明発達');
console.log('- 急成長と崩壊: 急成長した文明の崩壊リスク');
console.log('- 持続可能性: 適度な成長率の重要性');
