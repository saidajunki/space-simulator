#!/usr/bin/env npx ts-node
/**
 * スキルボーナス係数の比較検証
 * 
 * 検証項目:
 * 1. 異なるボーナス係数（0.5, 1.0, 2.0）での比較
 * 2. 選択圧が観察されるか
 * 3. スキル分布の変化
 */

import { Universe } from '../dist/core/universe.js';

interface RunResult {
  coefficient: number;
  seed: number;
  finalEntityCount: number;
  finalArtifactCount: number;
  avgSkills: number[];
  skillRange: number;
  maxSkillIndex: number;
  exitReason: string;
}

function runSimulation(seed: number, coefficient: number, maxTicks: number): RunResult {
  const universe = new Universe({
    seed,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: 50,
      maxTypes: 10,
    },
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: coefficient,
    resourceRegenerationRate: 0.024,  // 活発レジーム
  });

  let exitReason = 'max_ticks';

  for (let tick = 0; tick < maxTicks; tick++) {
    universe.step();
    const stats = universe.getStats();
    
    if (stats.entityCount === 0) {
      exitReason = 'extinction';
      break;
    }
  }

  const stats = universe.getStats();
  const skills = stats.skills;
  const avgSkills = skills?.avgSkills ?? [0, 0, 0, 0, 0, 0, 0, 0];
  
  // 最大スキルを特定
  let maxIdx = 0;
  let maxVal = avgSkills[0] ?? 0;
  let minVal = avgSkills[0] ?? 0;
  for (let i = 1; i < 8; i++) {
    if ((avgSkills[i] ?? 0) > maxVal) {
      maxVal = avgSkills[i] ?? 0;
      maxIdx = i;
    }
    if ((avgSkills[i] ?? 0) < minVal) {
      minVal = avgSkills[i] ?? 0;
    }
  }

  return {
    coefficient,
    seed,
    finalEntityCount: stats.entityCount,
    finalArtifactCount: stats.artifactCount,
    avgSkills: [...avgSkills],
    skillRange: maxVal - minVal,
    maxSkillIndex: maxIdx,
    exitReason,
  };
}

function main() {
  console.log('=== スキルボーナス係数の比較検証 ===\n');

  const seeds = [1, 2, 3, 4, 5];
  const coefficients = [0.5, 1.0, 2.0];
  const maxTicks = 5000;
  const skillNames = ['Harvest', 'Repair', 'Create', 'Move', 'Interact', 'Replicate', 'Perception', 'Reserved'];

  console.log(`シミュレーション実行中... (${seeds.length} seeds × ${coefficients.length} coefficients × ${maxTicks} ticks)\n`);

  const results: Map<number, RunResult[]> = new Map();
  for (const coef of coefficients) {
    results.set(coef, []);
  }

  for (const seed of seeds) {
    for (const coef of coefficients) {
      console.log(`  Seed ${seed}, coefficient=${coef}...`);
      const result = runSimulation(seed, coef, maxTicks);
      results.get(coef)?.push(result);
    }
  }

  console.log('\n=== 結果サマリー ===\n');

  console.log('係数別比較:');
  console.log('┌────────────┬──────────────┬──────────────┬──────────────┬──────────────┐');
  console.log('│ 係数       │ 平均Entity   │ 平均Artifact │ 平均SkillRange│ 絶滅率       │');
  console.log('├────────────┼──────────────┼──────────────┼──────────────┼──────────────┤');

  for (const coef of coefficients) {
    const runs = results.get(coef) ?? [];
    const avgEntity = runs.reduce((s, r) => s + r.finalEntityCount, 0) / runs.length;
    const avgArtifact = runs.reduce((s, r) => s + r.finalArtifactCount, 0) / runs.length;
    const avgRange = runs.reduce((s, r) => s + r.skillRange, 0) / runs.length;
    const extinctionRate = runs.filter(r => r.exitReason === 'extinction').length / runs.length;
    
    console.log(`│ ${coef.toFixed(1).padStart(10)} │ ${avgEntity.toFixed(1).padStart(12)} │ ${avgArtifact.toFixed(1).padStart(12)} │ ${avgRange.toFixed(3).padStart(12)} │ ${(extinctionRate * 100).toFixed(0).padStart(11)}% │`);
  }
  console.log('└────────────┴──────────────┴──────────────┴──────────────┴──────────────┘');

  // 最も頻繁に最大になるスキル
  console.log('\n最も高いスキル（係数別）:');
  for (const coef of coefficients) {
    const runs = results.get(coef) ?? [];
    const maxCounts = new Array(8).fill(0);
    for (const r of runs) {
      if (r.maxSkillIndex >= 0) maxCounts[r.maxSkillIndex]++;
    }
    const mostMaxIdx = maxCounts.indexOf(Math.max(...maxCounts));
    console.log(`  係数 ${coef}: ${skillNames[mostMaxIdx]} (${maxCounts[mostMaxIdx]}/${runs.length})`);
  }

  // 平均スキル値の比較
  console.log('\n平均スキル値（係数別）:');
  for (const coef of coefficients) {
    const runs = results.get(coef) ?? [];
    const avgSkills = new Array(8).fill(0);
    let validCount = 0;
    for (const r of runs) {
      if (r.finalEntityCount > 0) {
        for (let i = 0; i < 8; i++) {
          avgSkills[i] += r.avgSkills[i] ?? 0;
        }
        validCount++;
      }
    }
    if (validCount > 0) {
      for (let i = 0; i < 8; i++) {
        avgSkills[i] /= validCount;
      }
    }
    
    console.log(`  係数 ${coef}:`);
    for (let i = 0; i < 8; i++) {
      const bar = '█'.repeat(Math.round(avgSkills[i] * 20));
      console.log(`    ${skillNames[i]?.padEnd(12)}: ${avgSkills[i].toFixed(3)} ${bar}`);
    }
    console.log('');
  }

  // 考察
  console.log('=== 考察 ===\n');

  const ranges: number[] = [];
  for (const coef of coefficients) {
    const runs = results.get(coef) ?? [];
    const avgRange = runs.reduce((s, r) => s + r.skillRange, 0) / runs.length;
    ranges.push(avgRange);
  }

  if (ranges[2]! > ranges[0]! + 0.05) {
    console.log('✓ 係数が高いほどスキル範囲が拡大: 選択圧が強まっている可能性');
  } else if (ranges[2]! < ranges[0]! - 0.05) {
    console.log('△ 係数が高いほどスキル範囲が縮小: 予想と逆の結果');
  } else {
    console.log('△ 係数によるスキル範囲の変化は軽微');
  }

  // 絶滅率の比較
  const extinctionRates: number[] = [];
  for (const coef of coefficients) {
    const runs = results.get(coef) ?? [];
    const rate = runs.filter(r => r.exitReason === 'extinction').length / runs.length;
    extinctionRates.push(rate);
  }

  if (extinctionRates[2]! > extinctionRates[0]! + 0.2) {
    console.log('✓ 係数が高いほど絶滅率が上昇: スキルが生存に影響している');
  } else if (extinctionRates[2]! < extinctionRates[0]! - 0.2) {
    console.log('✓ 係数が高いほど絶滅率が低下: 高スキル個体が生存に有利');
  } else {
    console.log('△ 係数による絶滅率の変化は軽微');
  }

  // Harvestスキルの変化
  const harvestChanges: number[] = [];
  for (const coef of coefficients) {
    const runs = results.get(coef) ?? [];
    let avgHarvest = 0;
    let count = 0;
    for (const r of runs) {
      if (r.finalEntityCount > 0) {
        avgHarvest += r.avgSkills[0] ?? 0;
        count++;
      }
    }
    harvestChanges.push(count > 0 ? avgHarvest / count : 0);
  }

  if (harvestChanges[2]! > harvestChanges[0]! + 0.05) {
    console.log('✓ 係数が高いほどHarvestスキルが上昇: 採取効率への選択圧');
  } else if (harvestChanges[2]! < harvestChanges[0]! - 0.05) {
    console.log('△ 係数が高いほどHarvestスキルが低下');
  } else {
    console.log('△ Harvestスキルへの選択圧は観察されず');
  }
}

main();
