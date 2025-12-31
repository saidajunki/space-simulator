/**
 * H82検証: 世代数が離れるほど類似度は低下する
 * 
 * 複製イベントを追跡し、世代関係（親子、祖父母-孫、曾祖父母-曾孫など）を特定して類似度を比較する
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface FamilyTree {
  parentId: string | null;
  childIds: string[];
  generation: number;  // 0 = 初期個体
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
  familyTree: Map<string, FamilyTree>;
  finalEntities: Map<string, Uint8Array>;
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

  const familyTree = new Map<string, FamilyTree>();

  // 初期個体を登録
  for (const entity of universe.getAllEntities()) {
    familyTree.set(entity.id, {
      parentId: null,
      childIds: [],
      generation: 0,
    });
  }

  for (let t = 0; t <= totalTicks; t++) {
    if (t > 0) {
      universe.step();
    }

    // 複製イベントを取得
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'replication') {
        const parentId = (event as any).parentId as string;
        const childId = (event as any).childId as string;
        if (parentId && childId) {
          // 親の世代を取得
          const parentInfo = familyTree.get(parentId);
          const parentGeneration = parentInfo?.generation ?? 0;

          // 子を登録
          familyTree.set(childId, {
            parentId,
            childIds: [],
            generation: parentGeneration + 1,
          });

          // 親の子リストに追加
          if (parentInfo) {
            parentInfo.childIds.push(childId);
          }
        }
      }
    }
    universe.clearEventLog();
  }

  // 最終状態のエンティティを取得
  const finalEntities = new Map<string, Uint8Array>();
  for (const entity of universe.getAllEntities()) {
    finalEntities.set(entity.id, entity.state.getData());
  }

  return { familyTree, finalEntities };
}

function findAncestor(entityId: string, generations: number, familyTree: Map<string, FamilyTree>): string | null {
  let currentId: string | null = entityId;
  for (let i = 0; i < generations; i++) {
    const info = familyTree.get(currentId!);
    if (!info || !info.parentId) return null;
    currentId = info.parentId;
  }
  return currentId;
}

function analyzeGenerationSimilarity(
  familyTree: Map<string, FamilyTree>,
  finalEntities: Map<string, Uint8Array>
): Map<number, { count: number; totalSimilarity: number }> {
  const result = new Map<number, { count: number; totalSimilarity: number }>();

  // 生存しているエンティティのみを対象
  for (const [entityId, state] of finalEntities) {
    const info = familyTree.get(entityId);
    if (!info) continue;

    // 各世代の祖先との類似度を計算
    for (let gen = 1; gen <= 5; gen++) {
      const ancestorId = findAncestor(entityId, gen, familyTree);
      if (!ancestorId) continue;

      const ancestorState = finalEntities.get(ancestorId);
      if (!ancestorState) continue;  // 祖先が死亡している場合はスキップ

      const similarity = calculateStateSimilarity(state, ancestorState);

      if (!result.has(gen)) {
        result.set(gen, { count: 0, totalSimilarity: 0 });
      }
      const data = result.get(gen)!;
      data.count++;
      data.totalSimilarity += similarity;
    }
  }

  return result;
}

async function main() {
  console.log('=== H82検証: 世代数が離れるほど類似度は低下する ===\n');

  const seeds = [42, 123, 456, 789, 1000];
  const allResults: {
    seed: number;
    generationSimilarity: Map<number, { count: number; totalSimilarity: number }>;
    maxGeneration: number;
  }[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const { familyTree, finalEntities } = runSimulation(seed);
    const generationSimilarity = analyzeGenerationSimilarity(familyTree, finalEntities);

    // 最大世代を計算
    let maxGeneration = 0;
    for (const info of familyTree.values()) {
      if (info.generation > maxGeneration) {
        maxGeneration = info.generation;
      }
    }

    allResults.push({ seed, generationSimilarity, maxGeneration });

    console.log(`  最大世代: ${maxGeneration}`);
    console.log(`  生存エンティティ: ${finalEntities.size}`);
  }

  // 統計分析
  console.log('\n=== 世代別類似度 ===\n');

  console.log('| Seed | 1世代 | 2世代 | 3世代 | 4世代 | 5世代 | 最大世代 |');
  console.log('|------|-------|-------|-------|-------|-------|---------|');

  const aggregated = new Map<number, { count: number; totalSimilarity: number }>();

  for (const r of allResults) {
    const row = [r.seed.toString()];
    for (let gen = 1; gen <= 5; gen++) {
      const data = r.generationSimilarity.get(gen);
      if (data && data.count > 0) {
        const avg = data.totalSimilarity / data.count;
        row.push(`${avg.toFixed(3)} (${data.count})`);

        // 集計
        if (!aggregated.has(gen)) {
          aggregated.set(gen, { count: 0, totalSimilarity: 0 });
        }
        const agg = aggregated.get(gen)!;
        agg.count += data.count;
        agg.totalSimilarity += data.totalSimilarity;
      } else {
        row.push('-');
      }
    }
    row.push(r.maxGeneration.toString());
    console.log(`| ${row.join(' | ')} |`);
  }

  // 全体平均
  console.log('\n=== 全体平均 ===\n');

  console.log('| 世代差 | ペア数 | 平均類似度 |');
  console.log('|--------|--------|-----------|');

  const avgByGen: number[] = [];
  for (let gen = 1; gen <= 5; gen++) {
    const data = aggregated.get(gen);
    if (data && data.count > 0) {
      const avg = data.totalSimilarity / data.count;
      avgByGen.push(avg);
      console.log(`| ${gen} | ${data.count} | ${avg.toFixed(4)} |`);
    }
  }

  // 相関分析
  console.log('\n=== 相関分析 ===\n');

  if (avgByGen.length >= 2) {
    // 世代数と類似度の相関
    const n = avgByGen.length;
    const sumX = (n * (n + 1)) / 2;  // 1+2+3+...+n
    const sumY = avgByGen.reduce((a, b) => a + b, 0);
    const sumXY = avgByGen.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;  // 1^2+2^2+...+n^2
    const sumY2 = avgByGen.reduce((sum, y) => sum + y * y, 0);

    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    console.log(`世代数-類似度相関係数: ${correlation.toFixed(4)}`);

    // 減少率
    if (avgByGen.length >= 2) {
      const decreaseRate = (avgByGen[0] - avgByGen[avgByGen.length - 1]) / avgByGen[0] * 100;
      console.log(`1世代→${avgByGen.length}世代の減少率: ${decreaseRate.toFixed(1)}%`);
    }
  }

  // 結論
  console.log('\n=== 結論 ===\n');

  if (avgByGen.length >= 2 && avgByGen[0] > avgByGen[avgByGen.length - 1]) {
    const decreaseRate = (avgByGen[0] - avgByGen[avgByGen.length - 1]) / avgByGen[0] * 100;
    if (decreaseRate > 30) {
      console.log('H82を強く支持: 世代数が離れるほど類似度は低下する');
      console.log(`  → 1世代: ${avgByGen[0].toFixed(3)} → ${avgByGen.length}世代: ${avgByGen[avgByGen.length - 1].toFixed(3)}`);
      console.log(`  → 減少率: ${decreaseRate.toFixed(1)}%`);
    } else if (decreaseRate > 10) {
      console.log('H82を支持: 世代数が離れるほど類似度は低下する');
      console.log(`  → 減少率: ${decreaseRate.toFixed(1)}%`);
    } else {
      console.log('H82を部分的に支持: 類似度は低下するが、減少率は小さい');
      console.log(`  → 減少率: ${decreaseRate.toFixed(1)}%`);
    }
  } else {
    console.log('H82を棄却: 世代数が離れても類似度は低下しない');
  }
}

main().catch(console.error);
