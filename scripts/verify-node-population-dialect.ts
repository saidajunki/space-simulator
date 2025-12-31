/**
 * H78検証: 方言圏の形成には「適度なノード人口」（2-4体）が必要
 * 
 * ノード人口と方言圏形成率の関係を詳細に分析する
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface NodeDialectData {
  nodeId: string;
  population: number;
  avgSimilarity: number;
  isDialect: boolean;  // 類似度 >= 0.1
}

interface SnapshotData {
  tick: number;
  totalPopulation: number;
  occupiedNodes: number;
  dialectNodes: number;
  nodeData: NodeDialectData[];
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

function runSimulation(seed: number): SnapshotData[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 30,
      edgeDensity: 0.3,
      initialEntityCount: 100,
    },
    resourceRegenerationRate: 0.020,
    toolEffectEnabled: true,
    skillBonusEnabled: true,
  };

  const universe = new Universe(config);
  const totalTicks = 5000;
  const snapshotInterval = 500;
  const snapshots: SnapshotData[] = [];

  for (let t = 0; t <= totalTicks; t++) {
    if (t > 0) {
      universe.step();
      universe.clearEventLog();
    }

    if (t % snapshotInterval === 0) {
      const entities = universe.getAllEntities();
      const nodePopulations = new Map<string, typeof entities>();

      // ノードごとにエンティティを分類
      for (const entity of entities) {
        const nodeId = entity.nodeId;
        if (!nodePopulations.has(nodeId)) {
          nodePopulations.set(nodeId, []);
        }
        nodePopulations.get(nodeId)!.push(entity);
      }

      // 各ノードの類似度を計算
      const nodeData: NodeDialectData[] = [];
      for (const [nodeId, nodeEntities] of nodePopulations) {
        const population = nodeEntities.length;
        let avgSimilarity = 0;

        if (population >= 2) {
          // ノード内の全ペアの類似度を計算
          let totalSimilarity = 0;
          let pairCount = 0;
          for (let i = 0; i < nodeEntities.length; i++) {
            for (let j = i + 1; j < nodeEntities.length; j++) {
              const state1 = nodeEntities[i].state.getData();
              const state2 = nodeEntities[j].state.getData();
              totalSimilarity += calculateStateSimilarity(state1, state2);
              pairCount++;
            }
          }
          avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
        }

        nodeData.push({
          nodeId,
          population,
          avgSimilarity,
          isDialect: avgSimilarity >= 0.1,
        });
      }

      snapshots.push({
        tick: t,
        totalPopulation: entities.length,
        occupiedNodes: nodePopulations.size,
        dialectNodes: nodeData.filter(n => n.isDialect).length,
        nodeData,
      });
    }
  }

  return snapshots;
}

function analyzeByPopulation(allSnapshots: SnapshotData[][]): Map<number, { total: number; dialect: number; rate: number; avgSimilarity: number }> {
  const byPopulation = new Map<number, { total: number; dialect: number; similarities: number[] }>();

  for (const snapshots of allSnapshots) {
    for (const snapshot of snapshots) {
      for (const node of snapshot.nodeData) {
        const pop = node.population;
        if (!byPopulation.has(pop)) {
          byPopulation.set(pop, { total: 0, dialect: 0, similarities: [] });
        }
        const data = byPopulation.get(pop)!;
        data.total++;
        if (node.isDialect) data.dialect++;
        if (node.population >= 2) {
          data.similarities.push(node.avgSimilarity);
        }
      }
    }
  }

  const result = new Map<number, { total: number; dialect: number; rate: number; avgSimilarity: number }>();
  for (const [pop, data] of byPopulation) {
    const avgSim = data.similarities.length > 0
      ? data.similarities.reduce((a, b) => a + b, 0) / data.similarities.length
      : 0;
    result.set(pop, {
      total: data.total,
      dialect: data.dialect,
      rate: data.total > 0 ? data.dialect / data.total : 0,
      avgSimilarity: avgSim,
    });
  }

  return result;
}

async function main() {
  console.log('=== H78検証: 方言圏の形成には「適度なノード人口」（2-4体）が必要 ===\n');

  const seeds = [42, 123, 456, 789, 1000];
  const allSnapshots: SnapshotData[][] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const snapshots = runSimulation(seed);
    allSnapshots.push(snapshots);

    const lastSnapshot = snapshots[snapshots.length - 1];
    console.log(`  最終人口: ${lastSnapshot.totalPopulation}`);
    console.log(`  占有ノード: ${lastSnapshot.occupiedNodes}`);
    console.log(`  方言圏ノード: ${lastSnapshot.dialectNodes}`);
  }

  // ノード人口別の分析
  console.log('\n=== ノード人口別の方言圏形成率 ===\n');

  const byPopulation = analyzeByPopulation(allSnapshots);
  const sortedPops = Array.from(byPopulation.keys()).sort((a, b) => a - b);

  console.log('| ノード人口 | 総ノード数 | 方言圏数 | 方言圏率 | 平均類似度 |');
  console.log('|-----------|-----------|---------|---------|-----------|');

  for (const pop of sortedPops) {
    const data = byPopulation.get(pop)!;
    console.log(`| ${pop} | ${data.total} | ${data.dialect} | ${(data.rate * 100).toFixed(1)}% | ${data.avgSimilarity.toFixed(3)} |`);
  }

  // 人口帯別の集計
  console.log('\n=== 人口帯別の集計 ===\n');

  const bands = [
    { name: '1体', min: 1, max: 1 },
    { name: '2体', min: 2, max: 2 },
    { name: '3体', min: 3, max: 3 },
    { name: '4体', min: 4, max: 4 },
    { name: '5体以上', min: 5, max: Infinity },
  ];

  console.log('| 人口帯 | 総ノード数 | 方言圏数 | 方言圏率 | 平均類似度 |');
  console.log('|--------|-----------|---------|---------|-----------|');

  for (const band of bands) {
    let total = 0;
    let dialect = 0;
    const similarities: number[] = [];

    for (const pop of sortedPops) {
      if (pop >= band.min && pop <= band.max) {
        const data = byPopulation.get(pop)!;
        total += data.total;
        dialect += data.dialect;
        if (data.avgSimilarity > 0) {
          for (let i = 0; i < data.total; i++) {
            similarities.push(data.avgSimilarity);
          }
        }
      }
    }

    const rate = total > 0 ? dialect / total : 0;
    const avgSim = similarities.length > 0
      ? similarities.reduce((a, b) => a + b, 0) / similarities.length
      : 0;

    console.log(`| ${band.name} | ${total} | ${dialect} | ${(rate * 100).toFixed(1)}% | ${avgSim.toFixed(3)} |`);
  }

  // 結論
  console.log('\n=== 結論 ===\n');

  // 2-4体の方言圏率を計算
  let total24 = 0;
  let dialect24 = 0;
  for (const pop of [2, 3, 4]) {
    const data = byPopulation.get(pop);
    if (data) {
      total24 += data.total;
      dialect24 += data.dialect;
    }
  }
  const rate24 = total24 > 0 ? dialect24 / total24 : 0;

  // 5体以上の方言圏率を計算
  let total5plus = 0;
  let dialect5plus = 0;
  for (const pop of sortedPops) {
    if (pop >= 5) {
      const data = byPopulation.get(pop)!;
      total5plus += data.total;
      dialect5plus += data.dialect;
    }
  }
  const rate5plus = total5plus > 0 ? dialect5plus / total5plus : 0;

  // 1体の方言圏率
  const data1 = byPopulation.get(1);
  const rate1 = data1 ? data1.dialect / data1.total : 0;

  console.log(`1体の方言圏率: ${(rate1 * 100).toFixed(1)}%`);
  console.log(`2-4体の方言圏率: ${(rate24 * 100).toFixed(1)}%`);
  console.log(`5体以上の方言圏率: ${(rate5plus * 100).toFixed(1)}%`);

  if (rate24 > rate1 && rate24 > rate5plus) {
    console.log('\nH78を支持: 方言圏の形成には「適度なノード人口」（2-4体）が必要');
    console.log(`  → 2-4体の方言圏率（${(rate24 * 100).toFixed(1)}%）が最も高い`);
    console.log(`  → 1体（${(rate1 * 100).toFixed(1)}%）と5体以上（${(rate5plus * 100).toFixed(1)}%）より高い`);
  } else if (rate24 > rate1 || rate24 > rate5plus) {
    console.log('\nH78を部分的に支持: 2-4体の方言圏率が一部の条件より高い');
  } else {
    console.log('\nH78を棄却: 2-4体の方言圏率が特に高いわけではない');
  }

  // 最適人口の特定
  let maxRate = 0;
  let optimalPop = 0;
  for (const pop of sortedPops) {
    const data = byPopulation.get(pop)!;
    if (data.total >= 10 && data.rate > maxRate) {  // サンプル数10以上
      maxRate = data.rate;
      optimalPop = pop;
    }
  }

  console.log(`\n最適ノード人口: ${optimalPop}体（方言圏率${(maxRate * 100).toFixed(1)}%）`);
}

main().catch(console.error);
