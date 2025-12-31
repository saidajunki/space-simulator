/**
 * H36検証: 文明発達には「適度な分散」が必要
 * 
 * 仮説: 資源の偏りはクラスタ係数を高めるが、文明スコアを低下させる。
 *       文明発達には「適度な分散」（多くのノード、均一な資源分布）が必要。
 * 
 * 検証方法:
 * 1. 異なるノード数・エッジ密度でシミュレーションを実行
 * 2. 空間的分散度と文明スコアの関係を分析
 * 3. 最適な分散度を特定
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface DispersionResult {
  nodeCount: number;
  edgeDensity: number;
  avgPop: number;
  artPerCapita: number;
  clusteringCoeff: number;
  spatialGini: number;
  civilizationScore: number;
  cooperationRate: number;
  avgEnergy: number;
}

function calculateClusteringCoefficient(spatialDist: Map<string, number>, totalPop: number): number {
  if (totalPop <= 1) return 0;
  
  const values = Array.from(spatialDist.values());
  const nonEmpty = values.filter(v => v > 0);
  
  if (nonEmpty.length <= 1) return 1.0; // 全員が1ノードに集中
  
  // 集中度を計算（HHI: Herfindahl-Hirschman Index）
  const shares = values.map(v => v / totalPop);
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);
  
  return hhi;
}

function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  if (sum === 0) return 0;
  
  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    giniSum += (2 * (i + 1) - n - 1) * sorted[i]!;
  }
  
  return giniSum / (n * sum);
}

function runSimulation(nodeCount: number, edgeDensity: number, seed: number, ticks: number): DispersionResult {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount,
      edgeDensity,
      initialEntityCount: 50,
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
  let totalEnergy = 0;
  let energySamples = 0;
  let partnerSelections = 0;
  let replications = 0;
  let totalClusteringCoeff = 0;
  let clusteringSamples = 0;
  let totalGini = 0;
  let giniSamples = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    totalPop += stats.entityCount;
    popSamples++;
    
    if (stats.entityCount > 0 && stats.entityEnergy !== undefined) {
      totalEnergy += stats.entityEnergy;
      energySamples += stats.entityCount;
    }
    
    // クラスタリング係数とジニ係数を計算
    if (stats.entityCount > 0) {
      const clusterCoeff = calculateClusteringCoefficient(stats.spatialDistribution, stats.entityCount);
      totalClusteringCoeff += clusterCoeff;
      clusteringSamples++;
      
      const gini = calculateGini(Array.from(stats.spatialDistribution.values()));
      totalGini += gini;
      giniSamples++;
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
  const avgClusteringCoeff = clusteringSamples > 0 ? totalClusteringCoeff / clusteringSamples : 0;
  const avgGini = giniSamples > 0 ? totalGini / giniSamples : 0;
  
  // 文明スコア計算
  let civScore = 0;
  if (avgPop >= 10) civScore++;
  if (finalStats.artifactCount / avgPop >= 5) civScore++;
  if (coopRate >= 50) civScore++;
  if (avgClusteringCoeff >= 0.3) civScore++;

  return {
    nodeCount,
    edgeDensity,
    avgPop,
    artPerCapita: avgPop > 0 ? finalStats.artifactCount / avgPop : 0,
    clusteringCoeff: avgClusteringCoeff,
    spatialGini: avgGini,
    civilizationScore: civScore,
    cooperationRate: coopRate,
    avgEnergy,
  };
}

async function main() {
  console.log('=== H36検証: 適度な分散と文明発達の関係 ===\n');
  
  // ノード数とエッジ密度の組み合わせ
  const nodeCounts = [10, 20, 30, 50, 70];
  const edgeDensities = [0.2, 0.4, 0.6];
  const seeds = [42, 123, 456];
  const ticks = 3000;
  
  const allResults: DispersionResult[] = [];
  
  for (const nodeCount of nodeCounts) {
    for (const edgeDensity of edgeDensities) {
      console.log(`\n--- ノード数: ${nodeCount}, エッジ密度: ${edgeDensity} ---`);
      
      const results: DispersionResult[] = [];
      for (const seed of seeds) {
        console.log(`  Seed ${seed}...`);
        const result = runSimulation(nodeCount, edgeDensity, seed, ticks);
        results.push(result);
        console.log(`    人口: ${result.avgPop.toFixed(1)}, Art/人: ${result.artPerCapita.toFixed(2)}, クラスタ係数: ${result.clusteringCoeff.toFixed(3)}, 文明スコア: ${result.civilizationScore}`);
      }
      
      // 平均を計算
      const avgResult: DispersionResult = {
        nodeCount,
        edgeDensity,
        avgPop: results.reduce((s, r) => s + r.avgPop, 0) / results.length,
        artPerCapita: results.reduce((s, r) => s + r.artPerCapita, 0) / results.length,
        clusteringCoeff: results.reduce((s, r) => s + r.clusteringCoeff, 0) / results.length,
        spatialGini: results.reduce((s, r) => s + r.spatialGini, 0) / results.length,
        civilizationScore: results.reduce((s, r) => s + r.civilizationScore, 0) / results.length,
        cooperationRate: results.reduce((s, r) => s + r.cooperationRate, 0) / results.length,
        avgEnergy: results.reduce((s, r) => s + r.avgEnergy, 0) / results.length,
      };
      
      allResults.push(avgResult);
    }
  }
  
  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  console.log('| ノード数 | エッジ密度 | 平均人口 | Art/人 | クラスタ係数 | ジニ係数 | 文明スコア | 協力率(%) |');
  console.log('|----------|------------|----------|--------|--------------|----------|------------|-----------|');
  
  for (const r of allResults) {
    console.log(`| ${r.nodeCount.toString().padStart(8)} | ${r.edgeDensity.toFixed(1).padStart(10)} | ${r.avgPop.toFixed(1).padStart(8)} | ${r.artPerCapita.toFixed(2).padStart(6)} | ${r.clusteringCoeff.toFixed(3).padStart(12)} | ${r.spatialGini.toFixed(3).padStart(8)} | ${r.civilizationScore.toFixed(1).padStart(10)} | ${r.cooperationRate.toFixed(1).padStart(9)} |`);
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===\n');
  
  const nodeCounts2 = allResults.map(r => r.nodeCount);
  const civScores = allResults.map(r => r.civilizationScore);
  const artPerCapitas = allResults.map(r => r.artPerCapita);
  const clusteringCoeffs = allResults.map(r => r.clusteringCoeff);
  const ginis = allResults.map(r => r.spatialGini);
  const avgPops = allResults.map(r => r.avgPop);
  
  const corrNodeCiv = calculateCorrelation(nodeCounts2, civScores);
  const corrNodeArt = calculateCorrelation(nodeCounts2, artPerCapitas);
  const corrNodeCluster = calculateCorrelation(nodeCounts2, clusteringCoeffs);
  const corrClusterCiv = calculateCorrelation(clusteringCoeffs, civScores);
  const corrGiniCiv = calculateCorrelation(ginis, civScores);
  const corrPopCiv = calculateCorrelation(avgPops, civScores);
  
  console.log(`ノード数 vs 文明スコア 相関: ${corrNodeCiv.toFixed(3)}`);
  console.log(`ノード数 vs Art/人 相関: ${corrNodeArt.toFixed(3)}`);
  console.log(`ノード数 vs クラスタ係数 相関: ${corrNodeCluster.toFixed(3)}`);
  console.log(`クラスタ係数 vs 文明スコア 相関: ${corrClusterCiv.toFixed(3)}`);
  console.log(`ジニ係数 vs 文明スコア 相関: ${corrGiniCiv.toFixed(3)}`);
  console.log(`平均人口 vs 文明スコア 相関: ${corrPopCiv.toFixed(3)}`);
  
  // 最適条件の特定
  console.log('\n\n=== 最適条件 ===\n');
  
  const bestCiv = allResults.reduce((best, r) => r.civilizationScore > best.civilizationScore ? r : best);
  const bestArt = allResults.reduce((best, r) => r.artPerCapita > best.artPerCapita ? r : best);
  
  console.log(`最高文明スコア: ${bestCiv.civilizationScore.toFixed(1)} (ノード数=${bestCiv.nodeCount}, エッジ密度=${bestCiv.edgeDensity})`);
  console.log(`最高Art/人: ${bestArt.artPerCapita.toFixed(2)} (ノード数=${bestArt.nodeCount}, エッジ密度=${bestArt.edgeDensity})`);
  
  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  if (corrNodeCiv > 0.3) {
    console.log('H36を支持: ノード数（分散度）と文明スコアに正の相関がある');
  } else if (corrNodeCiv < -0.3) {
    console.log('H36を棄却: ノード数（分散度）と文明スコアに負の相関がある');
  } else {
    console.log('H36は不明確: ノード数と文明スコアの相関が弱い');
  }
  
  if (corrClusterCiv < -0.3) {
    console.log('追加発見: クラスタ係数と文明スコアに負の相関（分散が有利）');
  } else if (corrClusterCiv > 0.3) {
    console.log('追加発見: クラスタ係数と文明スコアに正の相関（集中が有利）');
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
