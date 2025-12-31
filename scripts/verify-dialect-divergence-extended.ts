/**
 * H68追加検証: 方言圏の時間的分化（より長期・多seed）
 * 
 * H68を確立された結論に昇格させるための追加検証
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface TimePoint {
  tick: number;
  intraNodeSimilarity: number;
  interNodeSimilarity: number;
  similarityRatio: number;
  dialectCount: number;
  population: number;
  occupiedNodes: number;
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

function measureDialectState(universe: Universe): TimePoint {
  const entities = universe.getAllEntities();
  const population = entities.length;

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

  // ノード内類似度
  let totalIntraSimilarity = 0;
  let intraPairCount = 0;
  let dialectCount = 0;

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
        dialectCount++;
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

      // サンプリング
      const maxPairs = Math.min(50, states1.length * states2.length);
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
  const similarityRatio = interNodeSimilarity > 0 ? intraNodeSimilarity / interNodeSimilarity : 0;

  return {
    tick: 0,  // 後で設定
    intraNodeSimilarity,
    interNodeSimilarity,
    similarityRatio,
    dialectCount,
    population,
    occupiedNodes,
  };
}

async function runSimulation(seed: number): Promise<{ seed: number; timePoints: TimePoint[] }> {
  const config: UniverseConfig = {
    seed,
    nodeCount: 20,
    edgeDensity: 0.3,
    initialEntityCount: 50,
    resourceRegenerationRate: 0.020,
    enableToolEffect: true,
    enableStateFeatures: true,
  };

  const universe = new Universe(config);
  const totalTicks = 15000;  // より長期
  const measureInterval = 1500;  // 1500 tickごとに測定

  const timePoints: TimePoint[] = [];

  for (let t = 0; t < totalTicks; t++) {
    universe.step();
    universe.clearEventLog();

    if ((t + 1) % measureInterval === 0) {
      const point = measureDialectState(universe);
      point.tick = t + 1;
      timePoints.push(point);
    }
  }

  return { seed, timePoints };
}

async function main() {
  console.log('=== H68追加検証: 方言圏の時間的分化 ===\n');

  const seeds = [42, 123, 456, 789, 1000, 2024, 3000, 4000];  // 8 seed
  const results: { seed: number; timePoints: TimePoint[] }[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const result = await runSimulation(seed);
    results.push(result);
    
    const first = result.timePoints[0];
    const last = result.timePoints[result.timePoints.length - 1];
    console.log(`  初期: 比率${first.similarityRatio.toFixed(1)}x, 方言圏${first.dialectCount}`);
    console.log(`  最終: 比率${last.similarityRatio.toFixed(1)}x, 方言圏${last.dialectCount}`);
  }

  // 時系列分析
  console.log('\n=== 時系列分析 ===\n');

  // 各時点での平均
  const numPoints = results[0].timePoints.length;
  console.log('| Tick | 平均比率 | 平均方言圏 | 平均人口 |');
  console.log('|------|---------|-----------|---------|');

  for (let i = 0; i < numPoints; i++) {
    const tick = results[0].timePoints[i].tick;
    const avgRatio = results.reduce((s, r) => s + r.timePoints[i].similarityRatio, 0) / results.length;
    const avgDialects = results.reduce((s, r) => s + r.timePoints[i].dialectCount, 0) / results.length;
    const avgPop = results.reduce((s, r) => s + r.timePoints[i].population, 0) / results.length;
    console.log(`| ${tick} | ${avgRatio.toFixed(1)}x | ${avgDialects.toFixed(1)} | ${avgPop.toFixed(1)} |`);
  }

  // 変化の分析
  console.log('\n=== 変化の分析 ===\n');

  let ratioIncreased = 0;
  let dialectsIncreased = 0;

  for (const result of results) {
    const first = result.timePoints[0];
    const last = result.timePoints[result.timePoints.length - 1];
    
    if (last.similarityRatio > first.similarityRatio) ratioIncreased++;
    if (last.dialectCount > first.dialectCount) dialectsIncreased++;
  }

  console.log(`類似度比率が増加したseed: ${ratioIncreased}/${results.length} (${(ratioIncreased/results.length*100).toFixed(0)}%)`);
  console.log(`方言圏数が増加したseed: ${dialectsIncreased}/${results.length} (${(dialectsIncreased/results.length*100).toFixed(0)}%)`);

  // 時間-方言圏の相関
  const allTicks: number[] = [];
  const allDialects: number[] = [];
  const allRatios: number[] = [];

  for (const result of results) {
    for (const point of result.timePoints) {
      allTicks.push(point.tick);
      allDialects.push(point.dialectCount);
      allRatios.push(point.similarityRatio);
    }
  }

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

  const tickDialectCorr = correlation(allTicks, allDialects);
  const tickRatioCorr = correlation(allTicks, allRatios);

  console.log(`\n時間-方言圏数の相関: ${tickDialectCorr.toFixed(3)}`);
  console.log(`時間-類似度比率の相関: ${tickRatioCorr.toFixed(3)}`);

  // 結論
  console.log('\n=== 結論 ===\n');

  const majorityRatioIncrease = ratioIncreased > results.length / 2;
  const majorityDialectIncrease = dialectsIncreased > results.length / 2;
  const positiveTimeCorr = tickDialectCorr > 0.1 || tickRatioCorr > 0.1;

  if (majorityRatioIncrease && majorityDialectIncrease && positiveTimeCorr) {
    console.log('H68を強く支持: 方言圏は時間とともに分化する');
    console.log('→ 確立された結論に昇格を推奨');
  } else if (majorityRatioIncrease || majorityDialectIncrease) {
    console.log('H68を支持: 方言圏は時間とともに分化する傾向がある');
    console.log(`  - 比率増加: ${ratioIncreased}/${results.length}`);
    console.log(`  - 方言圏増加: ${dialectsIncreased}/${results.length}`);
  } else {
    console.log('H68は不明確: 一貫した傾向が見られない');
  }

  // 詳細データ
  console.log('\n=== seed別詳細 ===\n');
  console.log('| Seed | 初期比率 | 最終比率 | 変化 | 初期方言圏 | 最終方言圏 | 変化 |');
  console.log('|------|---------|---------|------|-----------|-----------|------|');

  for (const result of results) {
    const first = result.timePoints[0];
    const last = result.timePoints[result.timePoints.length - 1];
    const ratioChange = last.similarityRatio - first.similarityRatio;
    const dialectChange = last.dialectCount - first.dialectCount;
    console.log(`| ${result.seed} | ${first.similarityRatio.toFixed(1)}x | ${last.similarityRatio.toFixed(1)}x | ${ratioChange >= 0 ? '+' : ''}${ratioChange.toFixed(1)} | ${first.dialectCount} | ${last.dialectCount} | ${dialectChange >= 0 ? '+' : ''}${dialectChange} |`);
  }
}

main().catch(console.error);
