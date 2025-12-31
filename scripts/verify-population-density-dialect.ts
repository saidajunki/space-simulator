/**
 * H71/H72検証: 人口密度と方言圏の関係
 * 
 * H71: 方言圏の形成には「適度な人口密度」が必要
 * H72: 方言圏数は「人口/ノード数」の比率で決まる
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface DialectResult {
  nodeCount: number;
  initialPop: number;
  seed: number;
  finalPop: number;
  occupiedNodes: number;
  populationDensity: number;  // 人口/ノード数
  dialectCount: number;
  similarityRatio: number;
  intraNodeSimilarity: number;
  interNodeSimilarity: number;
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

function runSimulation(nodeCount: number, initialPop: number, seed: number): DialectResult {
  const config: UniverseConfig = {
    seed,
    nodeCount,
    edgeDensity: 0.3,
    initialEntityCount: initialPop,
    resourceRegenerationRate: 0.020,  // H67と同じ値
    enableToolEffect: true,
    enableStateFeatures: true,
  };

  const universe = new Universe(config);
  const totalTicks = 5000;

  for (let t = 0; t < totalTicks; t++) {
    universe.step();
    universe.clearEventLog();
  }

  const entities = universe.getAllEntities();
  const finalPop = entities.length;

  // ノード別にエンティティを分類
  const nodeEntities = new Map<string, typeof entities>();
  for (const entity of entities) {
    const nodeId = entity.nodeId;
    if (!nodeEntities.has(nodeId)) {
      nodeEntities.set(nodeId, []);
    }
    nodeEntities.get(nodeId)!.push(entity);
  }

  const occupiedNodes = nodeEntities.size;
  const populationDensity = finalPop / nodeCount;

  // ノード内類似度を計算
  let totalIntraSimilarity = 0;
  let intraPairCount = 0;
  let dialectCount = 0;

  for (const [nodeId, nodeEnts] of nodeEntities) {
    if (nodeEnts.length < 2) continue;

    let nodeSimilaritySum = 0;
    let nodePairCount = 0;

    for (let i = 0; i < nodeEnts.length; i++) {
      for (let j = i + 1; j < nodeEnts.length; j++) {
        const state1 = nodeEnts[i].state.getData();
        const state2 = nodeEnts[j].state.getData();
        const similarity = calculateStateSimilarity(state1, state2);
        nodeSimilaritySum += similarity;
        nodePairCount++;
        totalIntraSimilarity += similarity;
        intraPairCount++;
      }
    }

    // 方言圏の判定（ノード内平均類似度 >= 0.1）
    if (nodePairCount > 0) {
      const avgNodeSimilarity = nodeSimilaritySum / nodePairCount;
      if (avgNodeSimilarity >= 0.1) {
        dialectCount++;
      }
    }
  }

  const intraNodeSimilarity = intraPairCount > 0 ? totalIntraSimilarity / intraPairCount : 0;

  // ノード間類似度を計算
  let totalInterSimilarity = 0;
  let interPairCount = 0;

  const nodeIds = Array.from(nodeEntities.keys());
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const ents1 = nodeEntities.get(nodeIds[i])!;
      const ents2 = nodeEntities.get(nodeIds[j])!;

      for (const e1 of ents1) {
        for (const e2 of ents2) {
          const state1 = e1.state.getData();
          const state2 = e2.state.getData();
          const similarity = calculateStateSimilarity(state1, state2);
          totalInterSimilarity += similarity;
          interPairCount++;
        }
      }
    }
  }

  const interNodeSimilarity = interPairCount > 0 ? totalInterSimilarity / interPairCount : 0;
  const similarityRatio = interNodeSimilarity > 0 ? intraNodeSimilarity / interNodeSimilarity : 0;

  return {
    nodeCount,
    initialPop,
    seed,
    finalPop,
    occupiedNodes,
    populationDensity,
    dialectCount,
    similarityRatio,
    intraNodeSimilarity,
    interNodeSimilarity,
  };
}

async function main() {
  console.log('=== H71/H72検証: 人口密度と方言圏の関係 ===\n');

  // ノード数を変えて人口密度を変化させる
  const nodeCounts = [10, 20, 30, 50, 80];
  const initialPop = 100;  // 初期人口は固定
  const seeds = [42, 123, 789];

  const results: DialectResult[] = [];

  for (const nodeCount of nodeCounts) {
    for (const seed of seeds) {
      console.log(`Running: nodeCount=${nodeCount}, seed=${seed}...`);
      const result = runSimulation(nodeCount, initialPop, seed);
      results.push(result);
      console.log(`  finalPop=${result.finalPop}, density=${result.populationDensity.toFixed(2)}, dialects=${result.dialectCount}`);
    }
  }

  // ノード数別に集計
  console.log('\n=== ノード数別集計 ===\n');
  console.log('| ノード数 | 最終人口 | 人口密度 | 占有ノード | 方言圏数 | 類似度比率 |');
  console.log('|---------|---------|---------|-----------|---------|-----------|');

  const nodeCountGroups = new Map<number, DialectResult[]>();
  for (const r of results) {
    if (!nodeCountGroups.has(r.nodeCount)) {
      nodeCountGroups.set(r.nodeCount, []);
    }
    nodeCountGroups.get(r.nodeCount)!.push(r);
  }

  const avgByNodeCount: { nodeCount: number; avgDensity: number; avgDialects: number; avgRatio: number }[] = [];

  for (const [nodeCount, group] of nodeCountGroups) {
    const avgPop = group.reduce((s, r) => s + r.finalPop, 0) / group.length;
    const avgDensity = group.reduce((s, r) => s + r.populationDensity, 0) / group.length;
    const avgOccupied = group.reduce((s, r) => s + r.occupiedNodes, 0) / group.length;
    const avgDialects = group.reduce((s, r) => s + r.dialectCount, 0) / group.length;
    const avgRatio = group.reduce((s, r) => s + r.similarityRatio, 0) / group.length;

    console.log(`| ${nodeCount} | ${avgPop.toFixed(1)} | ${avgDensity.toFixed(2)} | ${avgOccupied.toFixed(1)} | ${avgDialects.toFixed(1)} | ${avgRatio.toFixed(1)}x |`);

    avgByNodeCount.push({ nodeCount, avgDensity, avgDialects, avgRatio });
  }

  // 相関分析
  console.log('\n=== 相関分析 ===\n');

  const densities = results.map(r => r.populationDensity);
  const dialects = results.map(r => r.dialectCount);
  const ratios = results.map(r => r.similarityRatio);
  const populations = results.map(r => r.finalPop);

  function correlation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den === 0 ? 0 : num / den;
  }

  console.log(`人口密度 vs 方言圏数: ${correlation(densities, dialects).toFixed(3)}`);
  console.log(`人口密度 vs 類似度比率: ${correlation(densities, ratios).toFixed(3)}`);
  console.log(`最終人口 vs 方言圏数: ${correlation(populations, dialects).toFixed(3)}`);
  console.log(`ノード数 vs 方言圏数: ${correlation(results.map(r => r.nodeCount), dialects).toFixed(3)}`);

  // 最適な人口密度の探索
  console.log('\n=== 最適な人口密度の探索 ===\n');

  // 方言圏数が最大になる人口密度を探す
  let maxDialects = 0;
  let optimalDensity = 0;
  let optimalNodeCount = 0;

  for (const { nodeCount, avgDensity, avgDialects } of avgByNodeCount) {
    if (avgDialects > maxDialects) {
      maxDialects = avgDialects;
      optimalDensity = avgDensity;
      optimalNodeCount = nodeCount;
    }
  }

  console.log(`最大方言圏数: ${maxDialects.toFixed(1)}`);
  console.log(`最適人口密度: ${optimalDensity.toFixed(2)}`);
  console.log(`最適ノード数: ${optimalNodeCount}`);

  // 結論
  console.log('\n=== 結論 ===\n');

  const densityDialectCorr = correlation(densities, dialects);
  const nodeDialectCorr = correlation(results.map(r => r.nodeCount), dialects);

  if (Math.abs(densityDialectCorr) > 0.5) {
    if (densityDialectCorr > 0) {
      console.log('H71: 棄却 - 人口密度が高いほど方言圏が多い（正の相関）');
    } else {
      console.log('H71: 支持 - 人口密度が高いと方言圏が減る（負の相関）');
      console.log('  → 「適度な人口密度」が必要という仮説を支持');
    }
  } else {
    console.log('H71: 不明確 - 人口密度と方言圏数の相関が弱い');
  }

  if (Math.abs(nodeDialectCorr) > 0.5) {
    console.log(`H72: 支持 - ノード数と方言圏数に相関あり（${nodeDialectCorr.toFixed(3)}）`);
    console.log('  → 方言圏数は空間的な広がり（ノード数）に依存');
  } else {
    console.log('H72: 不明確 - ノード数と方言圏数の相関が弱い');
  }
}

main().catch(console.error);
