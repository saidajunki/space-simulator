/**
 * 知識ボーナス（情報→行動の接続）の検証スクリプト
 */

import { Universe } from '../src/core/universe.js';

interface TestResult {
  seed: number;
  knowledgeBonusEnabled: boolean;
  finalEntities: number;
  finalArtifacts: number;
  totalRepairs: number;
  avgSimilarity: number;
  bonusAppliedCount: number;
  totalPrestige: number;
  avgArtifactAge: number;
}

function runTest(seed: number, knowledgeBonusEnabled: boolean, maxTicks: number): TestResult {
  const universe = new Universe({
    seed,
    worldGen: {
      nodeCount: 20,
      initialEntityCount: 30,
    },
    resourceRegenerationRate: 0.032, // 活発レジーム
    toolEffectEnabled: true,
    knowledgeBonusEnabled,
  });

  // 修復イベントを追跡
  let totalRepairs = 0;
  let totalSimilarity = 0;
  let bonusAppliedCount = 0;

  for (let tick = 0; tick < maxTicks; tick++) {
    universe.step();
    
    // 統計を取得
    const stats = universe.getStats();
    if (stats.knowledge) {
      totalRepairs += stats.knowledge.repairCountThisTick;
      totalSimilarity += stats.knowledge.avgSimilarity * stats.knowledge.repairCountThisTick;
      bonusAppliedCount += stats.knowledge.bonusAppliedCount;
    }
  }

  const finalStats = universe.getStats();
  
  return {
    seed,
    knowledgeBonusEnabled,
    finalEntities: finalStats.entityCount,
    finalArtifacts: finalStats.artifactCount,
    totalRepairs,
    avgSimilarity: totalRepairs > 0 ? totalSimilarity / totalRepairs : 0,
    bonusAppliedCount,
    totalPrestige: finalStats.totalPrestige ?? 0,
    avgArtifactAge: finalStats.avgArtifactAge ?? 0,
  };
}

// メイン
const seeds = [1, 2, 3, 42, 123];
const maxTicks = 3000;

console.log('=== 知識ボーナス検証 ===\n');
console.log(`設定: maxTicks=${maxTicks}, regenRate=0.032, nodes=20, entities=30\n`);

const resultsOn: TestResult[] = [];
const resultsOff: TestResult[] = [];

for (const seed of seeds) {
  console.log(`Seed ${seed}...`);
  
  const resultOn = runTest(seed, true, maxTicks);
  resultsOn.push(resultOn);
  
  const resultOff = runTest(seed, false, maxTicks);
  resultsOff.push(resultOff);
}

console.log('\n=== 結果 ===\n');

console.log('| Seed | KB | Entities | Artifacts | Repairs | AvgSim | BonusApplied | Prestige | AvgAge |');
console.log('|------|-----|----------|-----------|---------|--------|--------------|----------|--------|');

for (let i = 0; i < seeds.length; i++) {
  const on = resultsOn[i]!;
  const off = resultsOff[i]!;
  
  console.log(`| ${on.seed} | ON | ${on.finalEntities} | ${on.finalArtifacts} | ${on.totalRepairs} | ${on.avgSimilarity.toFixed(3)} | ${on.bonusAppliedCount} | ${on.totalPrestige.toFixed(0)} | ${on.avgArtifactAge.toFixed(0)} |`);
  console.log(`| ${off.seed} | OFF | ${off.finalEntities} | ${off.finalArtifacts} | ${off.totalRepairs} | ${off.avgSimilarity.toFixed(3)} | ${off.bonusAppliedCount} | ${off.totalPrestige.toFixed(0)} | ${off.avgArtifactAge.toFixed(0)} |`);
}

// 集計
const avgOn = {
  entities: resultsOn.reduce((s, r) => s + r.finalEntities, 0) / resultsOn.length,
  artifacts: resultsOn.reduce((s, r) => s + r.finalArtifacts, 0) / resultsOn.length,
  repairs: resultsOn.reduce((s, r) => s + r.totalRepairs, 0) / resultsOn.length,
  similarity: resultsOn.reduce((s, r) => s + r.avgSimilarity, 0) / resultsOn.length,
  bonusApplied: resultsOn.reduce((s, r) => s + r.bonusAppliedCount, 0) / resultsOn.length,
  prestige: resultsOn.reduce((s, r) => s + r.totalPrestige, 0) / resultsOn.length,
  avgAge: resultsOn.reduce((s, r) => s + r.avgArtifactAge, 0) / resultsOn.length,
};

const avgOff = {
  entities: resultsOff.reduce((s, r) => s + r.finalEntities, 0) / resultsOff.length,
  artifacts: resultsOff.reduce((s, r) => s + r.finalArtifacts, 0) / resultsOff.length,
  repairs: resultsOff.reduce((s, r) => s + r.totalRepairs, 0) / resultsOff.length,
  similarity: resultsOff.reduce((s, r) => s + r.avgSimilarity, 0) / resultsOff.length,
  bonusApplied: resultsOff.reduce((s, r) => s + r.bonusAppliedCount, 0) / resultsOff.length,
  prestige: resultsOff.reduce((s, r) => s + r.totalPrestige, 0) / resultsOff.length,
  avgAge: resultsOff.reduce((s, r) => s + r.avgArtifactAge, 0) / resultsOff.length,
};

console.log('\n=== 平均 ===\n');
console.log(`Knowledge Bonus ON:  Entities=${avgOn.entities.toFixed(1)}, Artifacts=${avgOn.artifacts.toFixed(1)}, Repairs=${avgOn.repairs.toFixed(1)}, AvgSim=${avgOn.similarity.toFixed(3)}, BonusApplied=${avgOn.bonusApplied.toFixed(1)}, Prestige=${avgOn.prestige.toFixed(0)}, AvgAge=${avgOn.avgAge.toFixed(0)}`);
console.log(`Knowledge Bonus OFF: Entities=${avgOff.entities.toFixed(1)}, Artifacts=${avgOff.artifacts.toFixed(1)}, Repairs=${avgOff.repairs.toFixed(1)}, AvgSim=${avgOff.similarity.toFixed(3)}, BonusApplied=${avgOff.bonusApplied.toFixed(1)}, Prestige=${avgOff.prestige.toFixed(0)}, AvgAge=${avgOff.avgAge.toFixed(0)}`);

console.log('\n=== 考察 ===\n');
if (avgOn.repairs > 0 || avgOff.repairs > 0) {
  console.log(`修復イベントが発生: ON=${avgOn.repairs.toFixed(1)}回, OFF=${avgOff.repairs.toFixed(1)}回`);
  console.log(`平均一致度: ${avgOn.similarity.toFixed(3)}`);
  console.log(`ボーナス適用率: ${(avgOn.bonusApplied / avgOn.repairs * 100).toFixed(1)}%`);
} else {
  console.log('修復イベントが発生していません。');
  console.log('これは、エンティティがrepairArtifact行動を選択していないことを意味します。');
}
