/**
 * H76検証: 方言圏の不安定性は「人口変動」に起因する
 * H77検証: 方言圏の形成には「最小人口」が必要
 * 
 * 人口変動と方言圏安定性の関係を分析する
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface Snapshot {
  tick: number;
  population: number;
  dialectCount: number;
  nodePopulations: Map<string, number>;  // ノードごとの人口
  dialectNodes: string[];
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
  dialectNodes: string[];
  nodePopulations: Map<string, number>;
} {
  const entities = universe.getAllEntities();
  
  // ノード別にエンティティを分類
  const nodeEntities = new Map<string, Uint8Array[]>();
  const nodePopulations = new Map<string, number>();
  
  for (const entity of entities) {
    const stateData = entity.state.getData();
    if (!nodePopulations.has(entity.nodeId)) {
      nodePopulations.set(entity.nodeId, 0);
    }
    nodePopulations.set(entity.nodeId, nodePopulations.get(entity.nodeId)! + 1);
    
    if (stateData.length === 0) continue;
    if (!nodeEntities.has(entity.nodeId)) {
      nodeEntities.set(entity.nodeId, []);
    }
    nodeEntities.get(entity.nodeId)!.push(new Uint8Array(stateData));
  }

  // 方言圏の特定
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
      }
    }

    if (nodePairCount > 0) {
      const avgNodeSimilarity = nodeSimilaritySum / nodePairCount;
      if (avgNodeSimilarity >= 0.1) {
        dialectNodes.push(nodeId);
      }
    }
  }

  return {
    dialectCount: dialectNodes.length,
    dialectNodes,
    nodePopulations,
  };
}

function runSimulation(seed: number): Snapshot[] {
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
  const snapshotInterval = 100;  // より細かい間隔で観察
  const snapshots: Snapshot[] = [];

  for (let t = 0; t <= totalTicks; t++) {
    if (t > 0) {
      universe.step();
      universe.clearEventLog();
    }

    if (t % snapshotInterval === 0) {
      const entities = universe.getAllEntities();
      const analysis = analyzeDialects(universe);

      snapshots.push({
        tick: t,
        population: entities.length,
        dialectCount: analysis.dialectCount,
        nodePopulations: new Map(analysis.nodePopulations),
        dialectNodes: [...analysis.dialectNodes],
      });
    }
  }

  return snapshots;
}

function analyzePopulationDynamics(snapshots: Snapshot[]): {
  populationVariance: number;
  dialectVariance: number;
  populationDialectCorrelation: number;
  populationChangeDialectChangeCorrelation: number;
  minPopulationForDialect: number;
  avgPopulationInDialectNodes: number;
  avgPopulationInNonDialectNodes: number;
} {
  const populations = snapshots.map(s => s.population);
  const dialectCounts = snapshots.map(s => s.dialectCount);

  // 分散
  const avgPop = populations.reduce((a, b) => a + b, 0) / populations.length;
  const avgDialect = dialectCounts.reduce((a, b) => a + b, 0) / dialectCounts.length;
  const populationVariance = populations.reduce((s, p) => s + (p - avgPop) ** 2, 0) / populations.length;
  const dialectVariance = dialectCounts.reduce((s, d) => s + (d - avgDialect) ** 2, 0) / dialectCounts.length;

  // 相関
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

  const populationDialectCorrelation = correlation(populations, dialectCounts);

  // 変化量の相関
  const populationChanges: number[] = [];
  const dialectChanges: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    populationChanges.push(snapshots[i].population - snapshots[i - 1].population);
    dialectChanges.push(snapshots[i].dialectCount - snapshots[i - 1].dialectCount);
  }
  const populationChangeDialectChangeCorrelation = correlation(populationChanges, dialectChanges);

  // 方言圏ノードの最小人口
  let minPopulationForDialect = Infinity;
  let totalDialectNodePop = 0;
  let dialectNodeCount = 0;
  let totalNonDialectNodePop = 0;
  let nonDialectNodeCount = 0;

  for (const snapshot of snapshots) {
    for (const nodeId of snapshot.dialectNodes) {
      const pop = snapshot.nodePopulations.get(nodeId) || 0;
      if (pop < minPopulationForDialect) {
        minPopulationForDialect = pop;
      }
      totalDialectNodePop += pop;
      dialectNodeCount++;
    }
    
    for (const [nodeId, pop] of snapshot.nodePopulations) {
      if (!snapshot.dialectNodes.includes(nodeId)) {
        totalNonDialectNodePop += pop;
        nonDialectNodeCount++;
      }
    }
  }

  const avgPopulationInDialectNodes = dialectNodeCount > 0 ? totalDialectNodePop / dialectNodeCount : 0;
  const avgPopulationInNonDialectNodes = nonDialectNodeCount > 0 ? totalNonDialectNodePop / nonDialectNodeCount : 0;

  return {
    populationVariance,
    dialectVariance,
    populationDialectCorrelation,
    populationChangeDialectChangeCorrelation,
    minPopulationForDialect: minPopulationForDialect === Infinity ? 0 : minPopulationForDialect,
    avgPopulationInDialectNodes,
    avgPopulationInNonDialectNodes,
  };
}

async function main() {
  console.log('=== H76/H77検証: 方言圏の不安定性と人口変動の関係 ===\n');

  const seeds = [42, 123, 456, 789, 1000];
  const allResults: { seed: number; snapshots: Snapshot[]; analysis: ReturnType<typeof analyzePopulationDynamics> }[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const snapshots = runSimulation(seed);
    const analysis = analyzePopulationDynamics(snapshots);
    allResults.push({ seed, snapshots, analysis });

    console.log(`  人口-方言圏相関: ${analysis.populationDialectCorrelation.toFixed(3)}`);
    console.log(`  変化量相関: ${analysis.populationChangeDialectChangeCorrelation.toFixed(3)}`);
    console.log(`  方言圏ノード平均人口: ${analysis.avgPopulationInDialectNodes.toFixed(1)}`);
  }

  // 統計分析
  console.log('\n=== 統計分析 ===\n');

  const avgPopDialectCorr = allResults.reduce((s, r) => s + r.analysis.populationDialectCorrelation, 0) / allResults.length;
  const avgChangeCorr = allResults.reduce((s, r) => s + r.analysis.populationChangeDialectChangeCorrelation, 0) / allResults.length;
  const avgDialectNodePop = allResults.reduce((s, r) => s + r.analysis.avgPopulationInDialectNodes, 0) / allResults.length;
  const avgNonDialectNodePop = allResults.reduce((s, r) => s + r.analysis.avgPopulationInNonDialectNodes, 0) / allResults.length;
  const minPopForDialect = Math.min(...allResults.map(r => r.analysis.minPopulationForDialect));

  console.log(`全体平均:`);
  console.log(`  人口-方言圏相関: ${avgPopDialectCorr.toFixed(3)}`);
  console.log(`  変化量相関: ${avgChangeCorr.toFixed(3)}`);
  console.log(`  方言圏ノード平均人口: ${avgDialectNodePop.toFixed(1)}`);
  console.log(`  非方言圏ノード平均人口: ${avgNonDialectNodePop.toFixed(1)}`);
  console.log(`  方言圏形成の最小人口: ${minPopForDialect}`);

  // H76の検証
  console.log('\n=== H76検証: 方言圏の不安定性は「人口変動」に起因する ===\n');

  if (Math.abs(avgChangeCorr) > 0.3) {
    console.log('H76を支持: 人口変化と方言圏変化に相関がある');
    console.log(`  → 変化量相関: ${avgChangeCorr.toFixed(3)}`);
  } else {
    console.log('H76を棄却: 人口変化と方言圏変化に有意な相関がない');
    console.log(`  → 変化量相関: ${avgChangeCorr.toFixed(3)}`);
  }

  // H77の検証
  console.log('\n=== H77検証: 方言圏の形成には「最小人口」が必要 ===\n');

  const popDiff = avgDialectNodePop - avgNonDialectNodePop;
  if (popDiff > 1.0) {
    console.log('H77を支持: 方言圏ノードは非方言圏ノードより人口が多い');
    console.log(`  → 方言圏ノード: ${avgDialectNodePop.toFixed(1)}`);
    console.log(`  → 非方言圏ノード: ${avgNonDialectNodePop.toFixed(1)}`);
    console.log(`  → 差: +${popDiff.toFixed(1)}`);
    console.log(`  → 最小人口: ${minPopForDialect}`);
  } else {
    console.log('H77を棄却: 方言圏ノードと非方言圏ノードの人口差が小さい');
    console.log(`  → 差: ${popDiff.toFixed(1)}`);
  }

  // 詳細データ
  console.log('\n=== 詳細データ ===\n');
  console.log('| Seed | 人口-方言圏相関 | 変化量相関 | 方言圏ノード人口 | 非方言圏ノード人口 | 最小人口 |');
  console.log('|------|----------------|-----------|-----------------|-------------------|---------|');
  for (const r of allResults) {
    console.log(`| ${r.seed} | ${r.analysis.populationDialectCorrelation.toFixed(3)} | ${r.analysis.populationChangeDialectChangeCorrelation.toFixed(3)} | ${r.analysis.avgPopulationInDialectNodes.toFixed(1)} | ${r.analysis.avgPopulationInNonDialectNodes.toFixed(1)} | ${r.analysis.minPopulationForDialect} |`);
  }

  // ノード人口と方言圏形成の関係
  console.log('\n=== ノード人口と方言圏形成の関係 ===\n');

  const populationBuckets = new Map<number, { dialect: number; nonDialect: number }>();
  for (const r of allResults) {
    for (const snapshot of r.snapshots) {
      for (const [nodeId, pop] of snapshot.nodePopulations) {
        const bucket = Math.floor(pop);
        if (!populationBuckets.has(bucket)) {
          populationBuckets.set(bucket, { dialect: 0, nonDialect: 0 });
        }
        if (snapshot.dialectNodes.includes(nodeId)) {
          populationBuckets.get(bucket)!.dialect++;
        } else {
          populationBuckets.get(bucket)!.nonDialect++;
        }
      }
    }
  }

  console.log('| ノード人口 | 方言圏 | 非方言圏 | 方言圏率 |');
  console.log('|-----------|--------|---------|---------|');
  const sortedBuckets = Array.from(populationBuckets.entries()).sort((a, b) => a[0] - b[0]);
  for (const [pop, counts] of sortedBuckets) {
    const total = counts.dialect + counts.nonDialect;
    const rate = total > 0 ? (counts.dialect / total * 100).toFixed(1) : '0.0';
    console.log(`| ${pop} | ${counts.dialect} | ${counts.nonDialect} | ${rate}% |`);
  }
}

main().catch(console.error);
