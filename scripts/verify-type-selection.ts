/**
 * H8検証: タイプの自然選択が起きている
 * 
 * 長期シミュレーションでタイプ分布の変化を観察し、
 * 特定のタイプが選択されているかを検証する
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface TypeStats {
  tick: number;
  typeDistribution: Map<string, number>;
  totalEntities: number;
  avgAge: number;
  avgEnergy: number;
}

function runSimulation(seed: number): TypeStats[] {
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
  const totalTicks = 10000;
  const snapshotInterval = 1000;
  const stats: TypeStats[] = [];

  for (let t = 0; t <= totalTicks; t++) {
    if (t > 0) {
      universe.step();
      universe.clearEventLog();
    }

    if (t % snapshotInterval === 0) {
      const entities = universe.getAllEntities();
      const typeDistribution = new Map<string, number>();
      let totalAge = 0;
      let totalEnergy = 0;

      for (const entity of entities) {
        const typeId = entity.type.id;
        typeDistribution.set(typeId, (typeDistribution.get(typeId) || 0) + 1);
        totalAge += entity.age;
        totalEnergy += entity.energy;
      }

      stats.push({
        tick: t,
        typeDistribution: new Map(typeDistribution),
        totalEntities: entities.length,
        avgAge: entities.length > 0 ? totalAge / entities.length : 0,
        avgEnergy: entities.length > 0 ? totalEnergy / entities.length : 0,
      });
    }
  }

  return stats;
}

function analyzeTypeSelection(stats: TypeStats[]): {
  initialTypes: string[];
  finalTypes: string[];
  typeChanges: Map<string, { initial: number; final: number; change: number }>;
  dominantType: string | null;
  extinctTypes: string[];
  newTypes: string[];
  selectionStrength: number;  // 0-1, 高いほど選択が強い
} {
  const initialStats = stats[0];
  const finalStats = stats[stats.length - 1];

  const initialTypes = Array.from(initialStats.typeDistribution.keys());
  const finalTypes = Array.from(finalStats.typeDistribution.keys());

  const typeChanges = new Map<string, { initial: number; final: number; change: number }>();
  const allTypes = new Set([...initialTypes, ...finalTypes]);

  for (const typeId of allTypes) {
    const initial = initialStats.typeDistribution.get(typeId) || 0;
    const final = finalStats.typeDistribution.get(typeId) || 0;
    typeChanges.set(typeId, {
      initial,
      final,
      change: final - initial,
    });
  }

  // 支配的なタイプを特定
  let dominantType: string | null = null;
  let maxFinal = 0;
  for (const [typeId, counts] of typeChanges) {
    if (counts.final > maxFinal) {
      maxFinal = counts.final;
      dominantType = typeId;
    }
  }

  // 絶滅したタイプと新しいタイプ
  const extinctTypes = initialTypes.filter(t => !finalTypes.includes(t));
  const newTypes = finalTypes.filter(t => !initialTypes.includes(t));

  // 選択の強さを計算（HHIの変化）
  const initialHHI = calculateHHI(initialStats.typeDistribution, initialStats.totalEntities);
  const finalHHI = calculateHHI(finalStats.typeDistribution, finalStats.totalEntities);
  const selectionStrength = Math.max(0, finalHHI - initialHHI);

  return {
    initialTypes,
    finalTypes,
    typeChanges,
    dominantType,
    extinctTypes,
    newTypes,
    selectionStrength,
  };
}

function calculateHHI(distribution: Map<string, number>, total: number): number {
  if (total === 0) return 0;
  let hhi = 0;
  for (const count of distribution.values()) {
    const share = count / total;
    hhi += share * share;
  }
  return hhi;
}

async function main() {
  console.log('=== H8検証: タイプの自然選択が起きている ===\n');

  const seeds = [42, 123, 456, 789, 1000];
  const allResults: { seed: number; stats: TypeStats[]; analysis: ReturnType<typeof analyzeTypeSelection> }[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const stats = runSimulation(seed);
    const analysis = analyzeTypeSelection(stats);
    allResults.push({ seed, stats, analysis });

    console.log(`  初期タイプ数: ${analysis.initialTypes.length}`);
    console.log(`  最終タイプ数: ${analysis.finalTypes.length}`);
    console.log(`  絶滅タイプ数: ${analysis.extinctTypes.length}`);
    console.log(`  選択強度: ${analysis.selectionStrength.toFixed(3)}`);
  }

  // 統計分析
  console.log('\n=== 統計分析 ===\n');

  const avgInitialTypes = allResults.reduce((s, r) => s + r.analysis.initialTypes.length, 0) / allResults.length;
  const avgFinalTypes = allResults.reduce((s, r) => s + r.analysis.finalTypes.length, 0) / allResults.length;
  const avgExtinctTypes = allResults.reduce((s, r) => s + r.analysis.extinctTypes.length, 0) / allResults.length;
  const avgSelectionStrength = allResults.reduce((s, r) => s + r.analysis.selectionStrength, 0) / allResults.length;

  console.log(`全体平均:`);
  console.log(`  初期タイプ数: ${avgInitialTypes.toFixed(1)}`);
  console.log(`  最終タイプ数: ${avgFinalTypes.toFixed(1)}`);
  console.log(`  絶滅タイプ数: ${avgExtinctTypes.toFixed(1)}`);
  console.log(`  選択強度: ${avgSelectionStrength.toFixed(3)}`);

  // タイプ分布の時系列変化
  console.log('\n=== タイプ分布の時系列変化（Seed 42）===\n');

  const seed42 = allResults.find(r => r.seed === 42)!;
  console.log('| Tick | 人口 | タイプ数 | HHI | 平均年齢 |');
  console.log('|------|------|---------|-----|---------|');
  for (const stat of seed42.stats) {
    const hhi = calculateHHI(stat.typeDistribution, stat.totalEntities);
    console.log(`| ${stat.tick} | ${stat.totalEntities} | ${stat.typeDistribution.size} | ${hhi.toFixed(3)} | ${stat.avgAge.toFixed(0)} |`);
  }

  // 結論
  console.log('\n=== 結論 ===\n');

  if (avgSelectionStrength > 0.1) {
    console.log('H8を強く支持: タイプの自然選択が起きている');
    console.log(`  → 選択強度: ${avgSelectionStrength.toFixed(3)}`);
    console.log(`  → タイプ数減少: ${avgInitialTypes.toFixed(1)} → ${avgFinalTypes.toFixed(1)}`);
  } else if (avgSelectionStrength > 0.05) {
    console.log('H8を支持: タイプの自然選択が弱く起きている');
    console.log(`  → 選択強度: ${avgSelectionStrength.toFixed(3)}`);
  } else if (avgExtinctTypes > 0) {
    console.log('H8を部分的に支持: タイプの絶滅は起きているが、選択は弱い');
    console.log(`  → 絶滅タイプ数: ${avgExtinctTypes.toFixed(1)}`);
  } else {
    console.log('H8を棄却: タイプの自然選択は観察されない');
  }

  // 詳細データ
  console.log('\n=== 詳細データ ===\n');
  console.log('| Seed | 初期タイプ | 最終タイプ | 絶滅 | 新規 | 選択強度 | 支配タイプ |');
  console.log('|------|-----------|-----------|------|------|---------|-----------|');
  for (const r of allResults) {
    console.log(`| ${r.seed} | ${r.analysis.initialTypes.length} | ${r.analysis.finalTypes.length} | ${r.analysis.extinctTypes.length} | ${r.analysis.newTypes.length} | ${r.analysis.selectionStrength.toFixed(3)} | ${r.analysis.dominantType || 'N/A'} |`);
  }

  // タイプ別の変化（Seed 42）
  console.log('\n=== タイプ別の変化（Seed 42）===\n');
  console.log('| タイプ | 初期 | 最終 | 変化 |');
  console.log('|--------|------|------|------|');
  const sortedChanges = Array.from(seed42.analysis.typeChanges.entries())
    .sort((a, b) => b[1].final - a[1].final);
  for (const [typeId, counts] of sortedChanges.slice(0, 10)) {
    const changeStr = counts.change >= 0 ? `+${counts.change}` : `${counts.change}`;
    console.log(`| ${typeId.slice(0, 8)} | ${counts.initial} | ${counts.final} | ${changeStr} |`);
  }
}

main().catch(console.error);
