/**
 * 文明の自己修復メカニズム検証
 * 
 * 目的: H54の検証 - 「文明には自己修復メカニズムがある」
 * 
 * 方法:
 * - 罠発生時と回復時の状態を詳細に比較
 * - 人口減少→集中→HHI回復のパターンを確認
 * - 回復に寄与する要因を特定
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface StateSnapshot {
  tick: number;
  population: number;
  artifacts: number;
  artPerCapita: number;
  coopRate: number;
  hhi: number;
  civScore: number;
  avgEnergy: number;
}

interface TrapRecoveryPair {
  trapState: StateSnapshot;
  recoveryState: StateSnapshot;
  recoveryTime: number;
  popChange: number;
  hhiChange: number;
  artChange: number;
}

function runSimulation(seed: number, ticks: number): TrapRecoveryPair[] {
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
  
  const pairs: TrapRecoveryPair[] = [];
  
  let prevState: StateSnapshot | null = null;
  let trapState: StateSnapshot | null = null;
  let inTrap = false;
  
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
      
      const currentState: StateSnapshot = {
        tick: t,
        population: stats.entityCount,
        artifacts: stats.artifactCount,
        artPerCapita,
        coopRate,
        hhi,
        civScore,
        avgEnergy: stats.averageEnergy,
      };
      
      // 罠の検出
      if (prevState && prevState.civScore === 4 && civScore < 4) {
        trapState = prevState;
        inTrap = true;
      }
      
      // 回復の検出
      if (inTrap && trapState && civScore === 4) {
        pairs.push({
          trapState,
          recoveryState: currentState,
          recoveryTime: t - trapState.tick,
          popChange: currentState.population - trapState.population,
          hhiChange: currentState.hhi - trapState.hhi,
          artChange: currentState.artifacts - trapState.artifacts,
        });
        inTrap = false;
        trapState = null;
      }
      
      prevState = currentState;
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  return pairs;
}

function main() {
  console.log('=== 文明の自己修復メカニズム検証 ===\n');
  console.log('目的: H54の検証 - 「文明には自己修復メカニズムがある」\n');
  
  const seeds = [42, 123, 456, 789, 1000, 2000, 3000, 4000, 5000, 6000];
  const ticks = 30000;
  
  console.log('条件:');
  console.log('- ノード数: 12');
  console.log('- 初期人口: 50');
  console.log('- 資源再生率: 0.024');
  console.log('- シミュレーション長: 30,000 tick\n');
  
  const allPairs: TrapRecoveryPair[] = [];
  
  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const pairs = runSimulation(seed, ticks);
    allPairs.push(...pairs);
    console.log(`  罠→回復ペア: ${pairs.length}件`);
  }
  
  console.log(`\n総ペア数: ${allPairs.length}\n`);
  
  if (allPairs.length === 0) {
    console.log('罠→回復ペアが見つかりませんでした。');
    return;
  }
  
  // 回復パターンの分析
  console.log('=== 回復パターンの分析 ===\n');
  
  // 人口変化の分析
  const popDecreased = allPairs.filter(p => p.popChange < 0);
  const popIncreased = allPairs.filter(p => p.popChange > 0);
  const popSame = allPairs.filter(p => p.popChange === 0);
  
  console.log('人口変化（罠時→回復時）:');
  console.log(`  減少: ${popDecreased.length}件 (${(popDecreased.length / allPairs.length * 100).toFixed(1)}%)`);
  console.log(`  増加: ${popIncreased.length}件 (${(popIncreased.length / allPairs.length * 100).toFixed(1)}%)`);
  console.log(`  同じ: ${popSame.length}件 (${(popSame.length / allPairs.length * 100).toFixed(1)}%)`);
  
  // HHI変化の分析
  const hhiIncreased = allPairs.filter(p => p.hhiChange > 0);
  const hhiDecreased = allPairs.filter(p => p.hhiChange < 0);
  
  console.log('\nHHI変化（罠時→回復時）:');
  console.log(`  増加: ${hhiIncreased.length}件 (${(hhiIncreased.length / allPairs.length * 100).toFixed(1)}%)`);
  console.log(`  減少: ${hhiDecreased.length}件 (${(hhiDecreased.length / allPairs.length * 100).toFixed(1)}%)`);
  
  // 自己修復パターンの検出
  // パターン: 人口減少 + HHI増加
  const selfRepairPattern = allPairs.filter(p => p.popChange < 0 && p.hhiChange > 0);
  console.log(`\n自己修復パターン（人口減少 + HHI増加）: ${selfRepairPattern.length}件 (${(selfRepairPattern.length / allPairs.length * 100).toFixed(1)}%)`);
  
  // 成長回復パターン: 人口増加 + HHI維持/増加
  const growthRecoveryPattern = allPairs.filter(p => p.popChange > 0 && p.hhiChange >= 0);
  console.log(`成長回復パターン（人口増加 + HHI維持/増加）: ${growthRecoveryPattern.length}件 (${(growthRecoveryPattern.length / allPairs.length * 100).toFixed(1)}%)`);
  
  // 統計
  console.log('\n=== 統計 ===\n');
  
  const avgPopChange = allPairs.reduce((sum, p) => sum + p.popChange, 0) / allPairs.length;
  const avgHHIChange = allPairs.reduce((sum, p) => sum + p.hhiChange, 0) / allPairs.length;
  const avgRecoveryTime = allPairs.reduce((sum, p) => sum + p.recoveryTime, 0) / allPairs.length;
  
  console.log(`平均人口変化: ${avgPopChange.toFixed(2)}`);
  console.log(`平均HHI変化: ${avgHHIChange.toFixed(4)}`);
  console.log(`平均回復時間: ${avgRecoveryTime.toFixed(0)} tick`);
  
  // 罠時と回復時の状態比較
  console.log('\n=== 罠時と回復時の状態比較 ===\n');
  
  const avgTrapPop = allPairs.reduce((sum, p) => sum + p.trapState.population, 0) / allPairs.length;
  const avgRecoveryPop = allPairs.reduce((sum, p) => sum + p.recoveryState.population, 0) / allPairs.length;
  const avgTrapHHI = allPairs.reduce((sum, p) => sum + p.trapState.hhi, 0) / allPairs.length;
  const avgRecoveryHHI = allPairs.reduce((sum, p) => sum + p.recoveryState.hhi, 0) / allPairs.length;
  const avgTrapArt = allPairs.reduce((sum, p) => sum + p.trapState.artPerCapita, 0) / allPairs.length;
  const avgRecoveryArt = allPairs.reduce((sum, p) => sum + p.recoveryState.artPerCapita, 0) / allPairs.length;
  
  console.log('指標\t\t罠時\t\t回復時\t\t変化');
  console.log(`人口\t\t${avgTrapPop.toFixed(1)}\t\t${avgRecoveryPop.toFixed(1)}\t\t${(avgRecoveryPop - avgTrapPop).toFixed(1)}`);
  console.log(`HHI\t\t${avgTrapHHI.toFixed(3)}\t\t${avgRecoveryHHI.toFixed(3)}\t\t${(avgRecoveryHHI - avgTrapHHI).toFixed(3)}`);
  console.log(`Art/人\t\t${avgTrapArt.toFixed(2)}\t\t${avgRecoveryArt.toFixed(2)}\t\t${(avgRecoveryArt - avgTrapArt).toFixed(2)}`);
  
  // 相関分析
  console.log('\n=== 相関分析 ===\n');
  
  // 人口変化とHHI変化の相関
  const n = allPairs.length;
  const sumX = allPairs.reduce((sum, p) => sum + p.popChange, 0);
  const sumY = allPairs.reduce((sum, p) => sum + p.hhiChange, 0);
  const sumXY = allPairs.reduce((sum, p) => sum + p.popChange * p.hhiChange, 0);
  const sumX2 = allPairs.reduce((sum, p) => sum + p.popChange * p.popChange, 0);
  const sumY2 = allPairs.reduce((sum, p) => sum + p.hhiChange * p.hhiChange, 0);
  
  const correlation = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  console.log(`人口変化とHHI変化の相関: ${correlation.toFixed(3)}`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  if (selfRepairPattern.length / allPairs.length > 0.3) {
    console.log(`→ H54を支持: 自己修復パターン（人口減少→HHI増加）が${(selfRepairPattern.length / allPairs.length * 100).toFixed(1)}%で観察された`);
    console.log('→ 文明には自己修復メカニズムがある');
  } else {
    console.log(`→ H54は部分的に支持: 自己修復パターンは${(selfRepairPattern.length / allPairs.length * 100).toFixed(1)}%`);
    console.log('→ 他の回復パターンも存在する');
  }
  
  if (correlation < -0.3) {
    console.log(`\n人口変化とHHI変化に負の相関（${correlation.toFixed(3)}）: 人口が減るとHHIが増える傾向`);
  }
}

main();
