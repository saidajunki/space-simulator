/**
 * H61検証: 停滞からの脱出には「協力率の増加」が重要な役割を果たす
 * 
 * 検証方法:
 * - 罠-回復ペアの協力率変化を分析
 * - 協力率変化と回復時間の相関を計算
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface RecoveryData {
  trapTick: number;
  recoveryTick: number;
  recoveryTime: number;
  trapCoopRate: number;
  recoveryCoopRate: number;
  coopRateChange: number;
  pattern: 'increase' | 'decrease' | 'same';
}

function runSimulation(seed: number, ticks: number): RecoveryData[] {
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
  const data: RecoveryData[] = [];
  
  let prevScore = 0;
  let prevPop = 0;
  let prevHHI = 0;
  let prevCoopRate = 0;
  
  let trapTick = -1;
  let trapPop = 0;
  let trapCoopRate = 0;
  let inTrap = false;
  
  let windowPartnerSelections = 0;
  let windowReplications = 0;
  
  const sampleInterval = 100;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'partnerSelected') windowPartnerSelections++;
      if (event.type === 'replication') windowReplications++;
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
      
      // 罠の検出
      if (prevScore === 4 && civScore < 4) {
        trapTick = t;
        trapPop = prevPop;
        trapCoopRate = prevCoopRate;
        inTrap = true;
      }
      
      // 回復の検出
      if (inTrap && civScore === 4) {
        const popChange = stats.entityCount - trapPop;
        let pattern: 'increase' | 'decrease' | 'same';
        if (popChange > 1) {
          pattern = 'increase';
        } else if (popChange < -1) {
          pattern = 'decrease';
        } else {
          pattern = 'same';
        }

        data.push({
          trapTick,
          recoveryTick: t,
          recoveryTime: t - trapTick,
          trapCoopRate,
          recoveryCoopRate: coopRate,
          coopRateChange: coopRate - trapCoopRate,
          pattern,
        });
        inTrap = false;
      }
      
      prevScore = civScore;
      prevPop = stats.entityCount;
      prevHHI = hhi;
      prevCoopRate = coopRate;
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  return data;
}

// メイン実行
console.log('=== H61検証: 協力率と回復時間の相関 ===\n');

const seeds = [42, 123, 456, 789, 1000, 2000, 3000, 4000];
const ticks = 15000;
const allData: RecoveryData[] = [];

for (const seed of seeds) {
  console.log(`Seed ${seed} を実行中...`);
  const data = runSimulation(seed, ticks);
  allData.push(...data);
  console.log(`  罠→回復ペア: ${data.length}件`);
}

console.log(`\n総件数: ${allData.length}\n`);

if (allData.length < 5) {
  console.log('データが不足しています。');
  process.exit(0);
}

// 協力率変化と回復時間の相関
console.log('=== 協力率変化と回復時間の相関 ===\n');

const n = allData.length;
const sumX = allData.reduce((s, d) => s + d.coopRateChange, 0);
const sumY = allData.reduce((s, d) => s + d.recoveryTime, 0);
const sumXY = allData.reduce((s, d) => s + d.coopRateChange * d.recoveryTime, 0);
const sumX2 = allData.reduce((s, d) => s + d.coopRateChange * d.coopRateChange, 0);
const sumY2 = allData.reduce((s, d) => s + d.recoveryTime * d.recoveryTime, 0);

const corr = (n * sumXY - sumX * sumY) / 
  Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

console.log(`協力率変化と回復時間の相関: ${corr.toFixed(3)}`);
console.log('');

// 協力率変化の方向別
console.log('=== 協力率変化の方向別 ===\n');

const coopIncreased = allData.filter(d => d.coopRateChange > 10);
const coopDecreased = allData.filter(d => d.coopRateChange < -10);
const coopSame = allData.filter(d => Math.abs(d.coopRateChange) <= 10);

const avgTimeInc = coopIncreased.length > 0 
  ? coopIncreased.reduce((s, d) => s + d.recoveryTime, 0) / coopIncreased.length : 0;
const avgTimeDec = coopDecreased.length > 0 
  ? coopDecreased.reduce((s, d) => s + d.recoveryTime, 0) / coopDecreased.length : 0;
const avgTimeSame = coopSame.length > 0 
  ? coopSame.reduce((s, d) => s + d.recoveryTime, 0) / coopSame.length : 0;

console.log(`協力率増加（+10%以上）: ${coopIncreased.length}件, 平均回復時間: ${avgTimeInc.toFixed(0)} tick`);
console.log(`協力率減少（-10%以上）: ${coopDecreased.length}件, 平均回復時間: ${avgTimeDec.toFixed(0)} tick`);
console.log(`協力率維持（±10%以内）: ${coopSame.length}件, 平均回復時間: ${avgTimeSame.toFixed(0)} tick`);
console.log('');

// パターン別の協力率変化
console.log('=== パターン別の協力率変化 ===\n');

const byPattern = {
  increase: allData.filter(d => d.pattern === 'increase'),
  decrease: allData.filter(d => d.pattern === 'decrease'),
  same: allData.filter(d => d.pattern === 'same'),
};

for (const [pattern, items] of Object.entries(byPattern)) {
  if (items.length === 0) continue;
  const avgCoopChange = items.reduce((s, d) => s + d.coopRateChange, 0) / items.length;
  const avgTime = items.reduce((s, d) => s + d.recoveryTime, 0) / items.length;
  console.log(`${pattern}パターン: ${items.length}件`);
  console.log(`  平均協力率変化: ${avgCoopChange >= 0 ? '+' : ''}${avgCoopChange.toFixed(1)}%`);
  console.log(`  平均回復時間: ${avgTime.toFixed(0)} tick`);
}
console.log('');

// 結論
console.log('=== 結論 ===\n');

if (corr < -0.3) {
  console.log(`H61を支持: 協力率増加と回復時間に負の相関（${corr.toFixed(3)}）`);
  console.log('→ 協力率が増加するほど回復が速い');
} else if (corr > 0.3) {
  console.log(`H61を棄却: 協力率増加と回復時間に正の相関（${corr.toFixed(3)}）`);
  console.log('→ 協力率が増加するほど回復が遅い');
} else {
  console.log(`H61を部分的に棄却: 協力率変化と回復時間に明確な相関がない（${corr.toFixed(3)}）`);
}

// 追加の洞察
if (avgTimeInc < avgTimeDec && avgTimeInc < avgTimeSame) {
  console.log('\n追加の洞察: 協力率が増加した場合の回復が最も速い');
} else if (avgTimeDec < avgTimeInc && avgTimeDec < avgTimeSame) {
  console.log('\n追加の洞察: 協力率が減少した場合の回復が最も速い');
}
