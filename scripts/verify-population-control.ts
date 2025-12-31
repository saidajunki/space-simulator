/**
 * 人口抑制と文明持続性の検証
 * 
 * 目的: H50の検証 - 「文明の持続には人口上限が必要」
 * 
 * 方法:
 * - 資源再生率を下げて自然に人口を抑制
 * - 人口が11-20に収まる条件を探索
 * - 文明の持続性（4/4達成率）を比較
 * 
 * 非恣意性: 人口上限を直接設けるのではなく、資源再生率で間接的に制御
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface Result {
  regenRate: number;
  seed: number;
  avgPop: number;
  avgHHI: number;
  avgArtPerCapita: number;
  avgCoopRate: number;
  civScore4_4Rate: number;
  popIn11_20Rate: number;
  trapCount: number;
}

function runSimulation(regenRate: number, seed: number, ticks: number): Result {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 12, // 最適値
      edgeDensity: 0.4,
      initialEntityCount: 30, // 少なめの初期人口
    },
    resourceRegenerationRate: regenRate,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  
  let totalPop = 0;
  let totalHHI = 0;
  let totalArtPerCapita = 0;
  let totalCoopRate = 0;
  let civScore4_4Count = 0;
  let popIn11_20Count = 0;
  let samples = 0;
  
  let windowPartnerSelections = 0;
  let windowReplications = 0;
  
  let trapCount = 0;
  let was4of4 = false;
  
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
      
      const is4of4 = civScore === 4;
      if (is4of4) {
        civScore4_4Count++;
        was4of4 = true;
      } else if (was4of4) {
        trapCount++;
        was4of4 = false;
      }
      
      if (stats.entityCount >= 11 && stats.entityCount <= 20) {
        popIn11_20Count++;
      }
      
      totalPop += stats.entityCount;
      totalHHI += hhi;
      totalArtPerCapita += artPerCapita;
      totalCoopRate += coopRate;
      samples++;
      
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  return {
    regenRate,
    seed,
    avgPop: samples > 0 ? totalPop / samples : 0,
    avgHHI: samples > 0 ? totalHHI / samples : 0,
    avgArtPerCapita: samples > 0 ? totalArtPerCapita / samples : 0,
    avgCoopRate: samples > 0 ? totalCoopRate / samples : 0,
    civScore4_4Rate: samples > 0 ? (civScore4_4Count / samples) * 100 : 0,
    popIn11_20Rate: samples > 0 ? (popIn11_20Count / samples) * 100 : 0,
    trapCount,
  };
}

function main() {
  console.log('=== 人口抑制と文明持続性の検証 ===\n');
  console.log('目的: H50の検証 - 「文明の持続には人口上限が必要」\n');
  console.log('方法: 資源再生率を変えて自然に人口を抑制\n');
  
  const regenRates = [0.012, 0.014, 0.016, 0.018, 0.020, 0.024];
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 20000;
  
  console.log('条件:');
  console.log('- ノード数: 12');
  console.log('- 初期人口: 30');
  console.log('- シミュレーション長: 20,000 tick');
  console.log('- 資源再生率: ' + regenRates.join(', ') + '\n');
  
  const results: Result[] = [];
  
  for (const regenRate of regenRates) {
    console.log(`\n資源再生率 ${regenRate} を検証中...`);
    
    for (const seed of seeds) {
      const result = runSimulation(regenRate, seed, ticks);
      results.push(result);
      console.log(`  Seed ${seed}: Pop=${result.avgPop.toFixed(1)}, HHI=${result.avgHHI.toFixed(3)}, 4/4=${result.civScore4_4Rate.toFixed(1)}%`);
    }
  }
  
  // 資源再生率別の集計
  console.log('\n=== 資源再生率別の集計 ===\n');
  console.log('regenRate\t平均人口\t平均HHI\t4/4達成率\t人口11-20率\t罠発生回数');
  
  for (const regenRate of regenRates) {
    const rateResults = results.filter(r => r.regenRate === regenRate);
    const avgPop = rateResults.reduce((sum, r) => sum + r.avgPop, 0) / rateResults.length;
    const avgHHI = rateResults.reduce((sum, r) => sum + r.avgHHI, 0) / rateResults.length;
    const avg4_4Rate = rateResults.reduce((sum, r) => sum + r.civScore4_4Rate, 0) / rateResults.length;
    const avgPopIn11_20Rate = rateResults.reduce((sum, r) => sum + r.popIn11_20Rate, 0) / rateResults.length;
    const avgTrapCount = rateResults.reduce((sum, r) => sum + r.trapCount, 0) / rateResults.length;
    
    console.log(`${regenRate}\t${avgPop.toFixed(1)}\t${avgHHI.toFixed(3)}\t${avg4_4Rate.toFixed(1)}%\t${avgPopIn11_20Rate.toFixed(1)}%\t${avgTrapCount.toFixed(1)}`);
  }
  
  // 最適条件の特定
  console.log('\n=== 最適条件の特定 ===\n');
  
  // 人口11-20率が高く、4/4達成率も高い条件を探す
  const rateStats = regenRates.map(regenRate => {
    const rateResults = results.filter(r => r.regenRate === regenRate);
    return {
      regenRate,
      avgPop: rateResults.reduce((sum, r) => sum + r.avgPop, 0) / rateResults.length,
      avgHHI: rateResults.reduce((sum, r) => sum + r.avgHHI, 0) / rateResults.length,
      avg4_4Rate: rateResults.reduce((sum, r) => sum + r.civScore4_4Rate, 0) / rateResults.length,
      avgPopIn11_20Rate: rateResults.reduce((sum, r) => sum + r.popIn11_20Rate, 0) / rateResults.length,
      avgTrapCount: rateResults.reduce((sum, r) => sum + r.trapCount, 0) / rateResults.length,
    };
  });
  
  // 4/4達成率でソート
  const sorted = [...rateStats].sort((a, b) => b.avg4_4Rate - a.avg4_4Rate);
  console.log('4/4達成率順:');
  for (const stat of sorted) {
    console.log(`  regenRate=${stat.regenRate}: 4/4=${stat.avg4_4Rate.toFixed(1)}%, Pop=${stat.avgPop.toFixed(1)}, HHI=${stat.avgHHI.toFixed(3)}`);
  }
  
  // 人口11-20率でソート
  const sortedByPop = [...rateStats].sort((a, b) => b.avgPopIn11_20Rate - a.avgPopIn11_20Rate);
  console.log('\n人口11-20率順:');
  for (const stat of sortedByPop) {
    console.log(`  regenRate=${stat.regenRate}: 11-20率=${stat.avgPopIn11_20Rate.toFixed(1)}%, 4/4=${stat.avg4_4Rate.toFixed(1)}%`);
  }
  
  // 相関分析
  console.log('\n=== 相関分析 ===\n');
  
  const allPops = results.map(r => r.avgPop);
  const all4_4Rates = results.map(r => r.civScore4_4Rate);
  const allHHIs = results.map(r => r.avgHHI);
  const allPopIn11_20Rates = results.map(r => r.popIn11_20Rate);
  
  // 人口11-20率と4/4達成率の相関
  const n = results.length;
  const sumX = allPopIn11_20Rates.reduce((a, b) => a + b, 0);
  const sumY = all4_4Rates.reduce((a, b) => a + b, 0);
  const sumXY = allPopIn11_20Rates.reduce((sum, x, i) => sum + x * all4_4Rates[i], 0);
  const sumX2 = allPopIn11_20Rates.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = all4_4Rates.reduce((sum, y) => sum + y * y, 0);
  
  const correlation = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  console.log(`人口11-20率と4/4達成率の相関: ${correlation.toFixed(3)}`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  const best = sorted[0];
  console.log(`最適な資源再生率: ${best.regenRate}`);
  console.log(`  - 平均人口: ${best.avgPop.toFixed(1)}`);
  console.log(`  - 平均HHI: ${best.avgHHI.toFixed(3)}`);
  console.log(`  - 4/4達成率: ${best.avg4_4Rate.toFixed(1)}%`);
  console.log(`  - 人口11-20率: ${best.avgPopIn11_20Rate.toFixed(1)}%`);
  console.log(`  - 文明の罠発生回数: ${best.avgTrapCount.toFixed(1)}`);
  
  if (correlation > 0.3) {
    console.log('\n→ H50を支持: 人口を11-20に維持すると4/4達成率が向上する');
  } else if (correlation < -0.3) {
    console.log('\n→ H50を棄却: 人口を11-20に維持しても4/4達成率は向上しない');
  } else {
    console.log('\n→ H50は不明確: 人口11-20率と4/4達成率の相関は弱い');
  }
}

main();
