/**
 * H73検証: 方言圏数は初期条件（seed）に強く依存する
 * 
 * 同じパラメータで多数のseedを試し、方言圏数の分布を観察する
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface DialectResult {
  seed: number;
  finalPop: number;
  occupiedNodes: number;
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

function runSimulation(seed: number): DialectResult {
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
  const totalTicks = 5000;

  for (let t = 0; t < totalTicks; t++) {
    universe.step();
    universe.clearEventLog();
  }

  const entities = universe.getAllEntities();
  const finalPop = entities.length;

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

  for (const [, states] of nodeEntities) {
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

      const maxPairs = Math.min(30, states1.length * states2.length);
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
    seed,
    finalPop,
    occupiedNodes,
    dialectCount,
    similarityRatio,
    intraNodeSimilarity,
    interNodeSimilarity,
  };
}

async function main() {
  console.log('=== H73検証: 方言圏数は初期条件（seed）に強く依存する ===\n');

  // 20個のseedで検証
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42, 123, 456, 789, 1000, 2024, 3000, 4000, 5000, 9999];
  const results: DialectResult[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const result = runSimulation(seed);
    results.push(result);
    console.log(`  人口=${result.finalPop}, 方言圏=${result.dialectCount}, 比率=${result.similarityRatio.toFixed(1)}x`);
  }

  // 統計分析
  console.log('\n=== 統計分析 ===\n');

  const dialectCounts = results.map(r => r.dialectCount);
  const populations = results.map(r => r.finalPop);
  const ratios = results.map(r => r.similarityRatio);

  const avgDialects = dialectCounts.reduce((a, b) => a + b, 0) / dialectCounts.length;
  const minDialects = Math.min(...dialectCounts);
  const maxDialects = Math.max(...dialectCounts);
  const stdDialects = Math.sqrt(dialectCounts.reduce((s, d) => s + (d - avgDialects) ** 2, 0) / dialectCounts.length);

  console.log(`方言圏数:`);
  console.log(`  平均: ${avgDialects.toFixed(1)}`);
  console.log(`  最小: ${minDialects}`);
  console.log(`  最大: ${maxDialects}`);
  console.log(`  標準偏差: ${stdDialects.toFixed(2)}`);
  console.log(`  変動係数: ${(stdDialects / avgDialects * 100).toFixed(1)}%`);

  const avgPop = populations.reduce((a, b) => a + b, 0) / populations.length;
  const stdPop = Math.sqrt(populations.reduce((s, p) => s + (p - avgPop) ** 2, 0) / populations.length);

  console.log(`\n人口:`);
  console.log(`  平均: ${avgPop.toFixed(1)}`);
  console.log(`  標準偏差: ${stdPop.toFixed(2)}`);
  console.log(`  変動係数: ${(stdPop / avgPop * 100).toFixed(1)}%`);

  // 相関分析
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

  const popDialectCorr = correlation(populations, dialectCounts);
  const popRatioCorr = correlation(populations, ratios);

  console.log(`\n相関:`);
  console.log(`  人口 vs 方言圏数: ${popDialectCorr.toFixed(3)}`);
  console.log(`  人口 vs 類似度比率: ${popRatioCorr.toFixed(3)}`);

  // 分布
  console.log('\n=== 方言圏数の分布 ===\n');

  const distribution = new Map<number, number>();
  for (const d of dialectCounts) {
    distribution.set(d, (distribution.get(d) ?? 0) + 1);
  }

  const sortedKeys = Array.from(distribution.keys()).sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const count = distribution.get(key)!;
    const bar = '█'.repeat(count);
    console.log(`  ${key.toString().padStart(2)}: ${bar} (${count})`);
  }

  // 結論
  console.log('\n=== 結論 ===\n');

  const cv = stdDialects / avgDialects;  // 変動係数

  if (cv > 0.5) {
    console.log('H73を強く支持: 方言圏数の変動係数が50%以上');
    console.log(`  → 初期条件（seed）により方言圏数が大きく変わる`);
    console.log(`  → 範囲: ${minDialects}〜${maxDialects}（${(maxDialects/minDialects).toFixed(1)}倍の差）`);
  } else if (cv > 0.3) {
    console.log('H73を支持: 方言圏数の変動係数が30%以上');
    console.log(`  → 初期条件（seed）により方言圏数が変わる傾向がある`);
  } else {
    console.log('H73を棄却: 方言圏数の変動係数が30%未満');
    console.log(`  → 初期条件（seed）の影響は限定的`);
  }

  // H74の検証（人口と方言圏数の関係）
  console.log('\n=== H74検証: 方言圏数は「絶対的な人口」に依存する ===\n');

  if (Math.abs(popDialectCorr) > 0.5) {
    if (popDialectCorr > 0) {
      console.log('H74を支持: 人口と方言圏数に正の相関');
    } else {
      console.log('H74を支持（逆方向）: 人口と方言圏数に負の相関');
    }
  } else if (Math.abs(popDialectCorr) > 0.3) {
    console.log('H74は部分的に支持: 人口と方言圏数に弱い相関');
  } else {
    console.log('H74を棄却: 人口と方言圏数に有意な相関なし');
  }

  // 詳細データ
  console.log('\n=== 詳細データ ===\n');
  console.log('| Seed | 人口 | 占有ノード | 方言圏 | 類似度比率 |');
  console.log('|------|------|-----------|--------|-----------|');
  for (const r of results.sort((a, b) => b.dialectCount - a.dialectCount)) {
    console.log(`| ${r.seed} | ${r.finalPop} | ${r.occupiedNodes} | ${r.dialectCount} | ${r.similarityRatio.toFixed(1)}x |`);
  }
}

main().catch(console.error);
