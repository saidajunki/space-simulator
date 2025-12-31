/**
 * H57検証: 回復パターンは環境条件に依存する
 * 
 * 異なる環境条件（資源再生率、ノード数）で回復パターンの分布を比較
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface RecoveryPattern {
  popChange: 'increase' | 'decrease' | 'same';
  recoveryTime: number;
}

interface EnvironmentResult {
  regenRate: number;
  nodeCount: number;
  totalTraps: number;
  patterns: {
    increase: number;
    decrease: number;
    same: number;
  };
  avgRecoveryTime: {
    increase: number;
    decrease: number;
    same: number;
  };
}

function runSimulation(seed: number, regenRate: number, nodeCount: number): RecoveryPattern[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount,
      edgeDensity: 0.4,
      initialEntityCount: 30,
    },
    resourceRegenerationRate: regenRate,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  const patterns: RecoveryPattern[] = [];
  
  let prevScore = 0;
  let prevPop = 0;
  let trapTick = -1;
  let trapPop = 0;
  let inTrap = false;
  
  let windowCoopCount = 0;
  let windowReplicCount = 0;
  
  const ticks = 15000;
  const sampleInterval = 100;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    for (const event of universe.getEventLog()) {
      if (event.type === 'partnerSelected') windowCoopCount++;
      if (event.type === 'replication') windowReplicCount++;
    }
    universe.clearEventLog();
    
    if ((t + 1) % sampleInterval === 0 && stats.entityCount > 0) {
      const values = Array.from(stats.spatialDistribution.values());
      const shares = values.map(v => v / stats.entityCount);
      const hhi = shares.reduce((sum, s) => sum + s * s, 0);
      
      const artPerCapita = stats.artifactCount / stats.entityCount;
      const coopRate = windowReplicCount > 0 ? (windowCoopCount / windowReplicCount) * 100 : 0;
      
      let civScore = 0;
      if (stats.entityCount >= 10) civScore++;
      if (artPerCapita >= 5) civScore++;
      if (coopRate >= 50) civScore++;
      if (hhi >= 0.15) civScore++;
      
      if (prevScore === 4 && civScore < 4) {
        trapTick = t;
        trapPop = prevPop;
        inTrap = true;
      }
      
      if (inTrap && civScore === 4) {
        const popChange = stats.entityCount - trapPop;
        let pattern: 'increase' | 'decrease' | 'same';
        if (popChange > 0) pattern = 'increase';
        else if (popChange < 0) pattern = 'decrease';
        else pattern = 'same';
        
        patterns.push({
          popChange: pattern,
          recoveryTime: t - trapTick,
        });
        inTrap = false;
      }
      
      prevScore = civScore;
      prevPop = stats.entityCount;
      windowCoopCount = 0;
      windowReplicCount = 0;
    }
  }

  return patterns;
}

function analyzeEnvironment(regenRate: number, nodeCount: number, seeds: number[]): EnvironmentResult {
  const allPatterns: RecoveryPattern[] = [];
  
  for (const seed of seeds) {
    const patterns = runSimulation(seed, regenRate, nodeCount);
    allPatterns.push(...patterns);
  }
  
  const increase = allPatterns.filter(p => p.popChange === 'increase');
  const decrease = allPatterns.filter(p => p.popChange === 'decrease');
  const same = allPatterns.filter(p => p.popChange === 'same');
  
  const avgTime = (arr: RecoveryPattern[]) => 
    arr.length > 0 ? arr.reduce((s, p) => s + p.recoveryTime, 0) / arr.length : 0;
  
  return {
    regenRate,
    nodeCount,
    totalTraps: allPatterns.length,
    patterns: {
      increase: increase.length,
      decrease: decrease.length,
      same: same.length,
    },
    avgRecoveryTime: {
      increase: avgTime(increase),
      decrease: avgTime(decrease),
      same: avgTime(same),
    },
  };
}

// メイン実行
console.log('=== H57検証: 回復パターンは環境条件に依存する ===\n');

const seeds = [42, 123, 456, 789, 1000];

// 環境条件のバリエーション
const environments = [
  { regenRate: 0.016, nodeCount: 12, label: '低資源・少ノード' },
  { regenRate: 0.024, nodeCount: 12, label: '高資源・少ノード' },
  { regenRate: 0.016, nodeCount: 20, label: '低資源・多ノード' },
  { regenRate: 0.024, nodeCount: 20, label: '高資源・多ノード' },
];

const results: EnvironmentResult[] = [];

for (const env of environments) {
  console.log(`${env.label} (regenRate=${env.regenRate}, nodeCount=${env.nodeCount}) を実行中...`);
  const result = analyzeEnvironment(env.regenRate, env.nodeCount, seeds);
  results.push(result);
  console.log(`  総罠数: ${result.totalTraps}, 増加: ${result.patterns.increase}, 減少: ${result.patterns.decrease}, 同じ: ${result.patterns.same}`);
}

console.log('\n=== 結果比較 ===\n');

console.log('| 環境条件 | 総罠数 | 増加% | 減少% | 同じ% | 増加時間 | 減少時間 | 同じ時間 |');
console.log('|----------|--------|-------|-------|-------|----------|----------|----------|');

for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const total = r.totalTraps || 1;
  const incPct = (r.patterns.increase / total * 100).toFixed(1);
  const decPct = (r.patterns.decrease / total * 100).toFixed(1);
  const samePct = (r.patterns.same / total * 100).toFixed(1);
  
  console.log(`| ${environments[i].label} | ${r.totalTraps} | ${incPct}% | ${decPct}% | ${samePct}% | ${r.avgRecoveryTime.increase.toFixed(0)} | ${r.avgRecoveryTime.decrease.toFixed(0)} | ${r.avgRecoveryTime.same.toFixed(0)} |`);
}

// 分析
console.log('\n=== 分析 ===\n');

// 資源再生率の影響
const lowRegen = results.filter(r => r.regenRate === 0.016);
const highRegen = results.filter(r => r.regenRate === 0.024);

const lowRegenInc = lowRegen.reduce((s, r) => s + r.patterns.increase, 0) / lowRegen.reduce((s, r) => s + r.totalTraps, 0) * 100;
const highRegenInc = highRegen.reduce((s, r) => s + r.patterns.increase, 0) / highRegen.reduce((s, r) => s + r.totalTraps, 0) * 100;

console.log('【資源再生率の影響】');
console.log(`  低資源(0.016): 人口増加パターン ${lowRegenInc.toFixed(1)}%`);
console.log(`  高資源(0.024): 人口増加パターン ${highRegenInc.toFixed(1)}%`);

// ノード数の影響
const smallNode = results.filter(r => r.nodeCount === 12);
const largeNode = results.filter(r => r.nodeCount === 20);

const smallNodeInc = smallNode.reduce((s, r) => s + r.patterns.increase, 0) / smallNode.reduce((s, r) => s + r.totalTraps, 0) * 100;
const largeNodeInc = largeNode.reduce((s, r) => s + r.patterns.increase, 0) / largeNode.reduce((s, r) => s + r.totalTraps, 0) * 100;

console.log('\n【ノード数の影響】');
console.log(`  少ノード(12): 人口増加パターン ${smallNodeInc.toFixed(1)}%`);
console.log(`  多ノード(20): 人口増加パターン ${largeNodeInc.toFixed(1)}%`);

// 結論
console.log('\n=== 結論 ===');

const patternVariance = Math.abs(lowRegenInc - highRegenInc) + Math.abs(smallNodeInc - largeNodeInc);

if (patternVariance > 20) {
  console.log(`H57を支持: 回復パターンは環境条件に依存する（パターン差: ${patternVariance.toFixed(1)}%）`);
} else if (patternVariance > 10) {
  console.log(`H57を部分的に支持: 回復パターンは環境条件に弱く依存する（パターン差: ${patternVariance.toFixed(1)}%）`);
} else {
  console.log(`H57を棄却: 回復パターンは環境条件に依存しない（パターン差: ${patternVariance.toFixed(1)}%）`);
}
