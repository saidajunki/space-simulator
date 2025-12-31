/**
 * 文明の罠からの回復パターン検証
 * 
 * 目的: H51の検証 - 「文明の罠は成長の自然な帰結であり、回避不可能」
 * 
 * 方法:
 * - 罠発生後の回復パターンを分析
 * - 回復までの時間、回復率を計測
 * - 罠が「一時的な後退」か「永続的な崩壊」かを判定
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface TrapEvent {
  tick: number;
  scoreBefore: number;
  scoreAfter: number;
  popBefore: number;
  popAfter: number;
  hhiBefore: number;
  hhiAfter: number;
}

interface RecoveryEvent {
  trapTick: number;
  recoveryTick: number;
  recoveryTime: number;
}

interface SimulationResult {
  seed: number;
  traps: TrapEvent[];
  recoveries: RecoveryEvent[];
  totalTraps: number;
  totalRecoveries: number;
  recoveryRate: number;
  avgRecoveryTime: number;
  finalScore: number;
}

function runSimulation(seed: number, ticks: number): SimulationResult {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 12,
      edgeDensity: 0.4,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: 0.024,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  
  const traps: TrapEvent[] = [];
  const recoveries: RecoveryEvent[] = [];
  
  let prevScore = 0;
  let prevPop = 0;
  let prevHHI = 0;
  let inTrap = false;
  let lastTrapTick = 0;
  
  let windowPartnerSelections = 0;
  let windowReplications = 0;
  
  const sampleInterval = 100;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'partnerSelected') {
        windowPartnerSelections++;
      }
      if (event.type === 'replication') {
        windowReplications++;
      }
    }
    universe.clearEventLog();
    
    if ((t + 1) % sampleInterval === 0 && stats.entityCount > 0) {
      const values = Array.from(stats.spatialDistribution.values());
      const shares = values.map(v => v / stats.entityCount);
      const hhi = shares.reduce((sum, s) => sum + s * s, 0);
      
      const artPerCapita = stats.artifactCount / stats.entityCount;
      const coopRate = windowReplications > 0 ? (windowPartnerSelections / windowReplications) * 100 : 0;
      
      let civScore = 0;
      if (stats.entityCount >= 10) civScore++;
      if (artPerCapita >= 5) civScore++;
      if (coopRate >= 50) civScore++;
      if (hhi >= 0.15) civScore++;
      
      // 罠の検出: 4/4から3/4以下に落ちた
      if (prevScore === 4 && civScore < 4) {
        traps.push({
          tick: t,
          scoreBefore: prevScore,
          scoreAfter: civScore,
          popBefore: prevPop,
          popAfter: stats.entityCount,
          hhiBefore: prevHHI,
          hhiAfter: hhi,
        });
        inTrap = true;
        lastTrapTick = t;
      }
      
      // 回復の検出: 罠状態から4/4に戻った
      if (inTrap && civScore === 4) {
        recoveries.push({
          trapTick: lastTrapTick,
          recoveryTick: t,
          recoveryTime: t - lastTrapTick,
        });
        inTrap = false;
      }
      
      prevScore = civScore;
      prevPop = stats.entityCount;
      prevHHI = hhi;
      
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  const totalTraps = traps.length;
  const totalRecoveries = recoveries.length;
  const recoveryRate = totalTraps > 0 ? (totalRecoveries / totalTraps) * 100 : 0;
  const avgRecoveryTime = totalRecoveries > 0 
    ? recoveries.reduce((sum, r) => sum + r.recoveryTime, 0) / totalRecoveries 
    : 0;

  return {
    seed,
    traps,
    recoveries,
    totalTraps,
    totalRecoveries,
    recoveryRate,
    avgRecoveryTime,
    finalScore: prevScore,
  };
}

function main() {
  console.log('=== 文明の罠からの回復パターン検証 ===\n');
  console.log('目的: H51の検証 - 「文明の罠は成長の自然な帰結であり、回避不可能」\n');
  
  const seeds = [42, 123, 456, 789, 1000, 2000, 3000, 4000, 5000, 6000];
  const ticks = 30000;
  
  console.log('条件:');
  console.log('- ノード数: 12');
  console.log('- 初期人口: 50');
  console.log('- 資源再生率: 0.024');
  console.log('- シミュレーション長: 30,000 tick');
  console.log('- Seed数: 10\n');
  
  const results: SimulationResult[] = [];
  
  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const result = runSimulation(seed, ticks);
    results.push(result);
    console.log(`  罠: ${result.totalTraps}回, 回復: ${result.totalRecoveries}回, 回復率: ${result.recoveryRate.toFixed(1)}%`);
  }
  
  // 集計
  console.log('\n=== 集計結果 ===\n');
  
  const totalTraps = results.reduce((sum, r) => sum + r.totalTraps, 0);
  const totalRecoveries = results.reduce((sum, r) => sum + r.totalRecoveries, 0);
  const overallRecoveryRate = totalTraps > 0 ? (totalRecoveries / totalTraps) * 100 : 0;
  
  const allRecoveryTimes = results.flatMap(r => r.recoveries.map(rec => rec.recoveryTime));
  const avgRecoveryTime = allRecoveryTimes.length > 0 
    ? allRecoveryTimes.reduce((a, b) => a + b, 0) / allRecoveryTimes.length 
    : 0;
  
  console.log(`総罠発生回数: ${totalTraps}`);
  console.log(`総回復回数: ${totalRecoveries}`);
  console.log(`全体回復率: ${overallRecoveryRate.toFixed(1)}%`);
  console.log(`平均回復時間: ${avgRecoveryTime.toFixed(0)} tick`);
  
  // 回復時間の分布
  console.log('\n=== 回復時間の分布 ===\n');
  
  const timeRanges = [
    { name: '0-500', min: 0, max: 500 },
    { name: '500-1000', min: 500, max: 1000 },
    { name: '1000-2000', min: 1000, max: 2000 },
    { name: '2000-5000', min: 2000, max: 5000 },
    { name: '5000+', min: 5000, max: Infinity },
  ];
  
  for (const range of timeRanges) {
    const count = allRecoveryTimes.filter(t => t >= range.min && t < range.max).length;
    const pct = allRecoveryTimes.length > 0 ? (count / allRecoveryTimes.length * 100).toFixed(1) : '0.0';
    console.log(`${range.name} tick: ${count}回 (${pct}%)`);
  }
  
  // 罠の原因分析
  console.log('\n=== 罠の原因分析 ===\n');
  
  const allTraps = results.flatMap(r => r.traps);
  
  // 人口変化
  const popDecreases = allTraps.filter(t => t.popAfter < t.popBefore);
  const popIncreases = allTraps.filter(t => t.popAfter > t.popBefore);
  const popSame = allTraps.filter(t => t.popAfter === t.popBefore);
  
  console.log('人口変化:');
  console.log(`  減少: ${popDecreases.length}回 (${(popDecreases.length / allTraps.length * 100).toFixed(1)}%)`);
  console.log(`  増加: ${popIncreases.length}回 (${(popIncreases.length / allTraps.length * 100).toFixed(1)}%)`);
  console.log(`  同じ: ${popSame.length}回 (${(popSame.length / allTraps.length * 100).toFixed(1)}%)`);
  
  // HHI変化
  const hhiDecreases = allTraps.filter(t => t.hhiAfter < t.hhiBefore);
  const hhiIncreases = allTraps.filter(t => t.hhiAfter > t.hhiBefore);
  
  console.log('\nHHI変化:');
  console.log(`  減少: ${hhiDecreases.length}回 (${(hhiDecreases.length / allTraps.length * 100).toFixed(1)}%)`);
  console.log(`  増加: ${hhiIncreases.length}回 (${(hhiIncreases.length / allTraps.length * 100).toFixed(1)}%)`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  if (overallRecoveryRate > 50) {
    console.log(`→ H51を棄却: 文明の罠からの回復率は${overallRecoveryRate.toFixed(1)}%と高い`);
    console.log('→ 罠は「一時的な後退」であり、回避不可能ではない');
  } else if (overallRecoveryRate > 20) {
    console.log(`→ H51は部分的に支持: 文明の罠からの回復率は${overallRecoveryRate.toFixed(1)}%`);
    console.log('→ 罠からの回復は可能だが、困難');
  } else {
    console.log(`→ H51を支持: 文明の罠からの回復率は${overallRecoveryRate.toFixed(1)}%と低い`);
    console.log('→ 罠は「永続的な崩壊」に近く、回避困難');
  }
  
  // 罠の主な原因
  if (hhiDecreases.length > popDecreases.length) {
    console.log('\n罠の主な原因: HHIの低下（人口分散）');
  } else {
    console.log('\n罠の主な原因: 人口の減少');
  }
}

main();
