/**
 * H80検証: 親子ペアの類似度は非親子ペアより高い
 * 
 * 複製イベントを追跡し、親子関係を特定して類似度を比較する
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface ParentChildPair {
  parentId: string;
  childId: string;
  tick: number;
  similarity: number;
}

interface NonParentChildPair {
  entity1Id: string;
  entity2Id: string;
  tick: number;
  similarity: number;
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

function runSimulation(seed: number): {
  parentChildPairs: ParentChildPair[];
  nonParentChildPairs: NonParentChildPair[];
  sameNodeNonParentPairs: NonParentChildPair[];
} {
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
  const snapshotInterval = 100;

  const parentChildPairs: ParentChildPair[] = [];
  const nonParentChildPairs: NonParentChildPair[] = [];
  const sameNodeNonParentPairs: NonParentChildPair[] = [];

  // 親子関係を追跡
  const parentChildMap = new Map<string, string[]>(); // parentId -> childIds

  for (let t = 0; t <= totalTicks; t++) {
    if (t > 0) {
      universe.step();
    }

    // 複製イベントを取得
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'replication') {
        // イベントのプロパティを直接参照
        const parentId = (event as any).parentId as string;
        const childId = (event as any).childId as string;
        if (parentId && childId) {
          if (!parentChildMap.has(parentId)) {
            parentChildMap.set(parentId, []);
          }
          parentChildMap.get(parentId)!.push(childId);
        }
      }
    }
    universe.clearEventLog();

    // スナップショット時に類似度を計算
    if (t > 0 && t % snapshotInterval === 0) {
      const entities = universe.getAllEntities();
      const entityMap = new Map(entities.map(e => [e.id, e]));

      // 親子ペアの類似度を計算
      for (const [parentId, childIds] of parentChildMap) {
        const parent = entityMap.get(parentId);
        if (!parent) continue;

        for (const childId of childIds) {
          const child = entityMap.get(childId);
          if (!child) continue;

          const similarity = calculateStateSimilarity(
            parent.state.getData(),
            child.state.getData()
          );

          parentChildPairs.push({
            parentId,
            childId,
            tick: t,
            similarity,
          });
        }
      }

      // 非親子ペアの類似度を計算（同一ノード内）
      const nodeEntities = new Map<string, typeof entities>();
      for (const entity of entities) {
        const nodeId = entity.nodeId;
        if (!nodeEntities.has(nodeId)) {
          nodeEntities.set(nodeId, []);
        }
        nodeEntities.get(nodeId)!.push(entity);
      }

      for (const [nodeId, nodeEnts] of nodeEntities) {
        if (nodeEnts.length < 2) continue;

        for (let i = 0; i < nodeEnts.length; i++) {
          for (let j = i + 1; j < nodeEnts.length; j++) {
            const e1 = nodeEnts[i];
            const e2 = nodeEnts[j];

            // 親子関係をチェック
            const isParentChild = 
              (parentChildMap.get(e1.id)?.includes(e2.id)) ||
              (parentChildMap.get(e2.id)?.includes(e1.id));

            const similarity = calculateStateSimilarity(
              e1.state.getData(),
              e2.state.getData()
            );

            if (!isParentChild) {
              sameNodeNonParentPairs.push({
                entity1Id: e1.id,
                entity2Id: e2.id,
                tick: t,
                similarity,
              });
            }
          }
        }
      }

      // ランダムな非親子ペア（異なるノード間）
      if (entities.length >= 2) {
        const sampleSize = Math.min(50, entities.length * (entities.length - 1) / 2);
        for (let s = 0; s < sampleSize; s++) {
          const i = Math.floor(Math.random() * entities.length);
          let j = Math.floor(Math.random() * entities.length);
          while (j === i) {
            j = Math.floor(Math.random() * entities.length);
          }

          const e1 = entities[i];
          const e2 = entities[j];

          // 親子関係をチェック
          const isParentChild = 
            (parentChildMap.get(e1.id)?.includes(e2.id)) ||
            (parentChildMap.get(e2.id)?.includes(e1.id));

          if (!isParentChild && e1.nodeId !== e2.nodeId) {
            const similarity = calculateStateSimilarity(
              e1.state.getData(),
              e2.state.getData()
            );

            nonParentChildPairs.push({
              entity1Id: e1.id,
              entity2Id: e2.id,
              tick: t,
              similarity,
            });
          }
        }
      }
    }
  }

  return { parentChildPairs, nonParentChildPairs, sameNodeNonParentPairs };
}

async function main() {
  console.log('=== H80検証: 親子ペアの類似度は非親子ペアより高い ===\n');

  const seeds = [42, 123, 456, 789, 1000];
  const allResults: {
    seed: number;
    parentChildPairs: ParentChildPair[];
    nonParentChildPairs: NonParentChildPair[];
    sameNodeNonParentPairs: NonParentChildPair[];
  }[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const result = runSimulation(seed);
    allResults.push({ seed, ...result });

    console.log(`  親子ペア数: ${result.parentChildPairs.length}`);
    console.log(`  同一ノード非親子ペア数: ${result.sameNodeNonParentPairs.length}`);
    console.log(`  異ノード非親子ペア数: ${result.nonParentChildPairs.length}`);
  }

  // 統計分析
  console.log('\n=== 統計分析 ===\n');

  console.log('| Seed | 親子類似度 | 同一ノード非親子 | 異ノード非親子 | 親子/同一ノード比 | 親子/異ノード比 |');
  console.log('|------|-----------|-----------------|---------------|------------------|----------------|');

  let totalParentChild = 0;
  let totalSameNode = 0;
  let totalDiffNode = 0;
  let sumParentChild = 0;
  let sumSameNode = 0;
  let sumDiffNode = 0;

  for (const r of allResults) {
    const avgParentChild = r.parentChildPairs.length > 0
      ? r.parentChildPairs.reduce((s, p) => s + p.similarity, 0) / r.parentChildPairs.length
      : 0;
    const avgSameNode = r.sameNodeNonParentPairs.length > 0
      ? r.sameNodeNonParentPairs.reduce((s, p) => s + p.similarity, 0) / r.sameNodeNonParentPairs.length
      : 0;
    const avgDiffNode = r.nonParentChildPairs.length > 0
      ? r.nonParentChildPairs.reduce((s, p) => s + p.similarity, 0) / r.nonParentChildPairs.length
      : 0;

    const ratioSameNode = avgSameNode > 0 ? avgParentChild / avgSameNode : 0;
    const ratioDiffNode = avgDiffNode > 0 ? avgParentChild / avgDiffNode : 0;

    console.log(`| ${r.seed} | ${avgParentChild.toFixed(3)} | ${avgSameNode.toFixed(3)} | ${avgDiffNode.toFixed(3)} | ${ratioSameNode.toFixed(2)}x | ${ratioDiffNode.toFixed(2)}x |`);

    totalParentChild += r.parentChildPairs.length;
    totalSameNode += r.sameNodeNonParentPairs.length;
    totalDiffNode += r.nonParentChildPairs.length;
    sumParentChild += r.parentChildPairs.reduce((s, p) => s + p.similarity, 0);
    sumSameNode += r.sameNodeNonParentPairs.reduce((s, p) => s + p.similarity, 0);
    sumDiffNode += r.nonParentChildPairs.reduce((s, p) => s + p.similarity, 0);
  }

  // 全体平均
  const overallParentChild = totalParentChild > 0 ? sumParentChild / totalParentChild : 0;
  const overallSameNode = totalSameNode > 0 ? sumSameNode / totalSameNode : 0;
  const overallDiffNode = totalDiffNode > 0 ? sumDiffNode / totalDiffNode : 0;

  console.log('\n=== 全体平均 ===\n');
  console.log(`親子ペア平均類似度: ${overallParentChild.toFixed(4)} (n=${totalParentChild})`);
  console.log(`同一ノード非親子平均類似度: ${overallSameNode.toFixed(4)} (n=${totalSameNode})`);
  console.log(`異ノード非親子平均類似度: ${overallDiffNode.toFixed(4)} (n=${totalDiffNode})`);

  const ratioSameNode = overallSameNode > 0 ? overallParentChild / overallSameNode : 0;
  const ratioDiffNode = overallDiffNode > 0 ? overallParentChild / overallDiffNode : 0;

  console.log(`\n親子/同一ノード非親子比: ${ratioSameNode.toFixed(2)}x`);
  console.log(`親子/異ノード非親子比: ${ratioDiffNode.toFixed(2)}x`);

  // 結論
  console.log('\n=== 結論 ===\n');

  if (overallParentChild > overallSameNode && ratioSameNode > 1.5) {
    console.log('H80を強く支持: 親子ペアの類似度は非親子ペアより高い');
    console.log(`  → 親子類似度（${overallParentChild.toFixed(3)}）> 同一ノード非親子（${overallSameNode.toFixed(3)}）`);
    console.log(`  → 比率: ${ratioSameNode.toFixed(2)}x`);
  } else if (overallParentChild > overallSameNode) {
    console.log('H80を支持: 親子ペアの類似度は非親子ペアより高い');
    console.log(`  → 親子類似度（${overallParentChild.toFixed(3)}）> 同一ノード非親子（${overallSameNode.toFixed(3)}）`);
    console.log(`  → 比率: ${ratioSameNode.toFixed(2)}x`);
  } else {
    console.log('H80を棄却: 親子ペアの類似度は非親子ペアより高くない');
    console.log(`  → 親子類似度（${overallParentChild.toFixed(3)}）≤ 同一ノード非親子（${overallSameNode.toFixed(3)}）`);
  }

  // 時間経過による変化
  console.log('\n=== 時間経過による親子類似度の変化（Seed 42）===\n');

  const seed42 = allResults.find(r => r.seed === 42)!;
  const tickGroups = new Map<number, number[]>();
  for (const pair of seed42.parentChildPairs) {
    const tickBin = Math.floor(pair.tick / 1000) * 1000;
    if (!tickGroups.has(tickBin)) {
      tickGroups.set(tickBin, []);
    }
    tickGroups.get(tickBin)!.push(pair.similarity);
  }

  console.log('| Tick範囲 | ペア数 | 平均類似度 |');
  console.log('|---------|--------|-----------|');
  for (const [tick, similarities] of Array.from(tickGroups.entries()).sort((a, b) => a[0] - b[0])) {
    const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    console.log(`| ${tick}-${tick + 999} | ${similarities.length} | ${avg.toFixed(3)} |`);
  }
}

main().catch(console.error);
