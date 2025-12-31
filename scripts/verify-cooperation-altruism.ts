/**
 * 協力複製の利他性検証スクリプト
 * 
 * 目的: H28「協力複製は利他的ではなく相互利益的である」を検証
 * - 協力複製後の親と子の生存率を比較
 * - 協力複製 vs 単独複製の結果を比較
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface ReplicationEvent {
  tick: number;
  parentId: string;
  childId: string;
  isCooperative: boolean;
  parentEnergyBefore: number;
  parentEnergyAfter: number;
}

interface SurvivalAnalysis {
  totalReplications: number;
  cooperativeReplications: number;
  soloReplications: number;
  cooperativeParentSurvivalRate: number;
  soloParentSurvivalRate: number;
  cooperativeChildSurvivalRate: number;
  soloChildSurvivalRate: number;
  avgCooperativeParentLifespan: number;
  avgSoloParentLifespan: number;
}

function runSimulation(seed: number, ticks: number): SurvivalAnalysis {
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

  // 複製イベントを追跡
  const replicationEvents: ReplicationEvent[] = [];
  const entityBirthTick: Map<string, number> = new Map();
  const entityDeathTick: Map<string, number> = new Map();
  const cooperativeParents: Set<string> = new Set();
  const soloParents: Set<string> = new Set();
  const cooperativeChildren: Set<string> = new Set();
  const soloChildren: Set<string> = new Set();

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
    
    for (const event of events) {
      if (event.type === 'replication') {
        const replicationEvent = event as any;
        const parentId = replicationEvent.parentId;
        const childId = replicationEvent.childId;
        
        // 協力複製かどうかを判定（partnerSelectedイベントがあるか）
        const isCooperative = events.some(
          e => e.type === 'partnerSelected' && e.tick === event.tick
        );
        
        replicationEvents.push({
          tick: t,
          parentId,
          childId,
          isCooperative,
          parentEnergyBefore: entitiesBefore.get(parentId) || 0,
          parentEnergyAfter: 0, // 後で更新
        });
        
        entityBirthTick.set(childId, t);
        
        if (isCooperative) {
          cooperativeParents.add(parentId);
          cooperativeChildren.add(childId);
        } else {
          soloParents.add(parentId);
          soloChildren.add(childId);
        }
      } else if (event.type === 'entityDied') {
        const diedEvent = event as any;
        entityDeathTick.set(diedEvent.entityId, t);
      }
    }
  }

  // 生存率を計算
  const finalEntities = new Set(universe.getAllEntities().map(e => e.id));
  
  const cooperativeParentSurvived = Array.from(cooperativeParents).filter(id => finalEntities.has(id)).length;
  const soloParentSurvived = Array.from(soloParents).filter(id => finalEntities.has(id)).length;
  const cooperativeChildSurvived = Array.from(cooperativeChildren).filter(id => finalEntities.has(id)).length;
  const soloChildSurvived = Array.from(soloChildren).filter(id => finalEntities.has(id)).length;
  
  const cooperativeParentSurvivalRate = cooperativeParents.size > 0 
    ? cooperativeParentSurvived / cooperativeParents.size 
    : 0;
  const soloParentSurvivalRate = soloParents.size > 0 
    ? soloParentSurvived / soloParents.size 
    : 0;
  const cooperativeChildSurvivalRate = cooperativeChildren.size > 0 
    ? cooperativeChildSurvived / cooperativeChildren.size 
    : 0;
  const soloChildSurvivalRate = soloChildren.size > 0 
    ? soloChildSurvived / soloChildren.size 
    : 0;
  
  // 平均寿命を計算
  let totalCooperativeParentLifespan = 0;
  let totalSoloParentLifespan = 0;
  
  for (const parentId of cooperativeParents) {
    const birthTick = entityBirthTick.get(parentId) || 0;
    const deathTick = entityDeathTick.get(parentId) || ticks;
    totalCooperativeParentLifespan += deathTick - birthTick;
  }
  
  for (const parentId of soloParents) {
    const birthTick = entityBirthTick.get(parentId) || 0;
    const deathTick = entityDeathTick.get(parentId) || ticks;
    totalSoloParentLifespan += deathTick - birthTick;
  }
  
  const avgCooperativeParentLifespan = cooperativeParents.size > 0 
    ? totalCooperativeParentLifespan / cooperativeParents.size 
    : 0;
  const avgSoloParentLifespan = soloParents.size > 0 
    ? totalSoloParentLifespan / soloParents.size 
    : 0;

  return {
    totalReplications: replicationEvents.length,
    cooperativeReplications: cooperativeParents.size,
    soloReplications: soloParents.size,
    cooperativeParentSurvivalRate,
    soloParentSurvivalRate,
    cooperativeChildSurvivalRate,
    soloChildSurvivalRate,
    avgCooperativeParentLifespan,
    avgSoloParentLifespan,
  };
}

async function main() {
  console.log('=== 協力複製の利他性検証 ===\n');
  console.log('目的: H28「協力複製は利他的ではなく相互利益的である」を検証\n');

  const seeds = [42];
  const ticks = 2000;

  const results: SurvivalAnalysis[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed}...`);
    const result = runSimulation(seed, ticks);
    results.push(result);
    
    console.log(`  複製: ${result.totalReplications} (協力: ${result.cooperativeReplications}, 単独: ${result.soloReplications})`);
    console.log(`  親生存率: 協力=${(result.cooperativeParentSurvivalRate * 100).toFixed(1)}%, 単独=${(result.soloParentSurvivalRate * 100).toFixed(1)}%`);
    console.log(`  子生存率: 協力=${(result.cooperativeChildSurvivalRate * 100).toFixed(1)}%, 単独=${(result.soloChildSurvivalRate * 100).toFixed(1)}%`);
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  
  const avg = {
    totalReplications: results.reduce((sum, r) => sum + r.totalReplications, 0) / results.length,
    cooperativeReplications: results.reduce((sum, r) => sum + r.cooperativeReplications, 0) / results.length,
    soloReplications: results.reduce((sum, r) => sum + r.soloReplications, 0) / results.length,
    cooperativeParentSurvivalRate: results.reduce((sum, r) => sum + r.cooperativeParentSurvivalRate, 0) / results.length,
    soloParentSurvivalRate: results.reduce((sum, r) => sum + r.soloParentSurvivalRate, 0) / results.length,
    cooperativeChildSurvivalRate: results.reduce((sum, r) => sum + r.cooperativeChildSurvivalRate, 0) / results.length,
    soloChildSurvivalRate: results.reduce((sum, r) => sum + r.soloChildSurvivalRate, 0) / results.length,
    avgCooperativeParentLifespan: results.reduce((sum, r) => sum + r.avgCooperativeParentLifespan, 0) / results.length,
    avgSoloParentLifespan: results.reduce((sum, r) => sum + r.avgSoloParentLifespan, 0) / results.length,
  };
  
  console.log('複製統計:');
  console.log(`  総複製: ${avg.totalReplications.toFixed(1)}`);
  console.log(`  協力複製: ${avg.cooperativeReplications.toFixed(1)} (${(avg.cooperativeReplications / avg.totalReplications * 100).toFixed(1)}%)`);
  console.log(`  単独複製: ${avg.soloReplications.toFixed(1)} (${(avg.soloReplications / avg.totalReplications * 100).toFixed(1)}%)`);
  
  console.log('\n生存率比較:');
  console.log(`  親（協力）: ${(avg.cooperativeParentSurvivalRate * 100).toFixed(1)}%`);
  console.log(`  親（単独）: ${(avg.soloParentSurvivalRate * 100).toFixed(1)}%`);
  console.log(`  子（協力）: ${(avg.cooperativeChildSurvivalRate * 100).toFixed(1)}%`);
  console.log(`  子（単独）: ${(avg.soloChildSurvivalRate * 100).toFixed(1)}%`);
  
  console.log('\n平均寿命比較:');
  console.log(`  親（協力）: ${avg.avgCooperativeParentLifespan.toFixed(1)} tick`);
  console.log(`  親（単独）: ${avg.avgSoloParentLifespan.toFixed(1)} tick`);

  // 結論
  console.log('\n=== 結論 ===\n');
  
  // 利他的 = 親の生存率が下がる、子の生存率が上がる
  // 相互利益的 = 親も子も生存率が上がる
  
  const parentSurvivalDiff = avg.cooperativeParentSurvivalRate - avg.soloParentSurvivalRate;
  const childSurvivalDiff = avg.cooperativeChildSurvivalRate - avg.soloChildSurvivalRate;
  
  console.log('生存率の差（協力 - 単独）:');
  console.log(`  親: ${(parentSurvivalDiff * 100).toFixed(1)}%`);
  console.log(`  子: ${(childSurvivalDiff * 100).toFixed(1)}%`);
  
  if (parentSurvivalDiff < -0.05 && childSurvivalDiff > 0.05) {
    console.log('\n→ 協力複製は「利他的」: 親の生存率が下がり、子の生存率が上がる');
    console.log('  H28を棄却');
  } else if (parentSurvivalDiff > 0.05 && childSurvivalDiff > 0.05) {
    console.log('\n→ 協力複製は「相互利益的」: 親も子も生存率が上がる');
    console.log('  H28を支持');
  } else if (parentSurvivalDiff > 0.05 || childSurvivalDiff > 0.05) {
    console.log('\n→ 協力複製は「部分的に相互利益的」: 一方の生存率が上がる');
    console.log('  H28を部分的に支持');
  } else {
    console.log('\n→ 協力複製と単独複製に有意な差がない');
    console.log('  H28の検証には追加データが必要');
  }
}

main().catch(console.error);
