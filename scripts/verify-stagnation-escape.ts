/**
 * H59検証: 人口維持パターンの回復が遅いのは「停滞」状態からの脱出が困難であるため
 * 
 * 検証方法:
 * - 人口維持パターンの詳細メカニズムを分析
 * - 何が変化して回復するのかを特定
 * - 停滞からの脱出条件を分析
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface StagnationDetail {
  trapTick: number;
  recoveryTick: number;
  recoveryTime: number;
  // 罠時の状態
  trapPop: number;
  trapHHI: number;
  trapArtPerPop: number;
  trapCoopRate: number;
  // 回復時の状態
  recoveryPop: number;
  recoveryHHI: number;
  recoveryArtPerPop: number;
  recoveryCoopRate: number;
  // 変化
  popChange: number;
  hhiChange: number;
  artPerPopChange: number;
  coopRateChange: number;
  // 回復の主因
  recoveryFactor: 'pop' | 'hhi' | 'artPerPop' | 'coopRate' | 'multiple';
}

function runSimulation(seed: number, ticks: number): StagnationDetail[] {
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
  const data: StagnationDetail[] = [];
  
  let prevScore = 0;
  let prevPop = 0;
  let prevHHI = 0;
  let prevArtPerPop = 0;
  let prevCoopRate = 0;
  
  let trapTick = -1;
  let trapPop = 0;
  let trapHHI = 0;
  let trapArtPerPop = 0;
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
      
      // 罠の検出（4/4 → 3以下）
      if (prevScore === 4 && civScore < 4) {
        trapTick = t;
        trapPop = prevPop;
        trapHHI = prevHHI;
        trapArtPerPop = prevArtPerPop;
        trapCoopRate = prevCoopRate;
        inTrap = true;
      }
      
      // 回復の検出（罠中 → 4/4）- 人口維持パターンのみ
      if (inTrap && civScore === 4) {
        const popChange = stats.entityCount - trapPop;
        
        // 人口維持パターン（-1〜+1）のみ記録
        if (Math.abs(popChange) <= 1) {
          const hhiChange = hhi - trapHHI;
          const artPerPopChange = artPerCapita - trapArtPerPop;
          const coopRateChange = coopRate - trapCoopRate;
          
          // 回復の主因を特定
          let recoveryFactor: 'pop' | 'hhi' | 'artPerPop' | 'coopRate' | 'multiple' = 'multiple';
          const factors: string[] = [];
          
          if (Math.abs(hhiChange) > 0.02) factors.push('hhi');
          if (Math.abs(artPerPopChange) > 1) factors.push('artPerPop');
          if (Math.abs(coopRateChange) > 10) factors.push('coopRate');
          
          if (factors.length === 1) {
            recoveryFactor = factors[0] as 'hhi' | 'artPerPop' | 'coopRate';
          } else if (factors.length === 0) {
            recoveryFactor = 'pop'; // 微小な変化
          }

          data.push({
            trapTick,
            recoveryTick: t,
            recoveryTime: t - trapTick,
            trapPop,
            trapHHI,
            trapArtPerPop,
            trapCoopRate,
            recoveryPop: stats.entityCount,
            recoveryHHI: hhi,
            recoveryArtPerPop: artPerCapita,
            recoveryCoopRate: coopRate,
            popChange,
            hhiChange,
            artPerPopChange,
            coopRateChange,
            recoveryFactor,
          });
        }
        inTrap = false;
      }
      
      prevScore = civScore;
      prevPop = stats.entityCount;
      prevHHI = hhi;
      prevArtPerPop = artPerCapita;
      prevCoopRate = coopRate;
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  return data;
}

// メイン実行
console.log('=== H59検証: 人口維持パターンの回復メカニズム ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 15000;
const allData: StagnationDetail[] = [];

for (const seed of seeds) {
  console.log(`Seed ${seed} を実行中...`);
  const data = runSimulation(seed, ticks);
  allData.push(...data);
  console.log(`  人口維持パターン: ${data.length}件`);
}

console.log(`\n総件数: ${allData.length}\n`);

if (allData.length === 0) {
  console.log('データが不足しています。');
  process.exit(0);
}

// 回復時間の分布
console.log('=== 回復時間の分布 ===\n');
const avgRecoveryTime = allData.reduce((s, d) => s + d.recoveryTime, 0) / allData.length;
const minRecoveryTime = Math.min(...allData.map(d => d.recoveryTime));
const maxRecoveryTime = Math.max(...allData.map(d => d.recoveryTime));

console.log(`平均回復時間: ${avgRecoveryTime.toFixed(0)} tick`);
console.log(`最短: ${minRecoveryTime} tick`);
console.log(`最長: ${maxRecoveryTime} tick`);
console.log('');

// 回復時間の分布
const timeRanges = [
  { min: 0, max: 500, label: '0-500' },
  { min: 500, max: 1000, label: '500-1000' },
  { min: 1000, max: 2000, label: '1000-2000' },
  { min: 2000, max: 5000, label: '2000-5000' },
  { min: 5000, max: Infinity, label: '5000+' },
];

console.log('| 時間範囲 | 件数 | 割合 |');
console.log('|----------|------|------|');
for (const range of timeRanges) {
  const count = allData.filter(d => d.recoveryTime >= range.min && d.recoveryTime < range.max).length;
  console.log(`| ${range.label.padEnd(8)} | ${count.toString().padStart(4)} | ${(count / allData.length * 100).toFixed(1)}% |`);
}
console.log('');

// 回復の主因
console.log('=== 回復の主因 ===\n');
const byFactor = {
  hhi: allData.filter(d => d.recoveryFactor === 'hhi'),
  artPerPop: allData.filter(d => d.recoveryFactor === 'artPerPop'),
  coopRate: allData.filter(d => d.recoveryFactor === 'coopRate'),
  multiple: allData.filter(d => d.recoveryFactor === 'multiple'),
  pop: allData.filter(d => d.recoveryFactor === 'pop'),
};

console.log('| 主因 | 件数 | 割合 | 平均回復時間 |');
console.log('|------|------|------|--------------|');
for (const [factor, items] of Object.entries(byFactor)) {
  if (items.length === 0) continue;
  const avgTime = items.reduce((s, d) => s + d.recoveryTime, 0) / items.length;
  console.log(`| ${factor.padEnd(10)} | ${items.length.toString().padStart(4)} | ${(items.length / allData.length * 100).toFixed(1)}% | ${avgTime.toFixed(0)} tick |`);
}
console.log('');

// 変化の詳細
console.log('=== 変化の詳細 ===\n');
const avgHHIChange = allData.reduce((s, d) => s + d.hhiChange, 0) / allData.length;
const avgArtPerPopChange = allData.reduce((s, d) => s + d.artPerPopChange, 0) / allData.length;
const avgCoopRateChange = allData.reduce((s, d) => s + d.coopRateChange, 0) / allData.length;

console.log(`平均HHI変化: ${avgHHIChange >= 0 ? '+' : ''}${avgHHIChange.toFixed(4)}`);
console.log(`平均Art/人変化: ${avgArtPerPopChange >= 0 ? '+' : ''}${avgArtPerPopChange.toFixed(2)}`);
console.log(`平均協力率変化: ${avgCoopRateChange >= 0 ? '+' : ''}${avgCoopRateChange.toFixed(1)}%`);
console.log('');

// 罠時の状態
console.log('=== 罠時の状態 ===\n');
const avgTrapPop = allData.reduce((s, d) => s + d.trapPop, 0) / allData.length;
const avgTrapHHI = allData.reduce((s, d) => s + d.trapHHI, 0) / allData.length;
const avgTrapArtPerPop = allData.reduce((s, d) => s + d.trapArtPerPop, 0) / allData.length;
const avgTrapCoopRate = allData.reduce((s, d) => s + d.trapCoopRate, 0) / allData.length;

console.log(`平均人口: ${avgTrapPop.toFixed(1)}`);
console.log(`平均HHI: ${avgTrapHHI.toFixed(3)}`);
console.log(`平均Art/人: ${avgTrapArtPerPop.toFixed(2)}`);
console.log(`平均協力率: ${avgTrapCoopRate.toFixed(1)}%`);
console.log('');

// 結論
console.log('=== 結論 ===\n');

// 最も多い回復主因
const maxFactor = Object.entries(byFactor)
  .filter(([_, items]) => items.length > 0)
  .sort((a, b) => b[1].length - a[1].length)[0];

if (maxFactor) {
  console.log(`最も多い回復主因: ${maxFactor[0]} (${(maxFactor[1].length / allData.length * 100).toFixed(1)}%)`);
}

// 停滞の特徴
if (avgRecoveryTime > 800) {
  console.log(`\n人口維持パターンの回復時間（${avgRecoveryTime.toFixed(0)} tick）は長い。`);
  console.log('これは「停滞」状態からの脱出が困難であることを示唆。');
  console.log('\nH59を支持: 人口維持パターンの回復が遅いのは「停滞」状態からの脱出が困難であるため');
} else {
  console.log(`\n人口維持パターンの回復時間（${avgRecoveryTime.toFixed(0)} tick）は比較的短い。`);
  console.log('H59を部分的に棄却: 停滞からの脱出は困難ではない');
}

// 追加の洞察
console.log('\n追加の洞察:');
if (byFactor.multiple.length > byFactor.hhi.length && byFactor.multiple.length > byFactor.artPerPop.length) {
  console.log('- 回復は複数の要因の組み合わせで起きることが多い');
}
if (avgHHIChange > 0) {
  console.log('- HHIは平均的に増加する傾向（集中化）');
} else {
  console.log('- HHIは平均的に減少する傾向（分散化）');
}
