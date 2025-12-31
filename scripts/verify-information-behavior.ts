/**
 * 情報伝達と行動の関係検証スクリプト
 * 
 * 目的: H29「情報伝達は言語の前段階である」を検証
 * - 情報の内容と行動の相関を分析
 * - 情報が行動に影響を与えているかを検証
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface InformationBehaviorAnalysis {
  seed: number;
  // 情報伝達統計
  totalInformationExchanges: number;
  totalInformationInheritances: number;
  totalInformationAcquisitions: number;
  // スキル統計
  avgHarvestSkill: number;
  avgMoveSkill: number;
  avgReplicateSkill: number;
  avgInteractSkill: number;
  // 行動統計
  totalHarvests: number;
  totalMoves: number;
  totalReplications: number;
  totalInteractions: number;
  // スキルと行動の相関
  harvestSkillBehaviorCorr: number;
  moveSkillBehaviorCorr: number;
  // 情報の多様性
  uniqueStatePatterns: number;
  avgStateFillRate: number;
}

function runSimulation(seed: number, ticks: number): InformationBehaviorAnalysis {
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

  let totalInformationExchanges = 0;
  let totalInformationInheritances = 0;
  let totalInformationAcquisitions = 0;
  let totalHarvests = 0;
  let totalMoves = 0;
  let totalReplications = 0;
  let totalInteractions = 0;

  // エンティティごとの行動カウント
  const entityHarvests: Map<string, number> = new Map();
  const entityMoves: Map<string, number> = new Map();
  const entityReplications: Map<string, number> = new Map();
  const entityInteractions: Map<string, number> = new Map();

  // 最終状態のスキル値
  const finalSkills: Map<string, { harvest: number; move: number; replicate: number; interact: number }> = new Map();

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    const events = universe.getEventLog();
    
    for (const event of events) {
      switch (event.type) {
        case 'informationExchange':
          totalInformationExchanges++;
          break;
        case 'informationInheritance':
          totalInformationInheritances++;
          break;
        case 'informationAcquisition':
          totalInformationAcquisitions++;
          break;
        case 'harvest':
          totalHarvests++;
          const harvestEvent = event as any;
          entityHarvests.set(harvestEvent.entityId, (entityHarvests.get(harvestEvent.entityId) || 0) + 1);
          break;
        case 'move':
          totalMoves++;
          const moveEvent = event as any;
          entityMoves.set(moveEvent.entityId, (entityMoves.get(moveEvent.entityId) || 0) + 1);
          break;
        case 'replication':
          totalReplications++;
          const replicationEvent = event as any;
          entityReplications.set(replicationEvent.parentId, (entityReplications.get(replicationEvent.parentId) || 0) + 1);
          break;
        case 'interaction':
          totalInteractions++;
          const interactionEvent = event as any;
          entityInteractions.set(interactionEvent.entityId, (entityInteractions.get(interactionEvent.entityId) || 0) + 1);
          break;
      }
    }
  }

  // 最終状態のエンティティからスキル値を取得
  const entities = universe.getAllEntities();
  let totalHarvestSkill = 0;
  let totalMoveSkill = 0;
  let totalReplicateSkill = 0;
  let totalInteractSkill = 0;
  let totalStateFillRate = 0;
  const statePatterns = new Set<string>();

  for (const entity of entities) {
    // スキル値を計算（stateの最初の8バイトから）
    const stateData = entity.state.getData();
    if (stateData.length >= 8) {
      const harvestSkill = stateData[0] / 255;
      const moveSkill = stateData[1] / 255;
      const replicateSkill = stateData[2] / 255;
      const interactSkill = stateData[3] / 255;
      
      totalHarvestSkill += harvestSkill;
      totalMoveSkill += moveSkill;
      totalReplicateSkill += replicateSkill;
      totalInteractSkill += interactSkill;
      
      finalSkills.set(entity.id, { harvest: harvestSkill, move: moveSkill, replicate: replicateSkill, interact: interactSkill });
    }
    
    // state充填率
    const stateArray = Array.from(stateData);
    const nonZeroBytes = stateArray.filter(b => b !== 0).length;
    totalStateFillRate += stateData.length > 0 ? nonZeroBytes / stateData.length : 0;
    
    // stateパターン（最初の8バイトをハッシュ）
    const pattern = stateArray.slice(0, 8).join(',');
    statePatterns.add(pattern);
  }

  const entityCount = entities.length;
  const avgHarvestSkill = entityCount > 0 ? totalHarvestSkill / entityCount : 0;
  const avgMoveSkill = entityCount > 0 ? totalMoveSkill / entityCount : 0;
  const avgReplicateSkill = entityCount > 0 ? totalReplicateSkill / entityCount : 0;
  const avgInteractSkill = entityCount > 0 ? totalInteractSkill / entityCount : 0;
  const avgStateFillRate = entityCount > 0 ? totalStateFillRate / entityCount : 0;

  // スキルと行動の相関を計算
  const harvestSkills: number[] = [];
  const harvestCounts: number[] = [];
  const moveSkills: number[] = [];
  const moveCounts: number[] = [];

  for (const entity of entities) {
    const skills = finalSkills.get(entity.id);
    if (skills) {
      harvestSkills.push(skills.harvest);
      harvestCounts.push(entityHarvests.get(entity.id) || 0);
      moveSkills.push(skills.move);
      moveCounts.push(entityMoves.get(entity.id) || 0);
    }
  }

  const correlate = (x: number[], y: number[]): number => {
    if (x.length < 2) return 0;
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den > 0 ? num / den : 0;
  };

  const harvestSkillBehaviorCorr = correlate(harvestSkills, harvestCounts);
  const moveSkillBehaviorCorr = correlate(moveSkills, moveCounts);

  return {
    seed,
    totalInformationExchanges,
    totalInformationInheritances,
    totalInformationAcquisitions,
    avgHarvestSkill,
    avgMoveSkill,
    avgReplicateSkill,
    avgInteractSkill,
    totalHarvests,
    totalMoves,
    totalReplications,
    totalInteractions,
    harvestSkillBehaviorCorr,
    moveSkillBehaviorCorr,
    uniqueStatePatterns: statePatterns.size,
    avgStateFillRate,
  };
}

async function main() {
  console.log('=== 情報伝達と行動の関係検証 ===\n');
  console.log('目的: H29「情報伝達は言語の前段階である」を検証\n');

  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 2000;

  const results: InformationBehaviorAnalysis[] = [];

  for (const seed of seeds) {
    console.log(`Seed ${seed}...`);
    const result = runSimulation(seed, ticks);
    results.push(result);
    
    console.log(`  情報交換: ${result.totalInformationExchanges}, 継承: ${result.totalInformationInheritances}`);
    console.log(`  スキル-行動相関: Harvest=${result.harvestSkillBehaviorCorr.toFixed(3)}, Move=${result.moveSkillBehaviorCorr.toFixed(3)}`);
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  
  const avg = {
    totalInformationExchanges: results.reduce((sum, r) => sum + r.totalInformationExchanges, 0) / results.length,
    totalInformationInheritances: results.reduce((sum, r) => sum + r.totalInformationInheritances, 0) / results.length,
    totalInformationAcquisitions: results.reduce((sum, r) => sum + r.totalInformationAcquisitions, 0) / results.length,
    avgHarvestSkill: results.reduce((sum, r) => sum + r.avgHarvestSkill, 0) / results.length,
    avgMoveSkill: results.reduce((sum, r) => sum + r.avgMoveSkill, 0) / results.length,
    avgReplicateSkill: results.reduce((sum, r) => sum + r.avgReplicateSkill, 0) / results.length,
    avgInteractSkill: results.reduce((sum, r) => sum + r.avgInteractSkill, 0) / results.length,
    totalHarvests: results.reduce((sum, r) => sum + r.totalHarvests, 0) / results.length,
    totalMoves: results.reduce((sum, r) => sum + r.totalMoves, 0) / results.length,
    totalReplications: results.reduce((sum, r) => sum + r.totalReplications, 0) / results.length,
    totalInteractions: results.reduce((sum, r) => sum + r.totalInteractions, 0) / results.length,
    harvestSkillBehaviorCorr: results.reduce((sum, r) => sum + r.harvestSkillBehaviorCorr, 0) / results.length,
    moveSkillBehaviorCorr: results.reduce((sum, r) => sum + r.moveSkillBehaviorCorr, 0) / results.length,
    uniqueStatePatterns: results.reduce((sum, r) => sum + r.uniqueStatePatterns, 0) / results.length,
    avgStateFillRate: results.reduce((sum, r) => sum + r.avgStateFillRate, 0) / results.length,
  };
  
  console.log('情報伝達統計:');
  console.log(`  情報交換: ${avg.totalInformationExchanges.toFixed(0)}`);
  console.log(`  情報継承: ${avg.totalInformationInheritances.toFixed(0)}`);
  console.log(`  情報取得: ${avg.totalInformationAcquisitions.toFixed(0)}`);
  
  console.log('\nスキル統計:');
  console.log(`  平均Harvestスキル: ${avg.avgHarvestSkill.toFixed(3)}`);
  console.log(`  平均Moveスキル: ${avg.avgMoveSkill.toFixed(3)}`);
  console.log(`  平均Replicateスキル: ${avg.avgReplicateSkill.toFixed(3)}`);
  console.log(`  平均Interactスキル: ${avg.avgInteractSkill.toFixed(3)}`);
  
  console.log('\n行動統計:');
  console.log(`  総Harvest: ${avg.totalHarvests.toFixed(0)}`);
  console.log(`  総Move: ${avg.totalMoves.toFixed(0)}`);
  console.log(`  総Replication: ${avg.totalReplications.toFixed(0)}`);
  console.log(`  総Interaction: ${avg.totalInteractions.toFixed(0)}`);
  
  console.log('\nスキル-行動相関:');
  console.log(`  Harvestスキル vs Harvest行動: r = ${avg.harvestSkillBehaviorCorr.toFixed(3)}`);
  console.log(`  Moveスキル vs Move行動: r = ${avg.moveSkillBehaviorCorr.toFixed(3)}`);
  
  console.log('\n情報多様性:');
  console.log(`  ユニークなstateパターン: ${avg.uniqueStatePatterns.toFixed(1)}`);
  console.log(`  平均state充填率: ${(avg.avgStateFillRate * 100).toFixed(1)}%`);

  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  const hasPositiveCorrelation = avg.harvestSkillBehaviorCorr > 0.1 || avg.moveSkillBehaviorCorr > 0.1;
  const hasHighInformationTransfer = avg.totalInformationExchanges > 1000 || avg.totalInformationInheritances > 1000;
  const hasHighDiversity = avg.uniqueStatePatterns > 10;
  
  console.log('H29「情報伝達は言語の前段階である」の検証:');
  console.log(`  情報伝達が活発: ${hasHighInformationTransfer ? '✓' : '✗'}`);
  console.log(`  情報の多様性: ${hasHighDiversity ? '✓' : '✗'} (${avg.uniqueStatePatterns.toFixed(1)}パターン)`);
  console.log(`  スキル-行動相関: ${hasPositiveCorrelation ? '✓' : '✗'} (Harvest=${avg.harvestSkillBehaviorCorr.toFixed(3)}, Move=${avg.moveSkillBehaviorCorr.toFixed(3)})`);
  
  if (hasHighInformationTransfer && hasHighDiversity && hasPositiveCorrelation) {
    console.log('\n→ H29を支持: 情報伝達は「言語」の前段階として機能している');
    console.log('  情報が行動に影響を与えている');
  } else if (hasHighInformationTransfer && hasHighDiversity) {
    console.log('\n→ H29を部分的に支持: 情報伝達は活発だが、行動への影響は限定的');
    console.log('  「言語」と呼ぶには、情報と行動の相関がさらに必要');
  } else {
    console.log('\n→ H29を棄却: 情報伝達が「言語」の前段階とは言えない');
  }
}

main().catch(console.error);
