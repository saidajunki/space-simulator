/**
 * H58検証: 3つの回復パターンの詳細メカニズム
 * 
 * 仮説: 罠からの回復は「人口増加」「人口減少」「人口維持」の3つのパターンがあり、
 *       人口増加パターンが最も速い
 * 
 * verify-recovery-time.tsのデータを拡張して詳細分析
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface TrapRecoveryDetail {
  trapTick: number;
  recoveryTick: number;
  recoveryTime: number;
  trapPop: number;
  recoveryPop: number;
  popChange: number;
  trapHHI: number;
  recoveryHHI: number;
  hhiChange: number;
  trapArtPerPop: number;
  recoveryArtPerPop: number;
  pattern: 'increase' | 'decrease' | 'same';
}

function runSimulation(seed: number, ticks: number): TrapRecoveryDetail[] {
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
  const data: TrapRecoveryDetail[] = [];
  
  let prevScore = 0;
  let prevPop = 0;
  let prevHHI = 0;
  let prevArtPerPop = 0;
  let trapTick = -1;
  let trapPop = 0;
  let trapHHI = 0;
  let trapArtPerPop = 0;
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
        inTrap = true;
      }
      
      // 回復の検出（罠中 → 4/4）
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
          trapPop,
          recoveryPop: stats.entityCount,
          popChange,
          trapHHI,
          recoveryHHI: hhi,
          hhiChange: hhi - trapHHI,
          trapArtPerPop,
          recoveryArtPerPop: artPerCapita,
          pattern,
        });
        inTrap = false;
      }
      
      prevScore = civScore;
      prevPop = stats.entityCount;
      prevHHI = hhi;
      prevArtPerPop = artPerCapita;
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  return data;
}

// メイン実行
console.log('=== H58検証: 3つの回復パターンの詳細メカニズム ===\n');

const seeds = [42, 123, 456, 789, 1000, 2000, 3000, 4000, 5000, 6000];
const ticks = 20000;
const allData: TrapRecoveryDetail[] = [];

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

// パターン別集計
const byPattern = {
  increase: allData.filter(d => d.pattern === 'increase'),
  decrease: allData.filter(d => d.pattern === 'decrease'),
  same: allData.filter(d => d.pattern === 'same'),
};

console.log('=== パターン別統計 ===\n');

for (const [pattern, items] of Object.entries(byPattern)) {
  if (items.length === 0) {
    console.log(`【${pattern}パターン】 0件\n`);
    continue;
  }

  const avgRecoveryTime = items.reduce((s, d) => s + d.recoveryTime, 0) / items.length;
  const avgPopChange = items.reduce((s, d) => s + d.popChange, 0) / items.length;
  const avgHHIChange = items.reduce((s, d) => s + d.hhiChange, 0) / items.length;

  const avgTrapPop = items.reduce((s, d) => s + d.trapPop, 0) / items.length;
  const avgTrapHHI = items.reduce((s, d) => s + d.trapHHI, 0) / items.length;
  const avgRecoveryPop = items.reduce((s, d) => s + d.recoveryPop, 0) / items.length;
  const avgRecoveryHHI = items.reduce((s, d) => s + d.recoveryHHI, 0) / items.length;

  console.log(`【${pattern}パターン】 ${items.length}件 (${(items.length / allData.length * 100).toFixed(1)}%)`);
  console.log(`  平均回復時間: ${avgRecoveryTime.toFixed(0)} tick`);
  console.log(`  罠時 → 回復時:`);
  console.log(`    人口: ${avgTrapPop.toFixed(1)} → ${avgRecoveryPop.toFixed(1)} (${avgPopChange >= 0 ? '+' : ''}${avgPopChange.toFixed(1)})`);
  console.log(`    HHI: ${avgTrapHHI.toFixed(3)} → ${avgRecoveryHHI.toFixed(3)} (${avgHHIChange >= 0 ? '+' : ''}${avgHHIChange.toFixed(3)})`);
  console.log('');
}

// HHI変化の方向
console.log('=== HHI変化の方向 ===\n');
const hhiIncreased = allData.filter(d => d.hhiChange > 0.01);
const hhiDecreased = allData.filter(d => d.hhiChange < -0.01);
const hhiSame = allData.filter(d => Math.abs(d.hhiChange) <= 0.01);

console.log(`HHI増加: ${hhiIncreased.length}件 (${(hhiIncreased.length / allData.length * 100).toFixed(1)}%)`);
console.log(`HHI減少: ${hhiDecreased.length}件 (${(hhiDecreased.length / allData.length * 100).toFixed(1)}%)`);
console.log(`HHI維持: ${hhiSame.length}件 (${(hhiSame.length / allData.length * 100).toFixed(1)}%)`);
console.log('');

// パターン×HHI変化のクロス集計
console.log('=== パターン × HHI変化 ===\n');
console.log('| パターン | HHI増加 | HHI減少 | HHI維持 |');
console.log('|----------|---------|---------|---------|');
for (const [pattern, items] of Object.entries(byPattern)) {
  const inc = items.filter(d => d.hhiChange > 0.01).length;
  const dec = items.filter(d => d.hhiChange < -0.01).length;
  const same = items.filter(d => Math.abs(d.hhiChange) <= 0.01).length;
  console.log(`| ${pattern.padEnd(8)} | ${inc.toString().padStart(7)} | ${dec.toString().padStart(7)} | ${same.toString().padStart(7)} |`);
}
console.log('');

// 回復メカニズムの分析
console.log('=== 回復メカニズムの分析 ===\n');

// 各パターンの主要な回復メカニズム
for (const [pattern, items] of Object.entries(byPattern)) {
  if (items.length === 0) continue;
  
  const hhiIncCount = items.filter(d => d.hhiChange > 0.01).length;
  const hhiDecCount = items.filter(d => d.hhiChange < -0.01).length;
  
  console.log(`${pattern}パターンの回復メカニズム:`);
  if (hhiIncCount > hhiDecCount) {
    console.log(`  主要: HHI増加（集中化）による回復 (${(hhiIncCount / items.length * 100).toFixed(1)}%)`);
  } else if (hhiDecCount > hhiIncCount) {
    console.log(`  主要: HHI減少（分散化）による回復 (${(hhiDecCount / items.length * 100).toFixed(1)}%)`);
  } else {
    console.log(`  主要: HHI変化なしでの回復`);
  }
}
console.log('');

// 結論
console.log('=== 結論 ===\n');
const patterns = Object.entries(byPattern).filter(([_, items]) => items.length > 0);
if (patterns.length > 0) {
  const avgTimes = patterns.map(([pattern, items]) => ({
    pattern,
    avgTime: items.reduce((s, d) => s + d.recoveryTime, 0) / items.length,
    count: items.length,
  }));
  
  avgTimes.sort((a, b) => a.avgTime - b.avgTime);
  
  console.log('回復時間ランキング:');
  for (const { pattern, avgTime, count } of avgTimes) {
    console.log(`  ${pattern}: ${avgTime.toFixed(0)} tick (${count}件)`);
  }
  
  if (avgTimes[0].pattern === 'increase') {
    console.log('\nH58を支持: 人口増加パターンが最も速い');
  } else {
    console.log(`\nH58を部分的に棄却: ${avgTimes[0].pattern}パターンが最も速い`);
  }
  
  // 追加の洞察
  console.log('\n追加の洞察:');
  const increaseItems = byPattern.increase;
  const decreaseItems = byPattern.decrease;
  
  if (increaseItems.length > 0 && decreaseItems.length > 0) {
    const incHHIInc = increaseItems.filter(d => d.hhiChange > 0.01).length / increaseItems.length;
    const decHHIInc = decreaseItems.filter(d => d.hhiChange > 0.01).length / decreaseItems.length;
    
    console.log(`  - 人口増加パターンでHHI増加: ${(incHHIInc * 100).toFixed(1)}%`);
    console.log(`  - 人口減少パターンでHHI増加: ${(decHHIInc * 100).toFixed(1)}%`);
    
    if (decHHIInc > incHHIInc) {
      console.log('  → 人口減少パターンは「集中化」による回復が多い（自己修復メカニズム）');
    }
  }
}
