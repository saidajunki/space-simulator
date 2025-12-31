/**
 * 臨界人口の検証スクリプト
 * 
 * 目的: H31「文明発達には臨界人口が必要」を検証
 * - 異なる初期人口（20, 50, 100, 200）で文明指標を比較
 * - 協力行動、空間的クラスタ、アーティファクト蓄積を観察
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface CivilizationMetrics {
  initialPopulation: number;
  finalPopulation: number;
  artifactCount: number;
  artifactPerCapita: number;
  totalInteractions: number;
  totalReplications: number;
  cooperativeReplications: number;
  cooperationRate: number;
  clusteringCoefficient: number;
  avgSkillHarvest: number;
  civilizationScore: number;
}

function runSimulation(initialPopulation: number, seed: number, ticks: number): CivilizationMetrics {
  // ノード数を人口に応じて調整（密度を一定に保つ）
  const nodeCount = Math.max(20, Math.floor(initialPopulation * 0.6));
  
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.020, // やや高めで安定させる
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount,
      initialEntityCount: initialPopulation,
      edgeDensity: 0.25,
    },
  });

  let totalInteractions = 0;
  let totalReplications = 0;
  let cooperativeReplications = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'interaction') {
        totalInteractions++;
      } else if (event.type === 'replication') {
        totalReplications++;
      } else if (event.type === 'partnerSelected') {
        cooperativeReplications++;
      }
    }
  }

  const stats = universe.getStats();
  const entities = universe.getAllEntities();
  
  // スキル平均を計算
  let totalHarvest = 0;
  for (const entity of entities) {
    const stateData = entity.state.getData();
    if (stateData && stateData.length >= 1) {
      totalHarvest += stateData[0] / 255;
    }
  }
  const avgSkillHarvest = entities.length > 0 ? totalHarvest / entities.length : 0;
  
  // クラスタリング係数を計算
  const spatialDistribution = stats.spatialDistribution;
  let occupiedNodes = 0;
  let maxInNode = 0;
  for (const count of spatialDistribution.values()) {
    if (count > 0) {
      occupiedNodes++;
      maxInNode = Math.max(maxInNode, count);
    }
  }
  const clusteringCoefficient = stats.entityCount > 0 && occupiedNodes > 0
    ? maxInNode / stats.entityCount
    : 0;
  
  const cooperationRate = totalReplications > 0 
    ? cooperativeReplications / totalReplications 
    : 0;
  
  const artifactPerCapita = stats.entityCount > 0 
    ? stats.artifactCount / stats.entityCount 
    : 0;
  
  // 文明スコア（4つの基準の達成度）
  let civilizationScore = 0;
  if (stats.entityCount > 10) civilizationScore++;
  if (artifactPerCapita > 1.0) civilizationScore++;
  if (cooperationRate > 0.5) civilizationScore++;
  if (clusteringCoefficient > 0.3) civilizationScore++;

  return {
    initialPopulation,
    finalPopulation: stats.entityCount,
    artifactCount: stats.artifactCount,
    artifactPerCapita,
    totalInteractions,
    totalReplications,
    cooperativeReplications,
    cooperationRate,
    clusteringCoefficient,
    avgSkillHarvest,
    civilizationScore,
  };
}

async function main() {
  console.log('=== 臨界人口の検証 ===\n');
  console.log('目的: H31「文明発達には臨界人口が必要」を検証\n');

  const populations = [20, 50, 100, 200];
  const seeds = [42, 123, 456];
  const ticks = 5000;

  const resultsByPopulation: Map<number, CivilizationMetrics[]> = new Map();

  for (const pop of populations) {
    resultsByPopulation.set(pop, []);
    console.log(`初期人口 ${pop}...`);
    
    for (const seed of seeds) {
      const result = runSimulation(pop, seed, ticks);
      resultsByPopulation.get(pop)!.push(result);
      console.log(`  seed ${seed}: 人口=${result.finalPopulation}, Art=${result.artifactCount}, 協力率=${(result.cooperationRate * 100).toFixed(1)}%`);
    }
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  console.log('初期人口\t最終人口\tArtifact\tArt/人口\t協力率\t\tクラスタ\t文明スコア');
  
  for (const pop of populations) {
    const results = resultsByPopulation.get(pop)!;
    const avg = {
      finalPopulation: results.reduce((sum, r) => sum + r.finalPopulation, 0) / results.length,
      artifactCount: results.reduce((sum, r) => sum + r.artifactCount, 0) / results.length,
      artifactPerCapita: results.reduce((sum, r) => sum + r.artifactPerCapita, 0) / results.length,
      cooperationRate: results.reduce((sum, r) => sum + r.cooperationRate, 0) / results.length,
      clusteringCoefficient: results.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / results.length,
      civilizationScore: results.reduce((sum, r) => sum + r.civilizationScore, 0) / results.length,
    };
    
    console.log(
      `${pop}\t\t${avg.finalPopulation.toFixed(1)}\t\t${avg.artifactCount.toFixed(1)}\t\t` +
      `${avg.artifactPerCapita.toFixed(2)}\t\t${(avg.cooperationRate * 100).toFixed(1)}%\t\t` +
      `${avg.clusteringCoefficient.toFixed(3)}\t\t${avg.civilizationScore.toFixed(1)}/4`
    );
  }

  // 傾向分析
  console.log('\n=== 傾向分析 ===\n');
  
  const pop20 = resultsByPopulation.get(20)!;
  const pop200 = resultsByPopulation.get(200)!;
  
  const avg20 = {
    finalPopulation: pop20.reduce((sum, r) => sum + r.finalPopulation, 0) / pop20.length,
    artifactPerCapita: pop20.reduce((sum, r) => sum + r.artifactPerCapita, 0) / pop20.length,
    cooperationRate: pop20.reduce((sum, r) => sum + r.cooperationRate, 0) / pop20.length,
    civilizationScore: pop20.reduce((sum, r) => sum + r.civilizationScore, 0) / pop20.length,
  };
  
  const avg200 = {
    finalPopulation: pop200.reduce((sum, r) => sum + r.finalPopulation, 0) / pop200.length,
    artifactPerCapita: pop200.reduce((sum, r) => sum + r.artifactPerCapita, 0) / pop200.length,
    cooperationRate: pop200.reduce((sum, r) => sum + r.cooperationRate, 0) / pop200.length,
    civilizationScore: pop200.reduce((sum, r) => sum + r.civilizationScore, 0) / pop200.length,
  };
  
  console.log('初期人口 20 vs 200:');
  console.log(`  最終人口: ${avg20.finalPopulation.toFixed(1)} → ${avg200.finalPopulation.toFixed(1)}`);
  console.log(`  Art/人口: ${avg20.artifactPerCapita.toFixed(2)} → ${avg200.artifactPerCapita.toFixed(2)}`);
  console.log(`  協力率: ${(avg20.cooperationRate * 100).toFixed(1)}% → ${(avg200.cooperationRate * 100).toFixed(1)}%`);
  console.log(`  文明スコア: ${avg20.civilizationScore.toFixed(1)}/4 → ${avg200.civilizationScore.toFixed(1)}/4`);

  // 結論
  console.log('\n=== 結論 ===\n');
  
  // 文明スコアが最大になる人口を特定
  let bestPop = 0;
  let bestScore = 0;
  for (const pop of populations) {
    const results = resultsByPopulation.get(pop)!;
    const avgScore = results.reduce((sum, r) => sum + r.civilizationScore, 0) / results.length;
    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestPop = pop;
    }
  }
  
  console.log(`最高文明スコア: ${bestScore.toFixed(1)}/4 (初期人口 ${bestPop})`);
  
  if (bestScore >= 3) {
    console.log('✓ 「文明」と呼べる状態に達した');
    console.log(`  → 臨界人口は ${bestPop} 以下と推定`);
  } else if (bestScore >= 2) {
    console.log('△ 「文明の萌芽」が観察された');
    console.log(`  → より大きな人口が必要かもしれない`);
  } else {
    console.log('✗ 「文明」には至らなかった');
  }
  
  // H31の検証
  const scoreIncrease = avg200.civilizationScore - avg20.civilizationScore;
  if (scoreIncrease > 0.5) {
    console.log('\nH31（臨界人口）: 支持');
    console.log(`  人口増加により文明スコアが向上 (+${scoreIncrease.toFixed(1)})`);
  } else if (scoreIncrease > 0) {
    console.log('\nH31（臨界人口）: 部分的に支持');
    console.log(`  人口増加による効果は限定的 (+${scoreIncrease.toFixed(1)})`);
  } else {
    console.log('\nH31（臨界人口）: 支持しない');
    console.log(`  人口増加は文明スコアに影響しない`);
  }
}

main().catch(console.error);
