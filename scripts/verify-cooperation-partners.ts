/**
 * 協力複製のパートナー分析スクリプト
 * 
 * 目的: H39「協力複製は弱者の互助として機能している」を検証
 * - 協力複製のパートナー同士のエネルギー状態を比較
 * - 強者-弱者ペアか、弱者-弱者ペアかを分析
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface PartnerPair {
  tick: number;
  parentId: string;
  partnerId: string;
  parentEnergy: number;
  partnerEnergy: number;
  parentAge: number;
  partnerAge: number;
}

interface PartnerAnalysis {
  seed: number;
  totalCooperativeReplications: number;
  // エネルギー比較
  avgParentEnergy: number;
  avgPartnerEnergy: number;
  // 年齢比較
  avgParentAge: number;
  avgPartnerAge: number;
  // ペアタイプ分類
  weakWeakPairs: number;  // 両方低エネルギー
  strongStrongPairs: number;  // 両方高エネルギー
  mixedPairs: number;  // 片方高、片方低
  // エネルギー差
  avgEnergyDiff: number;
  // 相関
  energyCorrelation: number;
}

function runSimulation(seed: number, ticks: number): PartnerAnalysis {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.018,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: 50,
      edgeDensity: 0.3,
    },
  });

  const partnerPairs: PartnerPair[] = [];
  const entityBirthTick: Map<string, number> = new Map();

  // 初期エンティティの誕生tickを記録
  for (const entity of universe.getAllEntities()) {
    entityBirthTick.set(entity.id, 0);
  }

  for (let t = 0; t < ticks; t++) {
    // 複製前のエンティティ状態を記録
    const entitiesBefore = new Map<string, number>();
    for (const entity of universe.getAllEntities()) {
      entitiesBefore.set(entity.id, entity.energy);
    }

    universe.step();
    
    const events = universe.getEventLog();
    
    // パートナー選択イベントを探す
    for (const event of events) {
      if (event.type === 'partnerSelected') {
        const partnerEvent = event as any;
        const parentId = partnerEvent.entityId;
        const partnerId = partnerEvent.partnerId;
        
        const parentEnergy = entitiesBefore.get(parentId) || 0;
        const partnerEnergy = entitiesBefore.get(partnerId) || 0;
        const parentBirth = entityBirthTick.get(parentId) || 0;
        const partnerBirth = entityBirthTick.get(partnerId) || 0;
        
        partnerPairs.push({
          tick: t,
          parentId,
          partnerId,
          parentEnergy,
          partnerEnergy,
          parentAge: t - parentBirth,
          partnerAge: t - partnerBirth,
        });
      } else if (event.type === 'replication') {
        const replicationEvent = event as any;
        entityBirthTick.set(replicationEvent.childId, t);
      }
    }
  }

  if (partnerPairs.length === 0) {
    return {
      seed,
      totalCooperativeReplications: 0,
      avgParentEnergy: 0,
      avgPartnerEnergy: 0,
      avgParentAge: 0,
      avgPartnerAge: 0,
      weakWeakPairs: 0,
      strongStrongPairs: 0,
      mixedPairs: 0,
      avgEnergyDiff: 0,
      energyCorrelation: 0,
    };
  }

  // 平均値を計算
  const avgParentEnergy = partnerPairs.reduce((sum, p) => sum + p.parentEnergy, 0) / partnerPairs.length;
  const avgPartnerEnergy = partnerPairs.reduce((sum, p) => sum + p.partnerEnergy, 0) / partnerPairs.length;
  const avgParentAge = partnerPairs.reduce((sum, p) => sum + p.parentAge, 0) / partnerPairs.length;
  const avgPartnerAge = partnerPairs.reduce((sum, p) => sum + p.partnerAge, 0) / partnerPairs.length;

  // エネルギー閾値を計算（絶対値: 複製に必要なエネルギーの目安）
  // 複製閾値は通常5-10程度なので、5を「低エネルギー」の閾値とする
  const lowEnergyThreshold = 5.0;
  const highEnergyThreshold = 15.0;

  // ペアタイプを分類
  let weakWeakPairs = 0;
  let strongStrongPairs = 0;
  let mixedPairs = 0;

  for (const pair of partnerPairs) {
    const parentWeak = pair.parentEnergy < lowEnergyThreshold;
    const partnerWeak = pair.partnerEnergy < lowEnergyThreshold;
    
    if (parentWeak && partnerWeak) {
      weakWeakPairs++;
    } else if (!parentWeak && !partnerWeak) {
      strongStrongPairs++;
    } else {
      mixedPairs++;
    }
  }

  // エネルギー差の平均
  const avgEnergyDiff = partnerPairs.reduce((sum, p) => sum + Math.abs(p.parentEnergy - p.partnerEnergy), 0) / partnerPairs.length;

  // 相関係数を計算
  const n = partnerPairs.length;
  const sumX = partnerPairs.reduce((sum, p) => sum + p.parentEnergy, 0);
  const sumY = partnerPairs.reduce((sum, p) => sum + p.partnerEnergy, 0);
  const sumXY = partnerPairs.reduce((sum, p) => sum + p.parentEnergy * p.partnerEnergy, 0);
  const sumX2 = partnerPairs.reduce((sum, p) => sum + p.parentEnergy * p.parentEnergy, 0);
  const sumY2 = partnerPairs.reduce((sum, p) => sum + p.partnerEnergy * p.partnerEnergy, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const energyCorrelation = denominator > 0 ? numerator / denominator : 0;

  return {
    seed,
    totalCooperativeReplications: partnerPairs.length,
    avgParentEnergy,
    avgPartnerEnergy,
    avgParentAge,
    avgPartnerAge,
    weakWeakPairs,
    strongStrongPairs,
    mixedPairs,
    avgEnergyDiff,
    energyCorrelation,
  };
}

async function main() {
  console.log('=== 協力複製のパートナー分析 ===\n');
  console.log('目的: H39「協力複製は弱者の互助として機能している」を検証\n');

  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 1500;

  const results: PartnerAnalysis[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed}...`);
    const result = runSimulation(seed, ticks);
    results.push(result);
    
    console.log(`  協力複製: ${result.totalCooperativeReplications}`);
    console.log(`  親エネルギー: ${result.avgParentEnergy.toFixed(1)}, パートナー: ${result.avgPartnerEnergy.toFixed(1)}`);
    console.log(`  ペアタイプ: 弱-弱=${result.weakWeakPairs}, 強-強=${result.strongStrongPairs}, 混合=${result.mixedPairs}`);
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  
  const validResults = results.filter(r => r.totalCooperativeReplications > 0);
  
  if (validResults.length === 0) {
    console.log('有効なデータがありません');
    return;
  }
  
  const avg = {
    totalCooperativeReplications: validResults.reduce((sum, r) => sum + r.totalCooperativeReplications, 0) / validResults.length,
    avgParentEnergy: validResults.reduce((sum, r) => sum + r.avgParentEnergy, 0) / validResults.length,
    avgPartnerEnergy: validResults.reduce((sum, r) => sum + r.avgPartnerEnergy, 0) / validResults.length,
    avgParentAge: validResults.reduce((sum, r) => sum + r.avgParentAge, 0) / validResults.length,
    avgPartnerAge: validResults.reduce((sum, r) => sum + r.avgPartnerAge, 0) / validResults.length,
    weakWeakPairs: validResults.reduce((sum, r) => sum + r.weakWeakPairs, 0) / validResults.length,
    strongStrongPairs: validResults.reduce((sum, r) => sum + r.strongStrongPairs, 0) / validResults.length,
    mixedPairs: validResults.reduce((sum, r) => sum + r.mixedPairs, 0) / validResults.length,
    avgEnergyDiff: validResults.reduce((sum, r) => sum + r.avgEnergyDiff, 0) / validResults.length,
    energyCorrelation: validResults.reduce((sum, r) => sum + r.energyCorrelation, 0) / validResults.length,
  };
  
  const totalPairs = avg.weakWeakPairs + avg.strongStrongPairs + avg.mixedPairs;
  
  console.log('協力複製統計:');
  console.log(`  総協力複製: ${avg.totalCooperativeReplications.toFixed(0)}`);
  
  console.log('\nエネルギー比較:');
  console.log(`  親の平均エネルギー: ${avg.avgParentEnergy.toFixed(2)}`);
  console.log(`  パートナーの平均エネルギー: ${avg.avgPartnerEnergy.toFixed(2)}`);
  console.log(`  エネルギー差の平均: ${avg.avgEnergyDiff.toFixed(2)}`);
  console.log(`  エネルギー相関係数: ${avg.energyCorrelation.toFixed(3)}`);
  
  console.log('\n年齢比較:');
  console.log(`  親の平均年齢: ${avg.avgParentAge.toFixed(1)} tick`);
  console.log(`  パートナーの平均年齢: ${avg.avgPartnerAge.toFixed(1)} tick`);
  
  console.log('\nペアタイプ分布:');
  console.log(`  弱者-弱者: ${avg.weakWeakPairs.toFixed(0)} (${(avg.weakWeakPairs / totalPairs * 100).toFixed(1)}%)`);
  console.log(`  強者-強者: ${avg.strongStrongPairs.toFixed(0)} (${(avg.strongStrongPairs / totalPairs * 100).toFixed(1)}%)`);
  console.log(`  混合（強-弱）: ${avg.mixedPairs.toFixed(0)} (${(avg.mixedPairs / totalPairs * 100).toFixed(1)}%)`);

  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  const weakWeakRatio = avg.weakWeakPairs / totalPairs;
  const mixedRatio = avg.mixedPairs / totalPairs;
  
  console.log('H39「協力複製は弱者の互助として機能している」の検証:');
  
  if (weakWeakRatio > 0.4) {
    console.log(`\n→ H39を支持: 弱者-弱者ペアが多い (${(weakWeakRatio * 100).toFixed(1)}%)`);
    console.log('  協力複製は「弱者の互助」として機能している');
  } else if (mixedRatio > 0.4) {
    console.log(`\n→ H39を部分的に棄却: 混合ペアが多い (${(mixedRatio * 100).toFixed(1)}%)`);
    console.log('  協力複製は「強者による弱者支援」の側面がある');
  } else {
    console.log('\n→ H39を棄却: ペアタイプに明確な傾向がない');
  }
  
  if (avg.energyCorrelation > 0.3) {
    console.log(`\n追加発見: エネルギー相関が正 (${avg.energyCorrelation.toFixed(3)})`);
    console.log('  → 似たエネルギー状態の個体同士がペアになる傾向（同類婚）');
  } else if (avg.energyCorrelation < -0.3) {
    console.log(`\n追加発見: エネルギー相関が負 (${avg.energyCorrelation.toFixed(3)})`);
    console.log('  → 異なるエネルギー状態の個体同士がペアになる傾向（異類婚）');
  }
}

main().catch(console.error);
