/**
 * H75検証: 方言圏は長期的に安定する
 * 
 * 長期シミュレーションで方言圏の安定性を観察する
 * - 方言圏の形成・消滅パターン
 * - 方言圏の持続時間
 * - 方言圏間の「言語接触」（移動による混合）
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface DialectSnapshot {
  tick: number;
  dialectCount: number;
  occupiedNodes: number;
  population: number;
  intraNodeSimilarity: number;
  interNodeSimilarity: number;
  similarityRatio: number;
  dialectNodes: string[];  // 方言圏を形成しているノードID
}

function calculateStateSimilarity(state1: Uint8Array, state2: Uint8Array): number {
  if (state1.length === 0 || state2.length === 0) return 0;
  const minLen = Math.min(state1.length, state2.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (state1[i] === state2[i]) matches++;
  }
  return matches / minLen;
}

function analyzeDialects(universe: Universe): { 
  dialectCount: number; 
  occupiedNodes: number;
  intraNodeSimilarity: number;
  interNodeSimilarity: number;
  dialectNodes: string[];
} {
  const entities = universe.getAllEntities();
  
  // ノード別にエンティティを分類
  const nodeEntities = new Map<string, Uint8Array[]>();
  for (const entity of entities) {
    const stateData = entity.state.getData();
    if (stateData.length === 0) continue;
    if (!nodeEntities.has(entity.nodeId)) {
      nodeEntities.set(entity.nodeId, []);
    }
    nodeEntities.get(entity.nodeId)!.push(new Uint8Array(stateData));
  }

  const occupiedNodes = nodeEntities.size;

  // ノード内類似度と方言圏の特定
  let totalIntraSimilarity = 0;
  let intraPairCount = 0;
  const dialectNodes: string[] = [];

  for (const [nodeId, states] of nodeEntities) {
    if (states.length < 2) continue;

    let nodeSimilaritySum = 0;
    let nodePairCount = 0;

    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const similarity = calculateStateSimilarity(states[i], states[j]);
        nodeSimilaritySum += similarity;
        nodePairCount++;
        totalIntraSimilarity += similarity;
        intraPairCount++;
      }
    }

    if (nodePairCount > 0) {
      const avgNodeSimilarity = nodeSimilaritySum / nodePairCount;
      if (avgNodeSimilarity >= 0.1) {
        dialectNodes.push(nodeId);
      }
    }
  }

  const intraNodeSimilarity = intraPairCount > 0 ? totalIntraSimilarity / intraPairCount : 0;

  // ノード間類似度
  let totalInterSimilarity = 0;
  let interPairCount = 0;

  const nodeIds = Array.from(nodeEntities.keys());
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const states1 = nodeEntities.get(nodeIds[i])!;
      const states2 = nodeEntities.get(nodeIds[j])!;

      const maxPairs = Math.min(20, states1.length * states2.length);
      for (let k = 0; k < maxPairs; k++) {
        const s1 = states1[Math.floor(Math.random() * states1.length)];
        const s2 = states2[Math.floor(Math.random() * states2.length)];
        const similarity = calculateStateSimilarity(s1, s2);
        totalInterSimilarity += similarity;
        interPairCount++;
      }
    }
  }

  const interNodeSimilarity = interPairCount > 0 ? totalInterSimilarity / interPairCount : 0;

  return {
    dialectCount: dialectNodes.length,
    occupiedNodes,
    intraNodeSimilarity,
    interNodeSimilarity,
    dialectNodes,
  };
}

function runSimulation(seed: number): DialectSnapshot[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 20,
      edgeDensity: 0.3,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: 0.020,
    toolEffectEnabled: true,
    skillBonusEnabled: true,
  };

  const universe = new Universe(config);
  const totalTicks = 10000;
  const snapshotInterval = 500;
  const snapshots: DialectSnapshot[] = [];

  for (let t = 0; t <= totalTicks; t++) {
    if (t > 0) {
      universe.step();
      universe.clearEventLog();
    }

    if (t % snapshotInterval === 0) {
      const entities = universe.getAllEntities();
      const analysis = analyzeDialects(universe);
      
      const similarityRatio = analysis.interNodeSimilarity > 0 
        ? analysis.intraNodeSimilarity / analysis.interNodeSimilarity 
        : 0;

      snapshots.push({
        tick: t,
        dialectCount: analysis.dialectCount,
        occupiedNodes: analysis.occupiedNodes,
        population: entities.length,
        intraNodeSimilarity: analysis.intraNodeSimilarity,
        interNodeSimilarity: analysis.interNodeSimilarity,
        similarityRatio,
        dialectNodes: analysis.dialectNodes,
      });
    }
  }

  return snapshots;
}

function analyzeStability(snapshots: DialectSnapshot[]): {
  avgDialectCount: number;
  dialectCountStdDev: number;
  dialectPersistence: number;  // 方言圏の持続率
  dialectTurnover: number;     // 方言圏の入れ替わり率
} {
  const dialectCounts = snapshots.map(s => s.dialectCount);
  const avgDialectCount = dialectCounts.reduce((a, b) => a + b, 0) / dialectCounts.length;
  const dialectCountStdDev = Math.sqrt(
    dialectCounts.reduce((s, d) => s + (d - avgDialectCount) ** 2, 0) / dialectCounts.length
  );

  // 方言圏の持続率と入れ替わり率を計算
  let persistedCount = 0;
  let totalPossiblePersistence = 0;
  let turnoverCount = 0;

  for (let i = 1; i < snapshots.length; i++) {
    const prevNodes = new Set(snapshots[i - 1].dialectNodes);
    const currNodes = new Set(snapshots[i].dialectNodes);

    // 前回から持続している方言圏
    for (const node of prevNodes) {
      totalPossiblePersistence++;
      if (currNodes.has(node)) {
        persistedCount++;
      } else {
        turnoverCount++;
      }
    }

    // 新しく形成された方言圏
    for (const node of currNodes) {
      if (!prevNodes.has(node)) {
        turnoverCount++;
      }
    }
  }

  const dialectPersistence = totalPossiblePersistence > 0 
    ? persistedCount / totalPossiblePersistence 
    : 0;
  const dialectTurnover = turnoverCount / (snapshots.length - 1);

  return {
    avgDialectCount,
    dialectCountStdDev,
    dialectPersistence,
    dialectTurnover,
  };
}

async function main() {
  console.log('=== H75検証: 方言圏は長期的に安定する ===\n');

  const seeds = [42, 123, 456, 789, 1000];
  const allResults: { seed: number; snapshots: DialectSnapshot[]; stability: ReturnType<typeof analyzeStability> }[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const snapshots = runSimulation(seed);
    const stability = analyzeStability(snapshots);
    allResults.push({ seed, snapshots, stability });

    console.log(`  平均方言圏数: ${stability.avgDialectCount.toFixed(1)}`);
    console.log(`  方言圏持続率: ${(stability.dialectPersistence * 100).toFixed(1)}%`);
    console.log(`  方言圏入れ替わり: ${stability.dialectTurnover.toFixed(2)}/スナップショット`);
  }

  // 統計分析
  console.log('\n=== 統計分析 ===\n');

  const avgPersistence = allResults.reduce((s, r) => s + r.stability.dialectPersistence, 0) / allResults.length;
  const avgTurnover = allResults.reduce((s, r) => s + r.stability.dialectTurnover, 0) / allResults.length;
  const avgDialectCount = allResults.reduce((s, r) => s + r.stability.avgDialectCount, 0) / allResults.length;

  console.log(`全体平均:`);
  console.log(`  方言圏数: ${avgDialectCount.toFixed(1)}`);
  console.log(`  持続率: ${(avgPersistence * 100).toFixed(1)}%`);
  console.log(`  入れ替わり: ${avgTurnover.toFixed(2)}/スナップショット`);

  // 時系列での方言圏数の変化
  console.log('\n=== 時系列での方言圏数の変化 ===\n');

  const tickCount = allResults[0].snapshots.length;
  console.log('| Tick | ' + seeds.map(s => `Seed ${s}`).join(' | ') + ' | 平均 |');
  console.log('|------|' + seeds.map(() => '-----').join('|') + '|------|');

  for (let i = 0; i < tickCount; i++) {
    const tick = allResults[0].snapshots[i].tick;
    const counts = allResults.map(r => r.snapshots[i].dialectCount);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    console.log(`| ${tick} | ${counts.join(' | ')} | ${avg.toFixed(1)} |`);
  }

  // 結論
  console.log('\n=== 結論 ===\n');

  if (avgPersistence >= 0.8) {
    console.log('H75を強く支持: 方言圏は長期的に安定する');
    console.log(`  → 持続率${(avgPersistence * 100).toFixed(1)}%は非常に高い`);
  } else if (avgPersistence >= 0.5) {
    console.log('H75を支持: 方言圏は比較的安定している');
    console.log(`  → 持続率${(avgPersistence * 100).toFixed(1)}%は中程度`);
  } else {
    console.log('H75を棄却: 方言圏は不安定である');
    console.log(`  → 持続率${(avgPersistence * 100).toFixed(1)}%は低い`);
  }

  // 詳細データ
  console.log('\n=== 詳細データ ===\n');
  console.log('| Seed | 平均方言圏 | 標準偏差 | 持続率 | 入れ替わり |');
  console.log('|------|-----------|---------|--------|-----------|');
  for (const r of allResults) {
    console.log(`| ${r.seed} | ${r.stability.avgDialectCount.toFixed(1)} | ${r.stability.dialectCountStdDev.toFixed(2)} | ${(r.stability.dialectPersistence * 100).toFixed(1)}% | ${r.stability.dialectTurnover.toFixed(2)} |`);
  }
}

main().catch(console.error);
