/**
 * 協力行動・情報伝達パターンの観察スクリプト
 * 
 * 目的: Q1「言語や協力は創発するか？」に接近
 * 
 * 観察項目:
 * 1. 相互作用の頻度と種類
 * 2. 情報伝達のパターン（誰から誰へ）
 * 3. 協力複製の発生頻度
 * 4. 空間的クラスタの形成（H1）
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface InteractionPattern {
  tick: number;
  entity1: string;
  entity2: string;
  type: string;
  nodeId: string;
}

interface SpatialCluster {
  nodeId: string;
  entityCount: number;
  artifactCount: number;
}

interface SimulationResult {
  seed: number;
  totalInteractions: number;
  totalReplications: number;
  cooperativeReplications: number;
  informationExchanges: number;
  informationInheritances: number;
  spatialClusters: SpatialCluster[];
  maxClusterSize: number;
  clusteringCoefficient: number;
}

function runSimulation(seed: number, ticks: number): SimulationResult {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.016, // 活発レジーム
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: 50,
      edgeDensity: 0.3,
    },
  });

  let totalInteractions = 0;
  let totalReplications = 0;
  let cooperativeReplications = 0;
  let informationExchanges = 0;
  let informationInheritances = 0;

  // シミュレーション実行
  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    // イベントログを取得
    const events = universe.getEventLog();
    
    for (const event of events) {
      if (event.type === 'interaction') {
        totalInteractions++;
        // 情報交換があったかチェック
        const interactionEvent = event as any;
        if (interactionEvent.exchangedBytesA || interactionEvent.exchangedBytesB) {
          informationExchanges++;
        }
      } else if (event.type === 'replication') {
        totalReplications++;
        // 情報継承があったかチェック
        const replicationEvent = event as any;
        if (replicationEvent.inheritedBytes) {
          informationInheritances++;
        }
      } else if (event.type === 'partnerSelected') {
        // 協力複製（パートナー選択）
        cooperativeReplications++;
      }
    }
  }

  // 空間分布を取得
  const stats = universe.getStats();
  const spatialClusters: SpatialCluster[] = [];
  
  // ノードごとのエンティティ数を集計（statsから取得）
  const spatialDistribution = stats.spatialDistribution;
  for (const [nodeId, count] of spatialDistribution.entries()) {
    if (count > 0) {
      spatialClusters.push({
        nodeId,
        entityCount: count,
        artifactCount: 0, // 簡略化
      });
    }
  }

  // クラスタリング係数を計算（エンティティが集中している度合い）
  const totalEntities = spatialClusters.reduce((sum, c) => sum + c.entityCount, 0);
  const maxClusterSize = spatialClusters.length > 0 
    ? Math.max(...spatialClusters.map(c => c.entityCount))
    : 0;
  
  // ジニ係数的な指標（0=均等分布、1=完全集中）
  let clusteringCoefficient = 0;
  if (totalEntities > 0 && spatialClusters.length > 1) {
    const avgPerNode = totalEntities / spatialClusters.length;
    const variance = spatialClusters.reduce((sum, c) => sum + Math.pow(c.entityCount - avgPerNode, 2), 0) / spatialClusters.length;
    clusteringCoefficient = Math.sqrt(variance) / avgPerNode;
  }

  return {
    seed,
    totalInteractions,
    totalReplications,
    cooperativeReplications,
    informationExchanges,
    informationInheritances,
    spatialClusters,
    maxClusterSize,
    clusteringCoefficient,
  };
}

async function main() {
  console.log('=== 協力行動・情報伝達パターンの観察 ===\n');
  console.log('目的: Q1「言語や協力は創発するか？」に接近\n');

  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 10000;

  const results: SimulationResult[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed}...`);
    const result = runSimulation(seed, ticks);
    results.push(result);
    
    console.log(`  相互作用: ${result.totalInteractions}`);
    console.log(`  複製: ${result.totalReplications} (協力: ${result.cooperativeReplications})`);
    console.log(`  情報交換: ${result.informationExchanges}`);
    console.log(`  情報継承: ${result.informationInheritances}`);
    console.log(`  最大クラスタサイズ: ${result.maxClusterSize}`);
    console.log(`  クラスタリング係数: ${result.clusteringCoefficient.toFixed(3)}`);
    console.log();
  }

  // 集計
  console.log('\n=== 集計結果 ===\n');
  
  const avgInteractions = results.reduce((sum, r) => sum + r.totalInteractions, 0) / results.length;
  const avgReplications = results.reduce((sum, r) => sum + r.totalReplications, 0) / results.length;
  const avgCooperative = results.reduce((sum, r) => sum + r.cooperativeReplications, 0) / results.length;
  const avgInfoExchange = results.reduce((sum, r) => sum + r.informationExchanges, 0) / results.length;
  const avgInfoInherit = results.reduce((sum, r) => sum + r.informationInheritances, 0) / results.length;
  const avgMaxCluster = results.reduce((sum, r) => sum + r.maxClusterSize, 0) / results.length;
  const avgClustering = results.reduce((sum, r) => sum + r.clusteringCoefficient, 0) / results.length;
  
  console.log(`平均相互作用: ${avgInteractions.toFixed(1)}`);
  console.log(`平均複製: ${avgReplications.toFixed(1)}`);
  console.log(`平均協力複製: ${avgCooperative.toFixed(1)} (${(avgCooperative / avgReplications * 100).toFixed(1)}%)`);
  console.log(`平均情報交換: ${avgInfoExchange.toFixed(1)}`);
  console.log(`平均情報継承: ${avgInfoInherit.toFixed(1)}`);
  console.log(`平均最大クラスタサイズ: ${avgMaxCluster.toFixed(1)}`);
  console.log(`平均クラスタリング係数: ${avgClustering.toFixed(3)}`);

  // 結論
  console.log('\n=== 結論 ===\n');
  
  if (avgCooperative > 0) {
    console.log('✓ 協力複製が観察された');
    console.log(`  協力複製率: ${(avgCooperative / avgReplications * 100).toFixed(1)}%`);
  } else {
    console.log('✗ 協力複製は観察されなかった');
  }
  
  if (avgInfoExchange > 0) {
    console.log('✓ 情報交換が観察された');
    console.log(`  平均情報交換回数: ${avgInfoExchange.toFixed(1)}`);
  } else {
    console.log('✗ 情報交換は観察されなかった');
  }
  
  if (avgClustering > 0.5) {
    console.log('✓ 空間的クラスタが形成された（H1を支持）');
    console.log(`  クラスタリング係数: ${avgClustering.toFixed(3)}`);
  } else if (avgClustering > 0.2) {
    console.log('△ 弱い空間的クラスタが観察された');
    console.log(`  クラスタリング係数: ${avgClustering.toFixed(3)}`);
  } else {
    console.log('✗ 空間的クラスタは形成されなかった');
    console.log(`  クラスタリング係数: ${avgClustering.toFixed(3)}`);
  }
}

main().catch(console.error);
