/**
 * H55検証: 罠からの回復時間は人口減少の程度に依存する
 * 
 * 既存のverify-self-repair-mechanism.tsのデータを拡張して分析
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface TrapRecoveryData {
  trapTick: number;
  recoveryTick: number;
  recoveryTime: number;
  trapPop: number;
  recoveryPop: number;
  popChange: number;
  trapHHI: number;
  recoveryHHI: number;
  hhiChange: number;
}

function runSimulation(seed: number, ticks: number): TrapRecoveryData[] {
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
  const data: TrapRecoveryData[] = [];
  
  let prevScore = 0;
  let prevPop = 0;
  let prevHHI = 0;
  let trapTick = -1;
  let trapPop = 0;
  let trapHHI = 0;
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
      
      // 罠の検出（4/4 → 3以下）
      if (prevScore === 4 && civScore < 4) {
        trapTick = t;
        trapPop = prevPop;
        trapHHI = prevHHI;
        inTrap = true;
      }
      
      // 回復の検出（罠中 → 4/4）
      if (inTrap && civScore === 4) {
        data.push({
          trapTick,
          recoveryTick: t,
          recoveryTime: t - trapTick,
          trapPop,
          recoveryPop: stats.entityCount,
          popChange: stats.entityCount - trapPop,
          trapHHI,
          recoveryHHI: hhi,
          hhiChange: hhi - trapHHI,
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

  return data;
}

// メイン実行
console.log('=== H55検証: 罠からの回復時間と人口減少の関係 ===\n');

const seeds = [42, 123, 456, 789, 1000, 2000, 3000, 4000, 5000, 6000];
const ticks = 30000;
const allData: TrapRecoveryData[] = [];

for (const seed of seeds) {
  console.log(`Seed ${seed} を実行中...`);
  const data = runSimulation(seed, ticks);
  allData.push(...data);
  console.log(`  罠→回復ペア: ${data.length}件`);
}

console.log(`\n総ペア数: ${allData.length}\n`);

if (allData.length === 0) {
  console.log('データが不足しています。');
  process.exit(0);
}

// 相関分析
console.log('=== 相関分析 ===\n');

// 人口変化と回復時間の相関
const n = allData.length;
const sumX = allData.reduce((s, d) => s + d.popChange, 0);
const sumY = allData.reduce((s, d) => s + d.recoveryTime, 0);
const sumXY = allData.reduce((s, d) => s + d.popChange * d.recoveryTime, 0);
const sumX2 = allData.reduce((s, d) => s + d.popChange * d.popChange, 0);
const sumY2 = allData.reduce((s, d) => s + d.recoveryTime * d.recoveryTime, 0);

const corrPopRecovery = (n * sumXY - sumX * sumY) / 
  Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

console.log(`人口変化と回復時間の相関: ${corrPopRecovery.toFixed(3)}`);

// 人口減少の程度別の回復時間
console.log('\n=== 人口減少の程度別の回復時間 ===\n');

const popDecreased = allData.filter(d => d.popChange < 0);
const popSame = allData.filter(d => d.popChange === 0);
const popIncreased = allData.filter(d => d.popChange > 0);

const avgRecoveryDecreased = popDecreased.length > 0 
  ? popDecreased.reduce((s, d) => s + d.recoveryTime, 0) / popDecreased.length : 0;
const avgRecoverySame = popSame.length > 0 
  ? popSame.reduce((s, d) => s + d.recoveryTime, 0) / popSame.length : 0;
const avgRecoveryIncreased = popIncreased.length > 0 
  ? popIncreased.reduce((s, d) => s + d.recoveryTime, 0) / popIncreased.length : 0;

console.log(`人口減少: ${popDecreased.length}件, 平均回復時間: ${avgRecoveryDecreased.toFixed(0)} tick`);
console.log(`人口同じ: ${popSame.length}件, 平均回復時間: ${avgRecoverySame.toFixed(0)} tick`);
console.log(`人口増加: ${popIncreased.length}件, 平均回復時間: ${avgRecoveryIncreased.toFixed(0)} tick`);

// 人口減少の大きさ別
console.log('\n=== 人口減少の大きさ別の回復時間 ===\n');

const smallDecrease = allData.filter(d => d.popChange >= -2 && d.popChange < 0);
const mediumDecrease = allData.filter(d => d.popChange >= -5 && d.popChange < -2);
const largeDecrease = allData.filter(d => d.popChange < -5);

const avgSmall = smallDecrease.length > 0 
  ? smallDecrease.reduce((s, d) => s + d.recoveryTime, 0) / smallDecrease.length : 0;
const avgMedium = mediumDecrease.length > 0 
  ? mediumDecrease.reduce((s, d) => s + d.recoveryTime, 0) / mediumDecrease.length : 0;
const avgLarge = largeDecrease.length > 0 
  ? largeDecrease.reduce((s, d) => s + d.recoveryTime, 0) / largeDecrease.length : 0;

console.log(`小さい減少(-1〜-2): ${smallDecrease.length}件, 平均回復時間: ${avgSmall.toFixed(0)} tick`);
console.log(`中程度の減少(-3〜-5): ${mediumDecrease.length}件, 平均回復時間: ${avgMedium.toFixed(0)} tick`);
console.log(`大きい減少(-6以上): ${largeDecrease.length}件, 平均回復時間: ${avgLarge.toFixed(0)} tick`);

// 結論
console.log('\n=== 結論 ===');

if (corrPopRecovery < -0.3) {
  console.log(`H55を支持: 人口減少が大きいほど回復時間が長い（相関: ${corrPopRecovery.toFixed(3)}）`);
} else if (corrPopRecovery > 0.3) {
  console.log(`H55を棄却: 人口減少が大きいほど回復時間が短い（相関: ${corrPopRecovery.toFixed(3)}）`);
} else {
  console.log(`H55を棄却: 人口減少と回復時間に明確な相関がない（相関: ${corrPopRecovery.toFixed(3)}）`);
}

if (avgRecoveryDecreased > avgRecoveryIncreased * 1.2) {
  console.log(`  - 人口減少時の回復時間（${avgRecoveryDecreased.toFixed(0)}）は人口増加時（${avgRecoveryIncreased.toFixed(0)}）より長い`);
} else if (avgRecoveryDecreased < avgRecoveryIncreased * 0.8) {
  console.log(`  - 人口減少時の回復時間（${avgRecoveryDecreased.toFixed(0)}）は人口増加時（${avgRecoveryIncreased.toFixed(0)}）より短い`);
} else {
  console.log(`  - 人口減少時と人口増加時の回復時間に大きな差はない`);
}
