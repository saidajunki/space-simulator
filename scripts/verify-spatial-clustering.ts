/**
 * 空間的クラスタ形成条件の検証スクリプト
 * 
 * 目的: どのようなパラメータで空間的クラスタが形成されるか
 * - エッジ密度（移動のしやすさ）
 * - ノード数（空間の広さ）
 * - 資源分布（均一 vs 偏り）
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface ClusteringResult {
  edgeDensity: number;
  nodeCount: number;
  finalPopulation: number;
  maxClusterSize: number;
  clusteringCoefficient: number;
  occupiedNodeRatio: number;
  avgEntitiesPerOccupiedNode: number;
}

function runSimulation(
  edgeDensity: number,
  nodeCount: number,
  seed: number,
  ticks: number
): ClusteringResult {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.018,
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
  let totalInOccupied = 0;
  
  for (const count of spatialDistribution.values()) {
    if (count > 0) {
      occupiedNodes++;
      totalInOccupied += count;
      maxClusterSize = Math.max(maxClusterSize, count);
    }
  }
  
  const occupiedNodeRatio = occupiedNodes / nodeCount;
  const avgEntitiesPerOccupiedNode = occupiedNodes > 0 ? totalInOccupied / occupiedNodes : 0;
  
  // クラスタリング係数: 最大クラスタに含まれる割合
  const clusteringCoefficient = stats.entityCount > 0 
    ? maxClusterSize / stats.entityCount 
    : 0;

  return {
    edgeDensity,
    nodeCount,
    finalPopulation: stats.entityCount,
    maxClusterSize,
    clusteringCoefficient,
    occupiedNodeRatio,
    avgEntitiesPerOccupiedNode,
  };
}

async function main() {
  console.log('=== 空間的クラスタ形成条件の検証 ===\n');
  console.log('目的: どのようなパラメータで空間的クラスタが形成されるか\n');

  const edgeDensities = [0.1, 0.2, 0.3, 0.5, 0.7];
  const nodeCounts = [15, 30, 50];
  const seeds = [42, 123, 456];
  const ticks = 5000;

  console.log('=== エッジ密度の影響 ===\n');
  console.log('エッジ密度\t人口\t最大クラスタ\tクラスタ係数\t占有率\t平均/ノード');
  
  for (const edgeDensity of edgeDensities) {
    const results: ClusteringResult[] = [];
    for (const seed of seeds) {
      results.push(runSimulation(edgeDensity, 30, seed, ticks));
    }
    
    const avg = {
      finalPopulation: results.reduce((sum, r) => sum + r.finalPopulation, 0) / results.length,
      maxClusterSize: results.reduce((sum, r) => sum + r.maxClusterSize, 0) / results.length,
      clusteringCoefficient: results.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / results.length,
      occupiedNodeRatio: results.reduce((sum, r) => sum + r.occupiedNodeRatio, 0) / results.length,
      avgEntitiesPerOccupiedNode: results.reduce((sum, r) => sum + r.avgEntitiesPerOccupiedNode, 0) / results.length,
    };
    
    console.log(
      `${edgeDensity}\t\t${avg.finalPopulation.toFixed(1)}\t${avg.maxClusterSize.toFixed(1)}\t\t` +
      `${avg.clusteringCoefficient.toFixed(3)}\t\t${(avg.occupiedNodeRatio * 100).toFixed(1)}%\t` +
      `${avg.avgEntitiesPerOccupiedNode.toFixed(2)}`
    );
  }

  console.log('\n=== ノード数の影響 ===\n');
  console.log('ノード数\t人口\t最大クラスタ\tクラスタ係数\t占有率\t平均/ノード');
  
  for (const nodeCount of nodeCounts) {
    const results: ClusteringResult[] = [];
    for (const seed of seeds) {
      results.push(runSimulation(0.3, nodeCount, seed, ticks));
    }
    
    const avg = {
      finalPopulation: results.reduce((sum, r) => sum + r.finalPopulation, 0) / results.length,
      maxClusterSize: results.reduce((sum, r) => sum + r.maxClusterSize, 0) / results.length,
      clusteringCoefficient: results.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / results.length,
      occupiedNodeRatio: results.reduce((sum, r) => sum + r.occupiedNodeRatio, 0) / results.length,
      avgEntitiesPerOccupiedNode: results.reduce((sum, r) => sum + r.avgEntitiesPerOccupiedNode, 0) / results.length,
    };
    
    console.log(
      `${nodeCount}\t\t${avg.finalPopulation.toFixed(1)}\t${avg.maxClusterSize.toFixed(1)}\t\t` +
      `${avg.clusteringCoefficient.toFixed(3)}\t\t${(avg.occupiedNodeRatio * 100).toFixed(1)}%\t` +
      `${avg.avgEntitiesPerOccupiedNode.toFixed(2)}`
    );
  }

  // 最適条件の探索
  console.log('\n=== 最適条件の探索 ===\n');
  
  let bestResult: ClusteringResult | null = null;
  let bestScore = 0;
  
  for (const edgeDensity of [0.1, 0.15, 0.2, 0.25, 0.3]) {
    for (const nodeCount of [10, 15, 20, 25, 30]) {
      const results: ClusteringResult[] = [];
      for (const seed of seeds) {
        results.push(runSimulation(edgeDensity, nodeCount, seed, ticks));
      }
      
      const avgClustering = results.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / results.length;
      const avgPopulation = results.reduce((sum, r) => sum + r.finalPopulation, 0) / results.length;
      
      // スコア = クラスタリング係数 × 人口（両方高いのが良い）
      const score = avgClustering * avgPopulation;
      
      if (score > bestScore) {
        bestScore = score;
        bestResult = {
          edgeDensity,
          nodeCount,
          finalPopulation: avgPopulation,
          maxClusterSize: results.reduce((sum, r) => sum + r.maxClusterSize, 0) / results.length,
          clusteringCoefficient: avgClustering,
          occupiedNodeRatio: results.reduce((sum, r) => sum + r.occupiedNodeRatio, 0) / results.length,
          avgEntitiesPerOccupiedNode: results.reduce((sum, r) => sum + r.avgEntitiesPerOccupiedNode, 0) / results.length,
        };
      }
    }
  }
  
  if (bestResult) {
    console.log('最適条件:');
    console.log(`  エッジ密度: ${bestResult.edgeDensity}`);
    console.log(`  ノード数: ${bestResult.nodeCount}`);
    console.log(`  最終人口: ${bestResult.finalPopulation.toFixed(1)}`);
    console.log(`  最大クラスタ: ${bestResult.maxClusterSize.toFixed(1)}`);
    console.log(`  クラスタリング係数: ${bestResult.clusteringCoefficient.toFixed(3)}`);
    console.log(`  占有率: ${(bestResult.occupiedNodeRatio * 100).toFixed(1)}%`);
  }

  // 結論
  console.log('\n=== 結論 ===\n');
  
  if (bestResult && bestResult.clusteringCoefficient > 0.3) {
    console.log('✓ 空間的クラスタ形成の条件を特定');
    console.log(`  エッジ密度 ${bestResult.edgeDensity}、ノード数 ${bestResult.nodeCount} でクラスタリング係数 ${bestResult.clusteringCoefficient.toFixed(3)}`);
  } else if (bestResult && bestResult.clusteringCoefficient > 0.2) {
    console.log('△ 弱いクラスタ形成の条件を特定');
    console.log(`  エッジ密度 ${bestResult.edgeDensity}、ノード数 ${bestResult.nodeCount} でクラスタリング係数 ${bestResult.clusteringCoefficient.toFixed(3)}`);
  } else {
    console.log('✗ 強いクラスタ形成の条件は見つからなかった');
    console.log('  → 他のパラメータ（資源分布など）の影響を検討');
  }
}

main().catch(console.error);
