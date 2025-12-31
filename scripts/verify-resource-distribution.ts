/**
 * 資源分布の偏りとクラスタ形成の検証スクリプト
 * 
 * 目的: H34「クラスタ形成には資源の偏りが必要」を検証
 * - 資源再生率をノードごとに変える
 * - 偏った資源分布でクラスタが形成されるか観察
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface ResourceDistributionResult {
  distributionType: string;
  finalPopulation: number;
  artifactCount: number;
  maxClusterSize: number;
  clusteringCoefficient: number;
  occupiedNodeRatio: number;
  topNodePopulation: number;
  civilizationScore: number;
}

function runSimulation(
  seed: number,
  ticks: number,
  distributionType: 'uniform' | 'biased' | 'extreme'
): ResourceDistributionResult {
  // 資源分布の偏りを設定
  // 注: 現在のUniverseConfigでは直接ノードごとの資源再生率を設定できないため、
  // 代わりにノード数とエッジ密度を調整して「偏り」を模擬する
  
  let nodeCount: number;
  let edgeDensity: number;
  let regenRate: number;
  
  switch (distributionType) {
    case 'uniform':
      // 均一: 多くのノード、高い接続性
      nodeCount = 30;
      edgeDensity = 0.3;
      regenRate = 0.018;
      break;
    case 'biased':
      // 偏り: 少ないノード、中程度の接続性
      nodeCount = 15;
      edgeDensity = 0.4;
      regenRate = 0.024; // 少ないノードに高い再生率
      break;
    case 'extreme':
      // 極端: 非常に少ないノード、高い接続性
      nodeCount = 10;
      edgeDensity = 0.6;
      regenRate = 0.036; // さらに高い再生率
      break;
  }
  
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: regenRate,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount,
      initialEntityCount: 50,
      edgeDensity,
    },
  });

  for (let t = 0; t < ticks; t++) {
    universe.step();
  }

  const stats = universe.getStats();
  const spatialDistribution = stats.spatialDistribution;
  
  // クラスタリング指標を計算
  let occupiedNodes = 0;
  let maxClusterSize = 0;
  let topNodePopulation = 0;
  const nodeCounts: number[] = [];
  
  for (const count of spatialDistribution.values()) {
    nodeCounts.push(count);
    if (count > 0) {
      occupiedNodes++;
      maxClusterSize = Math.max(maxClusterSize, count);
    }
  }
  
  // 上位3ノードの人口
  nodeCounts.sort((a, b) => b - a);
  topNodePopulation = nodeCounts.slice(0, 3).reduce((sum, c) => sum + c, 0);
  
  const occupiedNodeRatio = occupiedNodes / nodeCount;
  const clusteringCoefficient = stats.entityCount > 0 
    ? maxClusterSize / stats.entityCount 
    : 0;
  
  const artifactPerCapita = stats.entityCount > 0 
    ? stats.artifactCount / stats.entityCount 
    : 0;
  
  // 文明スコア
  let civilizationScore = 0;
  if (stats.entityCount > 10) civilizationScore++;
  if (artifactPerCapita > 1.0) civilizationScore++;
  if (clusteringCoefficient > 0.3) civilizationScore++;
  // 協力率は別途計測が必要なので省略

  return {
    distributionType,
    finalPopulation: stats.entityCount,
    artifactCount: stats.artifactCount,
    maxClusterSize,
    clusteringCoefficient,
    occupiedNodeRatio,
    topNodePopulation,
    civilizationScore,
  };
}

async function main() {
  console.log('=== 資源分布の偏りとクラスタ形成の検証 ===\n');
  console.log('目的: H34「クラスタ形成には資源の偏りが必要」を検証\n');

  const distributionTypes: Array<'uniform' | 'biased' | 'extreme'> = ['uniform', 'biased', 'extreme'];
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 5000;

  const resultsByType: Map<string, ResourceDistributionResult[]> = new Map();

  for (const distType of distributionTypes) {
    resultsByType.set(distType, []);
    console.log(`${distType}分布...`);
    
    for (const seed of seeds) {
      const result = runSimulation(seed, ticks, distType);
      resultsByType.get(distType)!.push(result);
    }
  }

  // 集計
  console.log('\n=== 集計結果 ===\n');
  console.log('分布タイプ\t人口\tArtifact\t最大クラスタ\tクラスタ係数\t占有率\t上位3ノード\t文明スコア');
  
  for (const distType of distributionTypes) {
    const results = resultsByType.get(distType)!;
    const avg = {
      finalPopulation: results.reduce((sum, r) => sum + r.finalPopulation, 0) / results.length,
      artifactCount: results.reduce((sum, r) => sum + r.artifactCount, 0) / results.length,
      maxClusterSize: results.reduce((sum, r) => sum + r.maxClusterSize, 0) / results.length,
      clusteringCoefficient: results.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / results.length,
      occupiedNodeRatio: results.reduce((sum, r) => sum + r.occupiedNodeRatio, 0) / results.length,
      topNodePopulation: results.reduce((sum, r) => sum + r.topNodePopulation, 0) / results.length,
      civilizationScore: results.reduce((sum, r) => sum + r.civilizationScore, 0) / results.length,
    };
    
    console.log(
      `${distType}\t\t${avg.finalPopulation.toFixed(1)}\t${avg.artifactCount.toFixed(1)}\t\t` +
      `${avg.maxClusterSize.toFixed(1)}\t\t${avg.clusteringCoefficient.toFixed(3)}\t\t` +
      `${(avg.occupiedNodeRatio * 100).toFixed(1)}%\t${avg.topNodePopulation.toFixed(1)}\t\t` +
      `${avg.civilizationScore.toFixed(1)}/3`
    );
  }

  // 傾向分析
  console.log('\n=== 傾向分析 ===\n');
  
  const uniformResults = resultsByType.get('uniform')!;
  const extremeResults = resultsByType.get('extreme')!;
  
  const avgUniform = {
    clusteringCoefficient: uniformResults.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / uniformResults.length,
    finalPopulation: uniformResults.reduce((sum, r) => sum + r.finalPopulation, 0) / uniformResults.length,
    civilizationScore: uniformResults.reduce((sum, r) => sum + r.civilizationScore, 0) / uniformResults.length,
  };
  
  const avgExtreme = {
    clusteringCoefficient: extremeResults.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / extremeResults.length,
    finalPopulation: extremeResults.reduce((sum, r) => sum + r.finalPopulation, 0) / extremeResults.length,
    civilizationScore: extremeResults.reduce((sum, r) => sum + r.civilizationScore, 0) / extremeResults.length,
  };
  
  console.log('uniform vs extreme:');
  console.log(`  クラスタ係数: ${avgUniform.clusteringCoefficient.toFixed(3)} → ${avgExtreme.clusteringCoefficient.toFixed(3)}`);
  console.log(`  人口: ${avgUniform.finalPopulation.toFixed(1)} → ${avgExtreme.finalPopulation.toFixed(1)}`);
  console.log(`  文明スコア: ${avgUniform.civilizationScore.toFixed(1)}/3 → ${avgExtreme.civilizationScore.toFixed(1)}/3`);

  // 結論
  console.log('\n=== 結論 ===\n');
  
  const clusteringImprovement = avgExtreme.clusteringCoefficient - avgUniform.clusteringCoefficient;
  
  if (clusteringImprovement > 0.1) {
    console.log('✓ H34を支持: 資源の偏り（少ないノード）でクラスタ係数が向上');
    console.log(`  クラスタ係数の改善: +${(clusteringImprovement * 100).toFixed(1)}%`);
  } else if (clusteringImprovement > 0) {
    console.log('△ H34を部分的に支持: 資源の偏りでクラスタ係数が微増');
    console.log(`  クラスタ係数の改善: +${(clusteringImprovement * 100).toFixed(1)}%`);
  } else {
    console.log('✗ H34を支持しない: 資源の偏りはクラスタ係数に影響しない');
  }
  
  // 文明スコアの比較
  if (avgExtreme.civilizationScore > avgUniform.civilizationScore) {
    console.log('\n✓ 資源の偏りは文明スコアを向上させる');
  } else {
    console.log('\n△ 資源の偏りは文明スコアに大きな影響を与えない');
  }
}

main().catch(console.error);
