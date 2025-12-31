/**
 * H47検証: 新しい文明スコア定義での評価
 * 
 * 旧定義:
 * 1. 人口 ≥ 10
 * 2. Art/人 ≥ 5
 * 3. 協力率 ≥ 50%
 * 4. クラスタ係数 ≥ 0.3
 * 
 * 新定義（案A）:
 * 1. 人口 ≥ 10
 * 2. Art/人 ≥ 5
 * 3. 協力率 ≥ 50%
 * 4. 最大クラスタサイズ ≥ 5
 * 
 * 新定義（案B）:
 * 1. 人口 ≥ 10
 * 2. Art/人 ≥ 5
 * 3. 協力率 ≥ 50%
 * 4. クラスタ係数 ≥ 0.15（閾値を下げる）
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface CivResult {
  nodeCount: number;
  regenRate: number;
  avgPop: number;
  artPerCapita: number;
  maxClusterSize: number;
  clusteringCoeff: number;
  cooperationRate: number;
  oldScore: number;
  newScoreA: number;
  newScoreB: number;
}

function runSimulation(nodeCount: number, regenRate: number, seed: number, ticks: number): CivResult {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount,
      edgeDensity: 0.4,
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
  let partnerSelections = 0;
  let replications = 0;
  let totalClusteringCoeff = 0;
  let totalMaxCluster = 0;
  let clusteringSamples = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    totalPop += stats.entityCount;
    popSamples++;
    
    if (stats.entityCount > 0) {
      // クラスタ係数（HHI）
      const values = Array.from(stats.spatialDistribution.values());
      const shares = values.map(v => v / stats.entityCount);
      const hhi = shares.reduce((sum, s) => sum + s * s, 0);
      totalClusteringCoeff += hhi;
      
      // 最大クラスタサイズ
      const maxCluster = Math.max(...values);
      totalMaxCluster += maxCluster;
      
      clusteringSamples++;
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
  const coopRate = replications > 0 ? (partnerSelections / replications) * 100 : 0;
  const avgClusteringCoeff = clusteringSamples > 0 ? totalClusteringCoeff / clusteringSamples : 0;
  const avgMaxCluster = clusteringSamples > 0 ? totalMaxCluster / clusteringSamples : 0;
  const artPerCapita = avgPop > 0 ? finalStats.artifactCount / avgPop : 0;
  
  // 旧スコア
  let oldScore = 0;
  if (avgPop >= 10) oldScore++;
  if (artPerCapita >= 5) oldScore++;
  if (coopRate >= 50) oldScore++;
  if (avgClusteringCoeff >= 0.3) oldScore++;
  
  // 新スコアA（最大クラスタサイズ）
  let newScoreA = 0;
  if (avgPop >= 10) newScoreA++;
  if (artPerCapita >= 5) newScoreA++;
  if (coopRate >= 50) newScoreA++;
  if (avgMaxCluster >= 5) newScoreA++;
  
  // 新スコアB（クラスタ係数閾値を下げる）
  let newScoreB = 0;
  if (avgPop >= 10) newScoreB++;
  if (artPerCapita >= 5) newScoreB++;
  if (coopRate >= 50) newScoreB++;
  if (avgClusteringCoeff >= 0.15) newScoreB++;

  return {
    nodeCount,
    regenRate,
    avgPop,
    artPerCapita,
    maxClusterSize: avgMaxCluster,
    clusteringCoeff: avgClusteringCoeff,
    cooperationRate: coopRate,
    oldScore,
    newScoreA,
    newScoreB,
  };
}

async function main() {
  console.log('=== H47検証: 新しい文明スコア定義での評価 ===\n');
  
  const configs = [
    { nodeCount: 10, regenRate: 0.020 },
    { nodeCount: 15, regenRate: 0.020 },
    { nodeCount: 20, regenRate: 0.020 },
    { nodeCount: 25, regenRate: 0.020 },
    { nodeCount: 30, regenRate: 0.020 },
    { nodeCount: 20, regenRate: 0.016 },
    { nodeCount: 20, regenRate: 0.024 },
    { nodeCount: 20, regenRate: 0.028 },
    { nodeCount: 30, regenRate: 0.024 },
    { nodeCount: 30, regenRate: 0.028 },
  ];
  
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 3000;
  
  const allResults: CivResult[] = [];
  let old4_4 = 0;
  let newA4_4 = 0;
  let newB4_4 = 0;
  
  for (const cfg of configs) {
    console.log(`\n--- ノード数: ${cfg.nodeCount}, 再生率: ${cfg.regenRate} ---`);
    
    const results: CivResult[] = [];
    for (const seed of seeds) {
      const result = runSimulation(cfg.nodeCount, cfg.regenRate, seed, ticks);
      results.push(result);
      
      if (result.oldScore === 4) old4_4++;
      if (result.newScoreA === 4) newA4_4++;
      if (result.newScoreB === 4) newB4_4++;
      
      console.log(`  Seed ${seed}: 旧=${result.oldScore}/4, 新A=${result.newScoreA}/4, 新B=${result.newScoreB}/4 (人口=${result.avgPop.toFixed(1)}, MaxCluster=${result.maxClusterSize.toFixed(1)}, HHI=${result.clusteringCoeff.toFixed(3)})`);
    }
    
    // 平均を計算
    const avgResult: CivResult = {
      nodeCount: cfg.nodeCount,
      regenRate: cfg.regenRate,
      avgPop: results.reduce((s, r) => s + r.avgPop, 0) / results.length,
      artPerCapita: results.reduce((s, r) => s + r.artPerCapita, 0) / results.length,
      maxClusterSize: results.reduce((s, r) => s + r.maxClusterSize, 0) / results.length,
      clusteringCoeff: results.reduce((s, r) => s + r.clusteringCoeff, 0) / results.length,
      cooperationRate: results.reduce((s, r) => s + r.cooperationRate, 0) / results.length,
      oldScore: results.reduce((s, r) => s + r.oldScore, 0) / results.length,
      newScoreA: results.reduce((s, r) => s + r.newScoreA, 0) / results.length,
      newScoreB: results.reduce((s, r) => s + r.newScoreB, 0) / results.length,
    };
    
    allResults.push(avgResult);
  }
  
  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  console.log('| ノード | 再生率 | 人口 | Art/人 | MaxCluster | HHI | 旧スコア | 新A | 新B |');
  console.log('|--------|--------|------|--------|------------|-----|----------|-----|-----|');
  
  for (const r of allResults) {
    console.log(`| ${r.nodeCount.toString().padStart(6)} | ${r.regenRate.toFixed(3)} | ${r.avgPop.toFixed(1).padStart(4)} | ${r.artPerCapita.toFixed(2).padStart(6)} | ${r.maxClusterSize.toFixed(1).padStart(10)} | ${r.clusteringCoeff.toFixed(3)} | ${r.oldScore.toFixed(1).padStart(8)} | ${r.newScoreA.toFixed(1).padStart(3)} | ${r.newScoreB.toFixed(1).padStart(3)} |`);
  }
  
  // 4/4達成率
  const totalRuns = configs.length * seeds.length;
  console.log('\n\n=== 4/4達成率 ===\n');
  console.log(`旧定義（HHI≥0.3）: ${old4_4}/${totalRuns} (${(old4_4/totalRuns*100).toFixed(0)}%)`);
  console.log(`新定義A（MaxCluster≥5）: ${newA4_4}/${totalRuns} (${(newA4_4/totalRuns*100).toFixed(0)}%)`);
  console.log(`新定義B（HHI≥0.15）: ${newB4_4}/${totalRuns} (${(newB4_4/totalRuns*100).toFixed(0)}%)`);
  
  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  if (newA4_4 > old4_4 || newB4_4 > old4_4) {
    console.log('H47を支持: 新しい定義で4/4達成率が向上');
    if (newA4_4 >= newB4_4) {
      console.log(`  推奨: 新定義A（最大クラスタサイズ≥5）- 達成率${(newA4_4/totalRuns*100).toFixed(0)}%`);
    } else {
      console.log(`  推奨: 新定義B（HHI≥0.15）- 達成率${(newB4_4/totalRuns*100).toFixed(0)}%`);
    }
  } else {
    console.log('H47は不明確: 新しい定義でも4/4達成率は改善しない');
  }
}

main().catch(console.error);
