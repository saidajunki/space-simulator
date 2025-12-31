/**
 * H49検証: 長期的な文明維持には「空間的制約」が必要
 * 
 * 仮説: ノード数が少ないと分散が抑制され、HHIが維持される
 * 
 * 検証方法:
 * 1. 少ないノード数（10, 12, 15）で長期シミュレーション
 * 2. 4/4達成率とHHIの推移を観察
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface Result {
  nodeCount: number;
  seed: number;
  avgCivScore: number;
  civScore4_4Rate: number;
  avgPop: number;
  avgHHI: number;
  avgCoopRate: number;
  trend: string;
}

function runSimulation(nodeCount: number, seed: number, ticks: number): Result {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount,
      edgeDensity: 0.5, // 高めのエッジ密度で接続性を確保
      initialEntityCount: 30, // 少なめの初期人口
    },
    resourceRegenerationRate: 0.024, // 適度な資源再生率
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  
  let totalCivScore = 0;
  let civScore4_4Count = 0;
  let totalPop = 0;
  let totalHHI = 0;
  let totalCoopRate = 0;
  let samples = 0;
  
  let windowPartnerSelections = 0;
  let windowReplications = 0;
  
  const firstHalfScores: number[] = [];
  const secondHalfScores: number[] = [];

  const sampleInterval = 100;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'partnerSelected') {
        windowPartnerSelections++;
      }
      if (event.type === 'replication') {
        windowReplications++;
      }
    }
    universe.clearEventLog();
    
    if ((t + 1) % sampleInterval === 0 && stats.entityCount > 0) {
      const values = Array.from(stats.spatialDistribution.values());
      const shares = values.map(v => v / stats.entityCount);
      const hhi = shares.reduce((sum, s) => sum + s * s, 0);
      
      const artPerCapita = stats.artifactCount / stats.entityCount;
      const coopRate = windowReplications > 0 ? (windowPartnerSelections / windowReplications) * 100 : 0;
      
      let civScore = 0;
      if (stats.entityCount >= 10) civScore++;
      if (artPerCapita >= 5) civScore++;
      if (coopRate >= 50) civScore++;
      if (hhi >= 0.15) civScore++;
      
      totalCivScore += civScore;
      if (civScore === 4) civScore4_4Count++;
      totalPop += stats.entityCount;
      totalHHI += hhi;
      totalCoopRate += coopRate;
      samples++;
      
      if (t < ticks / 2) {
        firstHalfScores.push(civScore);
      } else {
        secondHalfScores.push(civScore);
      }
      
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  const firstHalfAvg = firstHalfScores.length > 0 ? firstHalfScores.reduce((a, b) => a + b, 0) / firstHalfScores.length : 0;
  const secondHalfAvg = secondHalfScores.length > 0 ? secondHalfScores.reduce((a, b) => a + b, 0) / secondHalfScores.length : 0;
  const diff = secondHalfAvg - firstHalfAvg;
  const trend = diff > 0.2 ? '上昇' : diff < -0.2 ? '下降' : '安定';

  return {
    nodeCount,
    seed,
    avgCivScore: samples > 0 ? totalCivScore / samples : 0,
    civScore4_4Rate: samples > 0 ? (civScore4_4Count / samples) * 100 : 0,
    avgPop: samples > 0 ? totalPop / samples : 0,
    avgHHI: samples > 0 ? totalHHI / samples : 0,
    avgCoopRate: samples > 0 ? totalCoopRate / samples : 0,
    trend,
  };
}

async function main() {
  console.log('=== H49検証: 空間的制約と文明維持 ===\n');
  
  const nodeCounts = [10, 12, 15, 20, 25];
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 10000;
  
  const allResults: Map<number, Result[]> = new Map();
  
  for (const nodeCount of nodeCounts) {
    console.log(`\n--- ノード数: ${nodeCount} ---`);
    const results: Result[] = [];
    
    for (const seed of seeds) {
      const result = runSimulation(nodeCount, seed, ticks);
      results.push(result);
      console.log(`  Seed ${seed}: スコア${result.avgCivScore.toFixed(2)}/4, 4/4率${result.civScore4_4Rate.toFixed(1)}%, HHI=${result.avgHHI.toFixed(3)}, 傾向=${result.trend}`);
    }
    
    allResults.set(nodeCount, results);
  }
  
  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  console.log('| ノード数 | 平均スコア | 4/4達成率 | 平均人口 | 平均HHI | 平均協力率 | 上昇 | 安定 | 下降 |');
  console.log('|----------|------------|-----------|----------|---------|------------|------|------|------|');
  
  const summaries: { nodeCount: number; avgScore: number; rate4_4: number; avgPop: number; avgHHI: number; avgCoop: number }[] = [];
  
  for (const [nodeCount, results] of allResults) {
    const avgScore = results.reduce((s, r) => s + r.avgCivScore, 0) / results.length;
    const rate4_4 = results.reduce((s, r) => s + r.civScore4_4Rate, 0) / results.length;
    const avgPop = results.reduce((s, r) => s + r.avgPop, 0) / results.length;
    const avgHHI = results.reduce((s, r) => s + r.avgHHI, 0) / results.length;
    const avgCoop = results.reduce((s, r) => s + r.avgCoopRate, 0) / results.length;
    
    const upCount = results.filter(r => r.trend === '上昇').length;
    const stableCount = results.filter(r => r.trend === '安定').length;
    const downCount = results.filter(r => r.trend === '下降').length;
    
    console.log(`| ${nodeCount.toString().padStart(8)} | ${avgScore.toFixed(2).padStart(10)} | ${rate4_4.toFixed(1).padStart(9)}% | ${avgPop.toFixed(1).padStart(8)} | ${avgHHI.toFixed(3).padStart(7)} | ${avgCoop.toFixed(0).padStart(10)}% | ${upCount.toString().padStart(4)} | ${stableCount.toString().padStart(4)} | ${downCount.toString().padStart(4)} |`);
    
    summaries.push({ nodeCount, avgScore, rate4_4, avgPop, avgHHI, avgCoop });
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===\n');
  
  const nodeCounts2 = summaries.map(s => s.nodeCount);
  const avgScores = summaries.map(s => s.avgScore);
  const rates4_4 = summaries.map(s => s.rate4_4);
  const avgHHIs = summaries.map(s => s.avgHHI);
  
  const corrNodeScore = calculateCorrelation(nodeCounts2, avgScores);
  const corrNodeRate = calculateCorrelation(nodeCounts2, rates4_4);
  const corrNodeHHI = calculateCorrelation(nodeCounts2, avgHHIs);
  const corrHHIScore = calculateCorrelation(avgHHIs, avgScores);
  
  console.log(`ノード数 vs 平均スコア 相関: ${corrNodeScore.toFixed(3)}`);
  console.log(`ノード数 vs 4/4達成率 相関: ${corrNodeRate.toFixed(3)}`);
  console.log(`ノード数 vs 平均HHI 相関: ${corrNodeHHI.toFixed(3)}`);
  console.log(`平均HHI vs 平均スコア 相関: ${corrHHIScore.toFixed(3)}`);
  
  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  if (corrNodeHHI < -0.5 && corrHHIScore > 0.5) {
    console.log('H49を支持: ノード数が少ないほどHHIが高く、文明スコアも高い');
    console.log('  空間的制約が文明維持に有効');
  } else if (corrNodeRate < -0.5) {
    console.log('H49を部分的に支持: ノード数が少ないほど4/4達成率が高い');
  } else {
    console.log('H49は不明確: ノード数と文明スコアの関係が弱い');
  }
  
  // 最適条件
  const best = summaries.reduce((best, s) => s.rate4_4 > best.rate4_4 ? s : best);
  console.log(`\n最適条件: ノード数=${best.nodeCount} (4/4達成率${best.rate4_4.toFixed(1)}%, 平均HHI=${best.avgHHI.toFixed(3)})`);
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i]!, 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

main().catch(console.error);
