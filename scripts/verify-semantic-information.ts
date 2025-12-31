#!/usr/bin/env npx ts-node
/**
 * セマンティック情報（スキルシステム）の検証スクリプト
 * 
 * 検証項目:
 * 1. スキルボーナスON/OFFの比較
 * 2. スキル分布の時系列変化
 * 3. ボーナス適用率の測定
 */

import { Universe } from '../dist/core/universe.js';

interface RunResult {
  skillBonusEnabled: boolean;
  seed: number;
  finalEntityCount: number;
  finalArtifactCount: number;
  avgSkills: number[];
  skillVariance: number[];
  bonusApplications: Record<string, number>;
  totalBonusApplications: number;
  avgStateFillRate: number;
  exitReason: string;
}

function runSimulation(seed: number, skillBonusEnabled: boolean, maxTicks: number): RunResult {
  const universe = new Universe({
    seed,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: 50,
      maxTypes: 10,
    },
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled,
    resourceRegenerationRate: 0.024,  // 活発レジーム
  });

  // シミュレーション実行
  let totalBonusApplications = 0;
  let lastStats: ReturnType<typeof universe.getStats> | null = null;
  let exitReason = 'max_ticks';

  for (let i = 0; i < maxTicks; i++) {
    universe.step();
    lastStats = universe.getStats();
    
    if (lastStats.skills) {
      totalBonusApplications += 
        (lastStats.skills.bonusApplications.harvest ?? 0) +
        (lastStats.skills.bonusApplications.repair ?? 0) +
        (lastStats.skills.bonusApplications.create ?? 0);
    }

    // 絶滅チェック
    if (lastStats.entityCount === 0) {
      exitReason = 'extinction';
      break;
    }
  }

  const skills = lastStats?.skills ?? {
    avgSkills: [0, 0, 0, 0, 0, 0, 0, 0],
    skillVariance: [0, 0, 0, 0, 0, 0, 0, 0],
    bonusApplications: { harvest: 0, repair: 0, create: 0 },
  };

  return {
    skillBonusEnabled,
    seed,
    finalEntityCount: lastStats?.entityCount ?? 0,
    finalArtifactCount: lastStats?.artifactCount ?? 0,
    avgSkills: skills.avgSkills,
    skillVariance: skills.skillVariance,
    bonusApplications: skills.bonusApplications,
    totalBonusApplications,
    avgStateFillRate: lastStats?.informationTransfer?.avgStateFillRate ?? 0,
    exitReason,
  };
}

function main() {
  console.log('=== セマンティック情報（スキルシステム）検証 ===\n');

  const seeds = [1, 2, 3, 4, 5];
  const maxTicks = 3000;

  const resultsOn: RunResult[] = [];
  const resultsOff: RunResult[] = [];

  console.log(`シミュレーション実行中... (${seeds.length} seeds × 2 conditions × ${maxTicks} ticks)\n`);

  for (const seed of seeds) {
    // スキルボーナスON
    console.log(`  Seed ${seed}, skillBonus=ON...`);
    const resultOn = runSimulation(seed, true, maxTicks);
    resultsOn.push(resultOn);

    // スキルボーナスOFF
    console.log(`  Seed ${seed}, skillBonus=OFF...`);
    const resultOff = runSimulation(seed, false, maxTicks);
    resultsOff.push(resultOff);
  }

  console.log('\n=== 結果サマリー ===\n');

  // 平均値計算
  const avgOn = {
    entityCount: resultsOn.reduce((s, r) => s + r.finalEntityCount, 0) / resultsOn.length,
    artifactCount: resultsOn.reduce((s, r) => s + r.finalArtifactCount, 0) / resultsOn.length,
    totalBonusApplications: resultsOn.reduce((s, r) => s + r.totalBonusApplications, 0) / resultsOn.length,
    avgStateFillRate: resultsOn.reduce((s, r) => s + r.avgStateFillRate, 0) / resultsOn.length,
    extinctionRate: resultsOn.filter(r => r.exitReason === 'extinction').length / resultsOn.length,
  };

  const avgOff = {
    entityCount: resultsOff.reduce((s, r) => s + r.finalEntityCount, 0) / resultsOff.length,
    artifactCount: resultsOff.reduce((s, r) => s + r.finalArtifactCount, 0) / resultsOff.length,
    totalBonusApplications: resultsOff.reduce((s, r) => s + r.totalBonusApplications, 0) / resultsOff.length,
    avgStateFillRate: resultsOff.reduce((s, r) => s + r.avgStateFillRate, 0) / resultsOff.length,
    extinctionRate: resultsOff.filter(r => r.exitReason === 'extinction').length / resultsOff.length,
  };

  console.log('スキルボーナスON vs OFF 比較:');
  console.log('┌─────────────────────────┬──────────────┬──────────────┐');
  console.log('│ 指標                    │ ON           │ OFF          │');
  console.log('├─────────────────────────┼──────────────┼──────────────┤');
  console.log(`│ 平均最終エンティティ数  │ ${avgOn.entityCount.toFixed(1).padStart(12)} │ ${avgOff.entityCount.toFixed(1).padStart(12)} │`);
  console.log(`│ 平均最終アーティファクト│ ${avgOn.artifactCount.toFixed(1).padStart(12)} │ ${avgOff.artifactCount.toFixed(1).padStart(12)} │`);
  console.log(`│ 平均ボーナス適用回数    │ ${avgOn.totalBonusApplications.toFixed(0).padStart(12)} │ ${avgOff.totalBonusApplications.toFixed(0).padStart(12)} │`);
  console.log(`│ 平均state充填率         │ ${(avgOn.avgStateFillRate * 100).toFixed(1).padStart(11)}% │ ${(avgOff.avgStateFillRate * 100).toFixed(1).padStart(11)}% │`);
  console.log(`│ 絶滅率                  │ ${(avgOn.extinctionRate * 100).toFixed(0).padStart(11)}% │ ${(avgOff.extinctionRate * 100).toFixed(0).padStart(11)}% │`);
  console.log('└─────────────────────────┴──────────────┴──────────────┘');

  // スキル分布の詳細
  console.log('\n=== スキル分布（スキルボーナスON、最終状態） ===\n');
  const skillNames = ['Harvest', 'Repair', 'Create', 'Move', 'Interact', 'Replicate', 'Perception', 'Reserved'];
  
  console.log('平均スキル値（0.0〜1.0）:');
  for (let i = 0; i < 8; i++) {
    const avgSkill = resultsOn.reduce((s, r) => s + (r.avgSkills[i] ?? 0), 0) / resultsOn.length;
    const avgVariance = resultsOn.reduce((s, r) => s + (r.skillVariance[i] ?? 0), 0) / resultsOn.length;
    const bar = '█'.repeat(Math.round(avgSkill * 20));
    console.log(`  ${skillNames[i]?.padEnd(12)}: ${avgSkill.toFixed(3)} ${bar} (σ²=${avgVariance.toFixed(4)})`);
  }

  // ボーナス適用の内訳
  console.log('\n=== ボーナス適用内訳（スキルボーナスON） ===\n');
  const totalHarvest = resultsOn.reduce((s, r) => s + (r.bonusApplications.harvest ?? 0), 0);
  const totalRepair = resultsOn.reduce((s, r) => s + (r.bonusApplications.repair ?? 0), 0);
  const totalCreate = resultsOn.reduce((s, r) => s + (r.bonusApplications.create ?? 0), 0);
  console.log(`  Harvest: ${totalHarvest} 回`);
  console.log(`  Repair:  ${totalRepair} 回`);
  console.log(`  Create:  ${totalCreate} 回`);

  // 個別結果
  console.log('\n=== 個別結果 ===\n');
  console.log('スキルボーナスON:');
  for (const r of resultsOn) {
    console.log(`  Seed ${r.seed}: E=${r.finalEntityCount}, A=${r.finalArtifactCount}, Bonus=${r.totalBonusApplications}, ${r.exitReason}`);
  }
  console.log('\nスキルボーナスOFF:');
  for (const r of resultsOff) {
    console.log(`  Seed ${r.seed}: E=${r.finalEntityCount}, A=${r.finalArtifactCount}, ${r.exitReason}`);
  }

  // 考察
  console.log('\n=== 考察 ===\n');
  
  const entityDiff = avgOn.entityCount - avgOff.entityCount;
  const artifactDiff = avgOn.artifactCount - avgOff.artifactCount;
  
  if (avgOn.totalBonusApplications > 0) {
    console.log(`✓ スキルボーナスが適用されている（平均 ${avgOn.totalBonusApplications.toFixed(0)} 回/シミュレーション）`);
  } else {
    console.log('✗ スキルボーナスが適用されていない');
  }

  if (Math.abs(entityDiff) > 5) {
    const direction = entityDiff > 0 ? '増加' : '減少';
    console.log(`✓ スキルボーナスONでエンティティ数が${direction}（差: ${entityDiff.toFixed(1)}）`);
  } else {
    console.log('△ エンティティ数への影響は軽微');
  }

  if (Math.abs(artifactDiff) > 1) {
    const direction = artifactDiff > 0 ? '増加' : '減少';
    console.log(`✓ スキルボーナスONでアーティファクト数が${direction}（差: ${artifactDiff.toFixed(1)}）`);
  } else {
    console.log('△ アーティファクト数への影響は軽微');
  }

  // スキル値の偏りチェック
  const avgSkillsOn = resultsOn.reduce((acc, r) => {
    for (let i = 0; i < 8; i++) {
      acc[i] = (acc[i] ?? 0) + (r.avgSkills[i] ?? 0);
    }
    return acc;
  }, new Array(8).fill(0)).map(v => v / resultsOn.length);
  
  const maxSkill = Math.max(...avgSkillsOn);
  const minSkill = Math.min(...avgSkillsOn);
  
  if (maxSkill - minSkill > 0.1) {
    console.log(`✓ スキル値に偏りが見られる（最大-最小: ${(maxSkill - minSkill).toFixed(3)}）`);
    console.log('  → 情報パターンが行動効率に影響を与えている可能性');
  } else {
    console.log('△ スキル値は均一に分布（偏りなし）');
  }
}

main();
