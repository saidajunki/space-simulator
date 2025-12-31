/**
 * H40検証: 協力率の増加が規模の経済を生み出す
 * 
 * 仮説: 大集団では協力率が高く、それがArt/人の増加につながる
 * 
 * 検証方法:
 * 1. 異なる人口規模でシミュレーションを実行
 * 2. 協力率とArt/人の相関を分析
 * 3. 協力複製の効果を定量化
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';
import { SimulationStats } from '../src/core/observation.js';

interface PopulationResult {
  initialPop: number;
  finalPop: number;
  avgPop: number;
  totalArtifacts: number;
  artPerCapita: number;
  totalCoopReplications: number;
  totalSoloReplications: number;
  cooperationRate: number;
  avgEnergy: number;
  totalInteractions: number;
  interactionsPerCapita: number;
}

function runSimulation(initialPop: number, seed: number, ticks: number): PopulationResult {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 30,
      edgeDensity: 0.3,
      initialEntityCount: initialPop,
    },
    resourceRegenerationRate: 0.016,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  
  let totalPop = 0;
  let popSamples = 0;
  let totalCoopReplications = 0;
  let totalSoloReplications = 0;
  let totalInteractions = 0;
  let totalArtifacts = 0;
  let totalEnergy = 0;
  let energySamples = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    // 人口サンプリング
    totalPop += stats.entityCount;
    popSamples++;
    
    // エネルギーサンプリング
    if (stats.entityCount > 0) {
      totalEnergy += stats.avgEnergy * stats.entityCount;
      energySamples += stats.entityCount;
    }
    
    // イベント集計
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'replication') {
        const repEvent = event as { type: 'replication'; parentId: string; childId: string; partnerId?: string };
        if ('partnerId' in repEvent && repEvent.partnerId) {
          totalCoopReplications++;
        } else {
          // partnerIdがない場合は単独複製
          // ただし、協力複製のイベントにはpartnerIdが含まれないので、
          // 別の方法で判定が必要
        }
      }
      if (event.type === 'interaction') {
        totalInteractions++;
      }
    }
    
    // アーティファクト数
    totalArtifacts = Math.max(totalArtifacts, stats.artifactCount);
    
    universe.clearEventLog();
  }

  const finalStats = universe.getStats();
  const avgPop = totalPop / popSamples;
  
  // 協力複製の判定: partnerSelectedイベントの数で判定
  // または、replicationイベントの直前にpartnerSelectedがあるかで判定
  // 簡易的に、interactionCountを協力の指標として使用
  
  const cooperationRate = totalCoopReplications > 0 
    ? totalCoopReplications / (totalCoopReplications + totalSoloReplications) * 100
    : 0;

  return {
    initialPop,
    finalPop: finalStats.entityCount,
    avgPop,
    totalArtifacts: finalStats.artifactCount,
    artPerCapita: avgPop > 0 ? finalStats.artifactCount / avgPop : 0,
    totalCoopReplications,
    totalSoloReplications,
    cooperationRate,
    avgEnergy: energySamples > 0 ? totalEnergy / energySamples : 0,
    totalInteractions,
    interactionsPerCapita: avgPop > 0 ? totalInteractions / avgPop : 0,
  };
}

// より詳細な協力率を取得するための改良版
function runDetailedSimulation(initialPop: number, seed: number, ticks: number): {
  result: PopulationResult;
  coopDetails: {
    partnerSelections: number;
    replications: number;
    coopRate: number;
  };
} {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 30,
      edgeDensity: 0.3,
      initialEntityCount: initialPop,
    },
    resourceRegenerationRate: 0.016,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  
  let totalPop = 0;
  let popSamples = 0;
  let partnerSelections = 0;
  let replications = 0;
  let totalInteractions = 0;
  let totalEnergy = 0;
  let energySamples = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    totalPop += stats.entityCount;
    popSamples++;
    
    if (stats.entityCount > 0) {
      totalEnergy += stats.avgEnergy * stats.entityCount;
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
      if (event.type === 'interaction') {
        totalInteractions++;
      }
    }
    
    universe.clearEventLog();
  }

  const finalStats = universe.getStats();
  const avgPop = totalPop / popSamples;
  const coopRate = replications > 0 ? (partnerSelections / replications) * 100 : 0;

  return {
    result: {
      initialPop,
      finalPop: finalStats.entityCount,
      avgPop,
      totalArtifacts: finalStats.artifactCount,
      artPerCapita: avgPop > 0 ? finalStats.artifactCount / avgPop : 0,
      totalCoopReplications: partnerSelections,
      totalSoloReplications: replications - partnerSelections,
      cooperationRate: coopRate,
      avgEnergy: energySamples > 0 ? totalEnergy / energySamples : 0,
      totalInteractions,
      interactionsPerCapita: avgPop > 0 ? totalInteractions / avgPop : 0,
    },
    coopDetails: {
      partnerSelections,
      replications,
      coopRate,
    },
  };
}

async function main() {
  console.log('=== H40検証: 協力率と規模の経済 ===\n');
  
  const populations = [20, 50, 100, 150, 200];
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 3000;
  
  const allResults: Map<number, PopulationResult[]> = new Map();
  
  for (const pop of populations) {
    const results: PopulationResult[] = [];
    console.log(`\n--- 初期人口: ${pop} ---`);
    
    for (const seed of seeds) {
      console.log(`  Seed ${seed}...`);
      const { result, coopDetails } = runDetailedSimulation(pop, seed, ticks);
      results.push(result);
      console.log(`    平均人口: ${result.avgPop.toFixed(1)}, Art/人: ${result.artPerCapita.toFixed(2)}, 協力率: ${coopDetails.coopRate.toFixed(1)}%`);
    }
    
    allResults.set(pop, results);
  }
  
  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  console.log('| 初期人口 | 平均人口 | Art/人 | 協力率(%) | 相互作用/人 | 平均エネルギー |');
  console.log('|----------|----------|--------|-----------|-------------|----------------|');
  
  const summaries: { pop: number; avgPop: number; artPerCapita: number; coopRate: number; interPerCapita: number; avgEnergy: number }[] = [];
  
  for (const [pop, results] of allResults) {
    const avgPop = results.reduce((s, r) => s + r.avgPop, 0) / results.length;
    const artPerCapita = results.reduce((s, r) => s + r.artPerCapita, 0) / results.length;
    const coopRate = results.reduce((s, r) => s + r.cooperationRate, 0) / results.length;
    const interPerCapita = results.reduce((s, r) => s + r.interactionsPerCapita, 0) / results.length;
    const avgEnergy = results.reduce((s, r) => s + r.avgEnergy, 0) / results.length;
    
    console.log(`| ${pop.toString().padStart(8)} | ${avgPop.toFixed(1).padStart(8)} | ${artPerCapita.toFixed(2).padStart(6)} | ${coopRate.toFixed(1).padStart(9)} | ${interPerCapita.toFixed(1).padStart(11)} | ${avgEnergy.toFixed(2).padStart(14)} |`);
    
    summaries.push({ pop, avgPop, artPerCapita, coopRate, interPerCapita, avgEnergy });
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===\n');
  
  // 協力率 vs Art/人
  const coopRates = summaries.map(s => s.coopRate);
  const artPerCapitas = summaries.map(s => s.artPerCapita);
  const avgPops = summaries.map(s => s.avgPop);
  
  const corrCoopArt = calculateCorrelation(coopRates, artPerCapitas);
  const corrPopArt = calculateCorrelation(avgPops, artPerCapitas);
  const corrPopCoop = calculateCorrelation(avgPops, coopRates);
  
  console.log(`協力率 vs Art/人 相関: ${corrCoopArt.toFixed(3)}`);
  console.log(`平均人口 vs Art/人 相関: ${corrPopArt.toFixed(3)}`);
  console.log(`平均人口 vs 協力率 相関: ${corrPopCoop.toFixed(3)}`);
  
  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  if (corrCoopArt > 0.5) {
    console.log('H40を支持: 協力率とArt/人に正の相関がある');
    console.log(`  協力率が高いほど、一人当たりのアーティファクト生産が増加する`);
  } else if (corrCoopArt < -0.5) {
    console.log('H40を棄却: 協力率とArt/人に負の相関がある');
  } else {
    console.log('H40は不明確: 協力率とArt/人の相関が弱い');
    console.log(`  相関係数: ${corrCoopArt.toFixed(3)}`);
  }
  
  if (corrPopCoop > 0.5) {
    console.log('\n追加発見: 人口規模と協力率に正の相関がある');
    console.log(`  大集団ほど協力率が高い傾向`);
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
