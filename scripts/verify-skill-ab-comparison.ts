/**
 * スキルボーナスのA/B比較スクリプト
 * 
 * 目的: フィードバックに基づき、state→行動接続の効果を評価
 * - スキルボーナスON vs OFF
 * - 生存率、複製率、アーティファクト数などを比較
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface SimulationResult {
  seed: number;
  skillBonusEnabled: boolean;
  finalEntityCount: number;
  finalArtifactCount: number;
  totalReplications: number;
  totalDeaths: number;
  avgAge: number;
  survivalRate: number;
}

function runSimulation(seed: number, skillBonusEnabled: boolean, ticks: number): SimulationResult {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.016,
    skillBonusEnabled,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: 50,
      edgeDensity: 0.3,
    },
  });

  let totalReplications = 0;
  let totalDeaths = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'replication') totalReplications++;
      if (event.type === 'entityDied') totalDeaths++;
    }
  }

  const stats = universe.getStats();
  const survivalRate = totalDeaths > 0 ? totalReplications / totalDeaths : 1;

  return {
    seed,
    skillBonusEnabled,
    finalEntityCount: stats.entityCount,
    finalArtifactCount: stats.artifactCount,
    totalReplications,
    totalDeaths,
    avgAge: stats.averageAge,
    survivalRate,
  };
}

async function main() {
  console.log('=== スキルボーナスのA/B比較 ===\n');
  console.log('目的: state→行動接続の効果を評価\n');

  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 5000;

  const resultsOn: SimulationResult[] = [];
  const resultsOff: SimulationResult[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed}...`);
    
    // スキルボーナスON
    const resultOn = runSimulation(seed, true, ticks);
    resultsOn.push(resultOn);
    
    // スキルボーナスOFF
    const resultOff = runSimulation(seed, false, ticks);
    resultsOff.push(resultOff);
    
    console.log(`  ON:  人口=${resultOn.finalEntityCount}, アーティファクト=${resultOn.finalArtifactCount}, 複製=${resultOn.totalReplications}`);
    console.log(`  OFF: 人口=${resultOff.finalEntityCount}, アーティファクト=${resultOff.finalArtifactCount}, 複製=${resultOff.totalReplications}`);
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  
  const avgOn = {
    entityCount: resultsOn.reduce((sum, r) => sum + r.finalEntityCount, 0) / resultsOn.length,
    artifactCount: resultsOn.reduce((sum, r) => sum + r.finalArtifactCount, 0) / resultsOn.length,
    replications: resultsOn.reduce((sum, r) => sum + r.totalReplications, 0) / resultsOn.length,
    deaths: resultsOn.reduce((sum, r) => sum + r.totalDeaths, 0) / resultsOn.length,
    avgAge: resultsOn.reduce((sum, r) => sum + r.avgAge, 0) / resultsOn.length,
  };
  
  const avgOff = {
    entityCount: resultsOff.reduce((sum, r) => sum + r.finalEntityCount, 0) / resultsOff.length,
    artifactCount: resultsOff.reduce((sum, r) => sum + r.finalArtifactCount, 0) / resultsOff.length,
    replications: resultsOff.reduce((sum, r) => sum + r.totalReplications, 0) / resultsOff.length,
    deaths: resultsOff.reduce((sum, r) => sum + r.totalDeaths, 0) / resultsOff.length,
    avgAge: resultsOff.reduce((sum, r) => sum + r.avgAge, 0) / resultsOff.length,
  };
  
  console.log('スキルボーナスON:');
  console.log(`  平均人口: ${avgOn.entityCount.toFixed(1)}`);
  console.log(`  平均アーティファクト: ${avgOn.artifactCount.toFixed(1)}`);
  console.log(`  平均複製: ${avgOn.replications.toFixed(1)}`);
  console.log(`  平均死亡: ${avgOn.deaths.toFixed(1)}`);
  console.log(`  平均年齢: ${avgOn.avgAge.toFixed(1)}`);
  
  console.log('\nスキルボーナスOFF:');
  console.log(`  平均人口: ${avgOff.entityCount.toFixed(1)}`);
  console.log(`  平均アーティファクト: ${avgOff.artifactCount.toFixed(1)}`);
  console.log(`  平均複製: ${avgOff.replications.toFixed(1)}`);
  console.log(`  平均死亡: ${avgOff.deaths.toFixed(1)}`);
  console.log(`  平均年齢: ${avgOff.avgAge.toFixed(1)}`);
  
  // 差分
  console.log('\n差分 (ON - OFF):');
  console.log(`  人口: ${(avgOn.entityCount - avgOff.entityCount).toFixed(1)} (${((avgOn.entityCount - avgOff.entityCount) / avgOff.entityCount * 100).toFixed(1)}%)`);
  console.log(`  アーティファクト: ${(avgOn.artifactCount - avgOff.artifactCount).toFixed(1)} (${((avgOn.artifactCount - avgOff.artifactCount) / avgOff.artifactCount * 100).toFixed(1)}%)`);
  console.log(`  複製: ${(avgOn.replications - avgOff.replications).toFixed(1)} (${((avgOn.replications - avgOff.replications) / avgOff.replications * 100).toFixed(1)}%)`);
  console.log(`  死亡: ${(avgOn.deaths - avgOff.deaths).toFixed(1)} (${((avgOn.deaths - avgOff.deaths) / avgOff.deaths * 100).toFixed(1)}%)`);
  console.log(`  年齢: ${(avgOn.avgAge - avgOff.avgAge).toFixed(1)} (${((avgOn.avgAge - avgOff.avgAge) / avgOff.avgAge * 100).toFixed(1)}%)`);

  // 結論
  console.log('\n=== 結論 ===\n');
  
  const entityDiff = (avgOn.entityCount - avgOff.entityCount) / avgOff.entityCount;
  const artifactDiff = (avgOn.artifactCount - avgOff.artifactCount) / avgOff.artifactCount;
  
  if (entityDiff > 0.1 || artifactDiff > 0.1) {
    console.log('✓ スキルボーナスは有意な効果を持つ');
    console.log(`  人口差: ${(entityDiff * 100).toFixed(1)}%`);
    console.log(`  アーティファクト差: ${(artifactDiff * 100).toFixed(1)}%`);
    console.log('  → state→行動接続は機能している');
  } else if (entityDiff > 0.05 || artifactDiff > 0.05) {
    console.log('△ スキルボーナスは弱い効果を持つ');
    console.log(`  人口差: ${(entityDiff * 100).toFixed(1)}%`);
    console.log(`  アーティファクト差: ${(artifactDiff * 100).toFixed(1)}%`);
    console.log('  → state→行動接続は部分的に機能している');
  } else {
    console.log('✗ スキルボーナスの効果は検出されなかった');
    console.log(`  人口差: ${(entityDiff * 100).toFixed(1)}%`);
    console.log(`  アーティファクト差: ${(artifactDiff * 100).toFixed(1)}%`);
    console.log('  → state→行動接続の強化が必要');
  }
}

main().catch(console.error);
