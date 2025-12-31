/**
 * 協力複製と個体の余裕の関係検証スクリプト
 * 
 * 目的: H37「協力複製を行う個体は余裕のある長寿個体」を検証
 * - 協力複製前のエネルギー状態を分析
 * - 協力複製を行う個体の年齢を分析
 * - 協力 vs 単独複製の個体特性を比較
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface ReplicationData {
  tick: number;
  parentId: string;
  childId: string;
  isCooperative: boolean;
  parentEnergyBefore: number;
  parentAge: number;
  parentPrestige: number;
}

interface AffluenceAnalysis {
  seed: number;
  totalReplications: number;
  cooperativeReplications: number;
  soloReplications: number;
  // エネルギー比較
  avgCooperativeEnergy: number;
  avgSoloEnergy: number;
  // 年齢比較
  avgCooperativeAge: number;
  avgSoloAge: number;
  // Prestige比較
  avgCooperativePrestige: number;
  avgSoloPrestige: number;
  // 分布
  cooperativeEnergyDistribution: number[];
  soloEnergyDistribution: number[];
  cooperativeAgeDistribution: number[];
  soloAgeDistribution: number[];
}

function runSimulation(seed: number, ticks: number): AffluenceAnalysis {
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

  const replicationData: ReplicationData[] = [];
  const entityBirthTick: Map<string, number> = new Map();
  const entityPrestige: Map<string, number> = new Map();

  // 初期エンティティの誕生tickを記録
  for (const entity of universe.getAllEntities()) {
    entityBirthTick.set(entity.id, 0);
    entityPrestige.set(entity.id, 0);
  }

  for (let t = 0; t < ticks; t++) {
    // 複製前のエンティティ状態を記録
    const entitiesBefore = new Map<string, { energy: number; prestige: number }>();
    for (const entity of universe.getAllEntities()) {
      entitiesBefore.set(entity.id, {
        energy: entity.energy,
        prestige: entityPrestige.get(entity.id) || 0,
      });
    }

    universe.step();
    
    const events = universe.getEventLog();
    
    // Prestigeを更新（アーティファクト生成で増加）
    for (const event of events) {
      if (event.type === 'artifactCreated') {
        const createEvent = event as any;
        const currentPrestige = entityPrestige.get(createEvent.creatorId) || 0;
        entityPrestige.set(createEvent.creatorId, currentPrestige + 1);
      }
    }
    
    for (const event of events) {
      if (event.type === 'replication') {
        const replicationEvent = event as any;
        const parentId = replicationEvent.parentId;
        const childId = replicationEvent.childId;
        
        // 協力複製かどうかを判定
        const isCooperative = events.some(
          e => e.type === 'partnerSelected' && e.tick === event.tick
        );
        
        const parentState = entitiesBefore.get(parentId);
        const birthTick = entityBirthTick.get(parentId) || 0;
        
        replicationData.push({
          tick: t,
          parentId,
          childId,
          isCooperative,
          parentEnergyBefore: parentState?.energy || 0,
          parentAge: t - birthTick,
          parentPrestige: parentState?.prestige || 0,
        });
        
        entityBirthTick.set(childId, t);
        entityPrestige.set(childId, 0);
      }
    }
  }

  // 協力複製と単独複製を分離
  const cooperativeData = replicationData.filter(d => d.isCooperative);
  const soloData = replicationData.filter(d => !d.isCooperative);

  // 平均値を計算
  const avgCooperativeEnergy = cooperativeData.length > 0
    ? cooperativeData.reduce((sum, d) => sum + d.parentEnergyBefore, 0) / cooperativeData.length
    : 0;
  const avgSoloEnergy = soloData.length > 0
    ? soloData.reduce((sum, d) => sum + d.parentEnergyBefore, 0) / soloData.length
    : 0;
  
  const avgCooperativeAge = cooperativeData.length > 0
    ? cooperativeData.reduce((sum, d) => sum + d.parentAge, 0) / cooperativeData.length
    : 0;
  const avgSoloAge = soloData.length > 0
    ? soloData.reduce((sum, d) => sum + d.parentAge, 0) / soloData.length
    : 0;
  
  const avgCooperativePrestige = cooperativeData.length > 0
    ? cooperativeData.reduce((sum, d) => sum + d.parentPrestige, 0) / cooperativeData.length
    : 0;
  const avgSoloPrestige = soloData.length > 0
    ? soloData.reduce((sum, d) => sum + d.parentPrestige, 0) / soloData.length
    : 0;

  // 分布を計算（四分位）
  const getDistribution = (data: number[]): number[] => {
    if (data.length === 0) return [0, 0, 0, 0, 0];
    const sorted = [...data].sort((a, b) => a - b);
    return [
      sorted[0],
      sorted[Math.floor(sorted.length * 0.25)],
      sorted[Math.floor(sorted.length * 0.5)],
      sorted[Math.floor(sorted.length * 0.75)],
      sorted[sorted.length - 1],
    ];
  };

  return {
    seed,
    totalReplications: replicationData.length,
    cooperativeReplications: cooperativeData.length,
    soloReplications: soloData.length,
    avgCooperativeEnergy,
    avgSoloEnergy,
    avgCooperativeAge,
    avgSoloAge,
    avgCooperativePrestige,
    avgSoloPrestige,
    cooperativeEnergyDistribution: getDistribution(cooperativeData.map(d => d.parentEnergyBefore)),
    soloEnergyDistribution: getDistribution(soloData.map(d => d.parentEnergyBefore)),
    cooperativeAgeDistribution: getDistribution(cooperativeData.map(d => d.parentAge)),
    soloAgeDistribution: getDistribution(soloData.map(d => d.parentAge)),
  };
}

async function main() {
  console.log('=== 協力複製と個体の余裕の関係検証 ===\n');
  console.log('目的: H37「協力複製を行う個体は余裕のある長寿個体」を検証\n');

  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 1500;

  const results: AffluenceAnalysis[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed}...`);
    const result = runSimulation(seed, ticks);
    results.push(result);
    
    console.log(`  複製: ${result.totalReplications} (協力: ${result.cooperativeReplications}, 単独: ${result.soloReplications})`);
    console.log(`  エネルギー: 協力=${result.avgCooperativeEnergy.toFixed(1)}, 単独=${result.avgSoloEnergy.toFixed(1)}`);
    console.log(`  年齢: 協力=${result.avgCooperativeAge.toFixed(1)}, 単独=${result.avgSoloAge.toFixed(1)}`);
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  
  const validResults = results.filter(r => r.cooperativeReplications > 0 && r.soloReplications > 0);
  
  if (validResults.length === 0) {
    console.log('有効なデータがありません（協力複製または単独複製が0）');
    return;
  }
  
  const avg = {
    totalReplications: validResults.reduce((sum, r) => sum + r.totalReplications, 0) / validResults.length,
    cooperativeReplications: validResults.reduce((sum, r) => sum + r.cooperativeReplications, 0) / validResults.length,
    soloReplications: validResults.reduce((sum, r) => sum + r.soloReplications, 0) / validResults.length,
    avgCooperativeEnergy: validResults.reduce((sum, r) => sum + r.avgCooperativeEnergy, 0) / validResults.length,
    avgSoloEnergy: validResults.reduce((sum, r) => sum + r.avgSoloEnergy, 0) / validResults.length,
    avgCooperativeAge: validResults.reduce((sum, r) => sum + r.avgCooperativeAge, 0) / validResults.length,
    avgSoloAge: validResults.reduce((sum, r) => sum + r.avgSoloAge, 0) / validResults.length,
    avgCooperativePrestige: validResults.reduce((sum, r) => sum + r.avgCooperativePrestige, 0) / validResults.length,
    avgSoloPrestige: validResults.reduce((sum, r) => sum + r.avgSoloPrestige, 0) / validResults.length,
  };
  
  console.log('複製統計:');
  console.log(`  総複製: ${avg.totalReplications.toFixed(1)}`);
  console.log(`  協力複製: ${avg.cooperativeReplications.toFixed(1)} (${(avg.cooperativeReplications / avg.totalReplications * 100).toFixed(1)}%)`);
  console.log(`  単独複製: ${avg.soloReplications.toFixed(1)} (${(avg.soloReplications / avg.totalReplications * 100).toFixed(1)}%)`);
  
  console.log('\nエネルギー比較（複製前）:');
  console.log(`  協力複製の親: ${avg.avgCooperativeEnergy.toFixed(1)}`);
  console.log(`  単独複製の親: ${avg.avgSoloEnergy.toFixed(1)}`);
  const energyDiff = ((avg.avgCooperativeEnergy - avg.avgSoloEnergy) / avg.avgSoloEnergy * 100);
  console.log(`  差: ${energyDiff > 0 ? '+' : ''}${energyDiff.toFixed(1)}%`);
  
  console.log('\n年齢比較（複製時）:');
  console.log(`  協力複製の親: ${avg.avgCooperativeAge.toFixed(1)} tick`);
  console.log(`  単独複製の親: ${avg.avgSoloAge.toFixed(1)} tick`);
  const ageDiff = ((avg.avgCooperativeAge - avg.avgSoloAge) / avg.avgSoloAge * 100);
  console.log(`  差: ${ageDiff > 0 ? '+' : ''}${ageDiff.toFixed(1)}%`);
  
  console.log('\nPrestige比較（複製時）:');
  console.log(`  協力複製の親: ${avg.avgCooperativePrestige.toFixed(1)}`);
  console.log(`  単独複製の親: ${avg.avgSoloPrestige.toFixed(1)}`);
  const prestigeDiff = avg.avgSoloPrestige > 0 
    ? ((avg.avgCooperativePrestige - avg.avgSoloPrestige) / avg.avgSoloPrestige * 100)
    : 0;
  console.log(`  差: ${prestigeDiff > 0 ? '+' : ''}${prestigeDiff.toFixed(1)}%`);

  // 分布の表示
  console.log('\n\n=== 分布（四分位） ===\n');
  
  console.log('エネルギー分布:');
  console.log('  協力: min=' + validResults[0].cooperativeEnergyDistribution[0].toFixed(1) +
    ', Q1=' + validResults[0].cooperativeEnergyDistribution[1].toFixed(1) +
    ', median=' + validResults[0].cooperativeEnergyDistribution[2].toFixed(1) +
    ', Q3=' + validResults[0].cooperativeEnergyDistribution[3].toFixed(1) +
    ', max=' + validResults[0].cooperativeEnergyDistribution[4].toFixed(1));
  console.log('  単独: min=' + validResults[0].soloEnergyDistribution[0].toFixed(1) +
    ', Q1=' + validResults[0].soloEnergyDistribution[1].toFixed(1) +
    ', median=' + validResults[0].soloEnergyDistribution[2].toFixed(1) +
    ', Q3=' + validResults[0].soloEnergyDistribution[3].toFixed(1) +
    ', max=' + validResults[0].soloEnergyDistribution[4].toFixed(1));
  
  console.log('\n年齢分布:');
  console.log('  協力: min=' + validResults[0].cooperativeAgeDistribution[0].toFixed(0) +
    ', Q1=' + validResults[0].cooperativeAgeDistribution[1].toFixed(0) +
    ', median=' + validResults[0].cooperativeAgeDistribution[2].toFixed(0) +
    ', Q3=' + validResults[0].cooperativeAgeDistribution[3].toFixed(0) +
    ', max=' + validResults[0].cooperativeAgeDistribution[4].toFixed(0));
  console.log('  単独: min=' + validResults[0].soloAgeDistribution[0].toFixed(0) +
    ', Q1=' + validResults[0].soloAgeDistribution[1].toFixed(0) +
    ', median=' + validResults[0].soloAgeDistribution[2].toFixed(0) +
    ', Q3=' + validResults[0].soloAgeDistribution[3].toFixed(0) +
    ', max=' + validResults[0].soloAgeDistribution[4].toFixed(0));

  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  const isEnergyHigher = energyDiff > 10;
  const isAgeHigher = ageDiff > 10;
  const isPrestigeHigher = prestigeDiff > 10;
  
  console.log('H37「協力複製を行う個体は余裕のある長寿個体」の検証:');
  console.log(`  エネルギーが高い: ${isEnergyHigher ? '✓' : '✗'} (${energyDiff > 0 ? '+' : ''}${energyDiff.toFixed(1)}%)`);
  console.log(`  年齢が高い: ${isAgeHigher ? '✓' : '✗'} (${ageDiff > 0 ? '+' : ''}${ageDiff.toFixed(1)}%)`);
  console.log(`  Prestigeが高い: ${isPrestigeHigher ? '✓' : '✗'} (${prestigeDiff > 0 ? '+' : ''}${prestigeDiff.toFixed(1)}%)`);
  
  if (isEnergyHigher && isAgeHigher) {
    console.log('\n→ H37を支持: 協力複製を行う個体は余裕のある長寿個体');
  } else if (isEnergyHigher || isAgeHigher) {
    console.log('\n→ H37を部分的に支持: 一部の指標で余裕が確認された');
  } else {
    console.log('\n→ H37を棄却: 協力複製と単独複製の個体特性に有意な差がない');
  }
}

main().catch(console.error);
