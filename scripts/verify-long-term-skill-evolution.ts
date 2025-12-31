#!/usr/bin/env npx ts-node
/**
 * 長期シミュレーションでのスキル進化検証
 * 
 * 検証項目:
 * 1. 10,000 tick以上でスキル分布がどう変化するか
 * 2. 特定のスキルパターンが選択されるか
 * 3. スキル値の分散が時間とともに変化するか
 */

import { Universe } from '../dist/core/universe.js';

interface SkillSnapshot {
  tick: number;
  entityCount: number;
  avgSkills: number[];
  skillVariance: number[];
  maxSkillIndex: number;  // 最も高い平均スキルのインデックス
  minSkillIndex: number;  // 最も低い平均スキルのインデックス
  skillRange: number;     // 最大-最小の差
}

function runLongTermSimulation(seed: number, maxTicks: number, snapshotInterval: number): SkillSnapshot[] {
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
    resourceRegenerationRate: 0.024,  // 活発レジーム
  });

  const snapshots: SkillSnapshot[] = [];

  for (let tick = 0; tick <= maxTicks; tick++) {
    universe.step();
    
    if (tick % snapshotInterval === 0) {
      const stats = universe.getStats();
      const skills = stats.skills;
      
      if (skills && stats.entityCount > 0) {
        const avgSkills = skills.avgSkills;
        const skillVariance = skills.skillVariance;
        
        // 最大・最小スキルを特定
        let maxIdx = 0, minIdx = 0;
        let maxVal = avgSkills[0] ?? 0, minVal = avgSkills[0] ?? 0;
        for (let i = 1; i < 8; i++) {
          if ((avgSkills[i] ?? 0) > maxVal) {
            maxVal = avgSkills[i] ?? 0;
            maxIdx = i;
          }
          if ((avgSkills[i] ?? 0) < minVal) {
            minVal = avgSkills[i] ?? 0;
            minIdx = i;
          }
        }
        
        snapshots.push({
          tick,
          entityCount: stats.entityCount,
          avgSkills: [...avgSkills],
          skillVariance: [...skillVariance],
          maxSkillIndex: maxIdx,
          minSkillIndex: minIdx,
          skillRange: maxVal - minVal,
        });
      } else {
        // 絶滅した場合
        snapshots.push({
          tick,
          entityCount: 0,
          avgSkills: [0, 0, 0, 0, 0, 0, 0, 0],
          skillVariance: [0, 0, 0, 0, 0, 0, 0, 0],
          maxSkillIndex: -1,
          minSkillIndex: -1,
          skillRange: 0,
        });
      }
    }
  }

  return snapshots;
}

function main() {
  console.log('=== 長期シミュレーションでのスキル進化検証 ===\n');

  const seeds = [1, 2, 3];
  const maxTicks = 10000;
  const snapshotInterval = 1000;
  const skillNames = ['Harvest', 'Repair', 'Create', 'Move', 'Interact', 'Replicate', 'Perception', 'Reserved'];

  console.log(`シミュレーション実行中... (${seeds.length} seeds × ${maxTicks} ticks)\n`);

  const allSnapshots: Map<number, SkillSnapshot[]> = new Map();

  for (const seed of seeds) {
    console.log(`  Seed ${seed}...`);
    const snapshots = runLongTermSimulation(seed, maxTicks, snapshotInterval);
    allSnapshots.set(seed, snapshots);
  }

  console.log('\n=== 時系列でのスキル分布変化 ===\n');

  // 各tickでの平均を計算
  const tickPoints = [0, 1000, 2000, 3000, 5000, 7000, 10000];
  
  console.log('Tick | Entities | Skill Range | Max Skill | Min Skill');
  console.log('-----|----------|-------------|-----------|----------');
  
  for (const tick of tickPoints) {
    const snapshotsAtTick: SkillSnapshot[] = [];
    for (const [, snapshots] of allSnapshots) {
      const s = snapshots.find(snap => snap.tick === tick);
      if (s && s.entityCount > 0) snapshotsAtTick.push(s);
    }
    
    if (snapshotsAtTick.length > 0) {
      const avgEntities = snapshotsAtTick.reduce((s, snap) => s + snap.entityCount, 0) / snapshotsAtTick.length;
      const avgRange = snapshotsAtTick.reduce((s, snap) => s + snap.skillRange, 0) / snapshotsAtTick.length;
      
      // 最も頻繁に最大/最小になるスキルを特定
      const maxCounts = new Array(8).fill(0);
      const minCounts = new Array(8).fill(0);
      for (const snap of snapshotsAtTick) {
        if (snap.maxSkillIndex >= 0) maxCounts[snap.maxSkillIndex]++;
        if (snap.minSkillIndex >= 0) minCounts[snap.minSkillIndex]++;
      }
      const mostMaxIdx = maxCounts.indexOf(Math.max(...maxCounts));
      const mostMinIdx = minCounts.indexOf(Math.max(...minCounts));
      
      console.log(`${tick.toString().padStart(5)} | ${avgEntities.toFixed(1).padStart(8)} | ${avgRange.toFixed(3).padStart(11)} | ${skillNames[mostMaxIdx]?.padStart(9)} | ${skillNames[mostMinIdx]?.padStart(9)}`);
    } else {
      console.log(`${tick.toString().padStart(5)} | (extinct)`);
    }
  }

  console.log('\n=== 個別シード詳細 ===\n');

  for (const [seed, snapshots] of allSnapshots) {
    console.log(`--- Seed ${seed} ---`);
    const initial = snapshots[0];
    const final = snapshots[snapshots.length - 1];
    
    if (initial && final && final.entityCount > 0) {
      console.log(`  初期 (tick 0): ${initial.entityCount} entities, range=${initial.skillRange.toFixed(3)}`);
      console.log(`  最終 (tick ${final.tick}): ${final.entityCount} entities, range=${final.skillRange.toFixed(3)}`);
      
      // スキル値の変化
      console.log('  スキル値の変化:');
      for (let i = 0; i < 8; i++) {
        const initVal = initial.avgSkills[i] ?? 0;
        const finalVal = final.avgSkills[i] ?? 0;
        const change = finalVal - initVal;
        const arrow = change > 0.05 ? '↑' : change < -0.05 ? '↓' : '→';
        console.log(`    ${skillNames[i]?.padEnd(12)}: ${initVal.toFixed(3)} ${arrow} ${finalVal.toFixed(3)} (${change >= 0 ? '+' : ''}${change.toFixed(3)})`);
      }
    } else if (final && final.entityCount === 0) {
      console.log(`  絶滅 (tick ${final.tick})`);
    }
    console.log('');
  }

  // 考察
  console.log('=== 考察 ===\n');

  // スキル範囲の変化を分析
  const initialRanges: number[] = [];
  const finalRanges: number[] = [];
  
  for (const [, snapshots] of allSnapshots) {
    const initial = snapshots[0];
    const final = snapshots[snapshots.length - 1];
    if (initial && final && final.entityCount > 0) {
      initialRanges.push(initial.skillRange);
      finalRanges.push(final.skillRange);
    }
  }

  if (initialRanges.length > 0 && finalRanges.length > 0) {
    const avgInitialRange = initialRanges.reduce((a, b) => a + b, 0) / initialRanges.length;
    const avgFinalRange = finalRanges.reduce((a, b) => a + b, 0) / finalRanges.length;
    
    if (avgFinalRange > avgInitialRange + 0.05) {
      console.log('✓ スキル範囲が拡大: 特定のスキルが選択されている可能性');
    } else if (avgFinalRange < avgInitialRange - 0.05) {
      console.log('△ スキル範囲が縮小: スキル値が均一化している');
    } else {
      console.log('△ スキル範囲に大きな変化なし');
    }
    
    console.log(`  初期平均範囲: ${avgInitialRange.toFixed(3)}`);
    console.log(`  最終平均範囲: ${avgFinalRange.toFixed(3)}`);
  }

  // 最も変化したスキルを特定
  const skillChanges = new Array(8).fill(0);
  let validCount = 0;
  
  for (const [, snapshots] of allSnapshots) {
    const initial = snapshots[0];
    const final = snapshots[snapshots.length - 1];
    if (initial && final && final.entityCount > 0) {
      for (let i = 0; i < 8; i++) {
        skillChanges[i] += (final.avgSkills[i] ?? 0) - (initial.avgSkills[i] ?? 0);
      }
      validCount++;
    }
  }

  if (validCount > 0) {
    for (let i = 0; i < 8; i++) {
      skillChanges[i] /= validCount;
    }
    
    const maxChangeIdx = skillChanges.indexOf(Math.max(...skillChanges));
    const minChangeIdx = skillChanges.indexOf(Math.min(...skillChanges));
    
    console.log(`\n最も増加したスキル: ${skillNames[maxChangeIdx]} (+${skillChanges[maxChangeIdx]?.toFixed(3)})`);
    console.log(`最も減少したスキル: ${skillNames[minChangeIdx]} (${skillChanges[minChangeIdx]?.toFixed(3)})`);
  }
}

main();
