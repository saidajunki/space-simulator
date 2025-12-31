/**
 * Q3深化: 文明スコア4/4達成の条件探索
 * 
 * 現在の文明スコア定義:
 * 1. 人口 ≥ 10
 * 2. Art/人 ≥ 5
 * 3. 協力率 ≥ 50%
 * 4. クラスタ係数 ≥ 0.3
 * 
 * 問題: クラスタ係数0.3は達成困難（ノード数が多いと低下）
 * 
 * 検証方法:
 * 1. 様々なパラメータ組み合わせで4/4達成を試みる
 * 2. 達成条件を特定
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface CivResult {
  nodeCount: number;
  edgeDensity: number;
  regenRate: number;
  avgPop: number;
  artPerCapita: number;
  clusteringCoeff: number;
  cooperationRate: number;
  civilizationScore: number;
  conditions: {
    pop: boolean;
    art: boolean;
    coop: boolean;
    cluster: boolean;
  };
}

function calculateClusteringCoefficient(spatialDist: Map<string, number>, totalPop: number): number {
  if (totalPop <= 1) return 0;
  
  const values = Array.from(spatialDist.values());
  const shares = values.map(v => v / totalPop);
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);
  
  return hhi;
}

function runSimulation(nodeCount: number, edgeDensity: number, regenRate: number, seed: number, ticks: number): CivResult {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount,
      edgeDensity,
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
  let clusteringSamples = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    totalPop += stats.entityCount;
    popSamples++;
    
    if (stats.entityCount > 0) {
      const clusterCoeff = calculateClusteringCoefficient(stats.spatialDistribution, stats.entityCount);
      totalClusteringCoeff += clusterCoeff;
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
  const artPerCapita = avgPop > 0 ? finalStats.artifactCount / avgPop : 0;
  
  // 条件判定
  const conditions = {
    pop: avgPop >= 10,
    art: artPerCapita >= 5,
    coop: coopRate >= 50,
    cluster: avgClusteringCoeff >= 0.3,
  };
  
  const civScore = Object.values(conditions).filter(Boolean).length;

  return {
    nodeCount,
    edgeDensity,
    regenRate,
    avgPop,
    artPerCapita,
    clusteringCoeff: avgClusteringCoeff,
    cooperationRate: coopRate,
    civilizationScore: civScore,
    conditions,
  };
}

async function main() {
  console.log('=== Q3深化: 文明スコア4/4達成の条件探索 ===\n');
  
  // クラスタ係数を高めるための条件を探索
  // 少ないノード数、高いエッジ密度、適度な資源再生率
  const configs = [
    // 少ないノード数でクラスタ係数を高める
    { nodeCount: 5, edgeDensity: 0.3, regenRate: 0.020 },
    { nodeCount: 5, edgeDensity: 0.5, regenRate: 0.024 },
    { nodeCount: 8, edgeDensity: 0.3, regenRate: 0.020 },
    { nodeCount: 8, edgeDensity: 0.5, regenRate: 0.024 },
    { nodeCount: 10, edgeDensity: 0.3, regenRate: 0.020 },
    { nodeCount: 10, edgeDensity: 0.5, regenRate: 0.024 },
    { nodeCount: 10, edgeDensity: 0.3, regenRate: 0.028 },
    { nodeCount: 10, edgeDensity: 0.5, regenRate: 0.032 },
    // 中程度のノード数
    { nodeCount: 15, edgeDensity: 0.3, regenRate: 0.024 },
    { nodeCount: 15, edgeDensity: 0.5, regenRate: 0.028 },
    { nodeCount: 20, edgeDensity: 0.3, regenRate: 0.024 },
    { nodeCount: 20, edgeDensity: 0.5, regenRate: 0.028 },
  ];
  
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 3000;
  
  const allResults: CivResult[] = [];
  let best4_4: CivResult | null = null;
  
  for (const cfg of configs) {
    console.log(`\n--- ノード数: ${cfg.nodeCount}, エッジ密度: ${cfg.edgeDensity}, 再生率: ${cfg.regenRate} ---`);
    
    const results: CivResult[] = [];
    for (const seed of seeds) {
      const result = runSimulation(cfg.nodeCount, cfg.edgeDensity, cfg.regenRate, seed, ticks);
      results.push(result);
      
      if (result.civilizationScore === 4) {
        console.log(`  ★ Seed ${seed}: 4/4達成! 人口=${result.avgPop.toFixed(1)}, Art/人=${result.artPerCapita.toFixed(2)}, クラスタ=${result.clusteringCoeff.toFixed(3)}, 協力率=${result.cooperationRate.toFixed(1)}%`);
        if (!best4_4 || result.avgPop > best4_4.avgPop) {
          best4_4 = result;
        }
      } else {
        const missing = [];
        if (!result.conditions.pop) missing.push('人口');
        if (!result.conditions.art) missing.push('Art/人');
        if (!result.conditions.coop) missing.push('協力率');
        if (!result.conditions.cluster) missing.push('クラスタ');
        console.log(`  Seed ${seed}: ${result.civilizationScore}/4 (未達成: ${missing.join(', ')})`);
      }
    }
    
    // 平均を計算
    const avgResult: CivResult = {
      nodeCount: cfg.nodeCount,
      edgeDensity: cfg.edgeDensity,
      regenRate: cfg.regenRate,
      avgPop: results.reduce((s, r) => s + r.avgPop, 0) / results.length,
      artPerCapita: results.reduce((s, r) => s + r.artPerCapita, 0) / results.length,
      clusteringCoeff: results.reduce((s, r) => s + r.clusteringCoeff, 0) / results.length,
      cooperationRate: results.reduce((s, r) => s + r.cooperationRate, 0) / results.length,
      civilizationScore: results.reduce((s, r) => s + r.civilizationScore, 0) / results.length,
      conditions: {
        pop: results.filter(r => r.conditions.pop).length >= 3,
        art: results.filter(r => r.conditions.art).length >= 3,
        coop: results.filter(r => r.conditions.coop).length >= 3,
        cluster: results.filter(r => r.conditions.cluster).length >= 3,
      },
    };
    
    allResults.push(avgResult);
  }
  
  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  console.log('| ノード | エッジ | 再生率 | 平均人口 | Art/人 | クラスタ | 協力率 | スコア |');
  console.log('|--------|--------|--------|----------|--------|----------|--------|--------|');
  
  for (const r of allResults) {
    console.log(`| ${r.nodeCount.toString().padStart(6)} | ${r.edgeDensity.toFixed(1).padStart(6)} | ${r.regenRate.toFixed(3)} | ${r.avgPop.toFixed(1).padStart(8)} | ${r.artPerCapita.toFixed(2).padStart(6)} | ${r.clusteringCoeff.toFixed(3).padStart(8)} | ${r.cooperationRate.toFixed(0).padStart(6)}% | ${r.civilizationScore.toFixed(1).padStart(6)} |`);
  }
  
  // 4/4達成の分析
  console.log('\n\n=== 4/4達成の分析 ===\n');
  
  const achieved4_4 = allResults.filter(r => r.civilizationScore >= 3.5);
  if (achieved4_4.length > 0) {
    console.log('4/4達成（または近い）条件:');
    for (const r of achieved4_4) {
      console.log(`  ノード数=${r.nodeCount}, エッジ密度=${r.edgeDensity}, 再生率=${r.regenRate}`);
    }
  } else {
    console.log('4/4達成条件は見つかりませんでした');
  }
  
  // 各条件の達成率
  console.log('\n各条件の達成率:');
  const popAchieved = allResults.filter(r => r.conditions.pop).length;
  const artAchieved = allResults.filter(r => r.conditions.art).length;
  const coopAchieved = allResults.filter(r => r.conditions.coop).length;
  const clusterAchieved = allResults.filter(r => r.conditions.cluster).length;
  
  console.log(`  人口≥10: ${popAchieved}/${allResults.length} (${(popAchieved/allResults.length*100).toFixed(0)}%)`);
  console.log(`  Art/人≥5: ${artAchieved}/${allResults.length} (${(artAchieved/allResults.length*100).toFixed(0)}%)`);
  console.log(`  協力率≥50%: ${coopAchieved}/${allResults.length} (${(coopAchieved/allResults.length*100).toFixed(0)}%)`);
  console.log(`  クラスタ係数≥0.3: ${clusterAchieved}/${allResults.length} (${(clusterAchieved/allResults.length*100).toFixed(0)}%)`);
  
  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  if (best4_4) {
    console.log(`4/4達成条件を発見: ノード数=${best4_4.nodeCount}, エッジ密度=${best4_4.edgeDensity}, 再生率=${best4_4.regenRate}`);
    console.log(`  人口: ${best4_4.avgPop.toFixed(1)}`);
    console.log(`  Art/人: ${best4_4.artPerCapita.toFixed(2)}`);
    console.log(`  クラスタ係数: ${best4_4.clusteringCoeff.toFixed(3)}`);
    console.log(`  協力率: ${best4_4.cooperationRate.toFixed(1)}%`);
  } else {
    console.log('4/4達成条件は見つかりませんでした');
    console.log('ボトルネック: クラスタ係数≥0.3の達成が困難');
    console.log('提案: クラスタ係数の閾値を0.2に下げるか、別の指標を検討');
  }
}

main().catch(console.error);
