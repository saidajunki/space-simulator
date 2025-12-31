/**
 * H45検証: Art/人を決定するのは「余剰エネルギー」である
 * 
 * 仮説: 余剰エネルギーが多い環境ではArt生成が活発
 * 
 * 検証方法:
 * 1. 異なる資源再生率でシミュレーションを実行
 * 2. 余剰エネルギー（平均エネルギー - 維持コスト）を計算
 * 3. 余剰エネルギーとArt/人の相関を分析
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface SurplusResult {
  regenRate: number;
  avgPop: number;
  avgEnergy: number;
  artPerCapita: number;
  totalArtifacts: number;
  cooperationRate: number;
  // 余剰エネルギーの推定（維持コストは約0.1/tick）
  surplusEnergy: number;
}

function runSimulation(regenRate: number, seed: number, ticks: number): SurplusResult {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 30,
      edgeDensity: 0.3,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: regenRate,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  
  let totalPop = 0;
  let popSamples = 0;
  let totalEnergy = 0;
  let energySamples = 0;
  let partnerSelections = 0;
  let replications = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    totalPop += stats.entityCount;
    popSamples++;
    
    if (stats.entityCount > 0 && stats.entityEnergy !== undefined) {
      totalEnergy += stats.entityEnergy;
      energySamples += stats.entityCount;
    }
    
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'partnerSelected') {
        partnerSelections++;
      }
      if (event.type === 'replication') {
        replications++;
      }
    }
    
    universe.clearEventLog();
  }

  const finalStats = universe.getStats();
  const avgPop = totalPop / popSamples;
  const avgEnergy = energySamples > 0 ? totalEnergy / energySamples : 0;
  const coopRate = replications > 0 ? (partnerSelections / replications) * 100 : 0;
  
  // 維持コストは約0.1/tick（entropyEngineの設定による）
  // 余剰エネルギー = 平均エネルギー - 維持コスト閾値
  // 維持コスト閾値を超えた分が「余剰」
  const maintenanceThreshold = 5.0; // 生存に必要な最低エネルギー
  const surplusEnergy = Math.max(0, avgEnergy - maintenanceThreshold);

  return {
    regenRate,
    avgPop,
    avgEnergy,
    artPerCapita: avgPop > 0 ? finalStats.artifactCount / avgPop : 0,
    totalArtifacts: finalStats.artifactCount,
    cooperationRate: coopRate,
    surplusEnergy,
  };
}

async function main() {
  console.log('=== H45検証: 余剰エネルギーとArt/人の関係 ===\n');
  
  const regenRates = [0.008, 0.012, 0.016, 0.020, 0.024, 0.028, 0.032];
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 3000;
  
  const allResults: Map<number, SurplusResult[]> = new Map();
  
  for (const rate of regenRates) {
    const results: SurplusResult[] = [];
    console.log(`\n--- 資源再生率: ${rate} ---`);
    
    for (const seed of seeds) {
      console.log(`  Seed ${seed}...`);
      const result = runSimulation(rate, seed, ticks);
      results.push(result);
      console.log(`    平均人口: ${result.avgPop.toFixed(1)}, 平均エネルギー: ${result.avgEnergy.toFixed(2)}, Art/人: ${result.artPerCapita.toFixed(2)}`);
    }
    
    allResults.set(rate, results);
  }
  
  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  console.log('| 再生率 | 平均人口 | 平均エネルギー | 余剰エネルギー | Art/人 | 協力率(%) |');
  console.log('|--------|----------|----------------|----------------|--------|-----------|');
  
  const summaries: { rate: number; avgPop: number; avgEnergy: number; surplus: number; artPerCapita: number; coopRate: number }[] = [];
  
  for (const [rate, results] of allResults) {
    const avgPop = results.reduce((s, r) => s + r.avgPop, 0) / results.length;
    const avgEnergy = results.reduce((s, r) => s + r.avgEnergy, 0) / results.length;
    const surplus = results.reduce((s, r) => s + r.surplusEnergy, 0) / results.length;
    const artPerCapita = results.reduce((s, r) => s + r.artPerCapita, 0) / results.length;
    const coopRate = results.reduce((s, r) => s + r.cooperationRate, 0) / results.length;
    
    console.log(`| ${rate.toFixed(3)} | ${avgPop.toFixed(1).padStart(8)} | ${avgEnergy.toFixed(2).padStart(14)} | ${surplus.toFixed(2).padStart(14)} | ${artPerCapita.toFixed(2).padStart(6)} | ${coopRate.toFixed(1).padStart(9)} |`);
    
    summaries.push({ rate, avgPop, avgEnergy, surplus, artPerCapita, coopRate });
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===\n');
  
  const surpluses = summaries.map(s => s.surplus);
  const artPerCapitas = summaries.map(s => s.artPerCapita);
  const avgEnergies = summaries.map(s => s.avgEnergy);
  const coopRates = summaries.map(s => s.coopRate);
  const avgPops = summaries.map(s => s.avgPop);
  
  const corrSurplusArt = calculateCorrelation(surpluses, artPerCapitas);
  const corrEnergyArt = calculateCorrelation(avgEnergies, artPerCapitas);
  const corrSurplusCoop = calculateCorrelation(surpluses, coopRates);
  const corrPopArt = calculateCorrelation(avgPops, artPerCapitas);
  
  console.log(`余剰エネルギー vs Art/人 相関: ${corrSurplusArt.toFixed(3)}`);
  console.log(`平均エネルギー vs Art/人 相関: ${corrEnergyArt.toFixed(3)}`);
  console.log(`余剰エネルギー vs 協力率 相関: ${corrSurplusCoop.toFixed(3)}`);
  console.log(`平均人口 vs Art/人 相関: ${corrPopArt.toFixed(3)}`);
  
  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  if (corrSurplusArt > 0.5) {
    console.log('H45を支持: 余剰エネルギーとArt/人に正の相関がある');
    console.log(`  余剰エネルギーが多いほど、一人当たりのアーティファクト生産が増加する`);
  } else if (corrSurplusArt < -0.5) {
    console.log('H45を棄却: 余剰エネルギーとArt/人に負の相関がある');
  } else {
    console.log('H45は不明確: 余剰エネルギーとArt/人の相関が弱い');
    console.log(`  相関係数: ${corrSurplusArt.toFixed(3)}`);
  }
  
  if (corrSurplusCoop < -0.5) {
    console.log('\nH44を支持: 余剰エネルギーと協力率に負の相関がある');
    console.log(`  余剰が少ない（厳しい環境）ほど協力率が高い`);
  }
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
