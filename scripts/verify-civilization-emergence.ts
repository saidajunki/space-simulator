/**
 * 文明創発の長期観察スクリプト
 * 
 * 目的: Q3「最小公理で文明は創発するか？」への接近
 * - 50,000 tickの長期シミュレーション
 * - 社会構造の複雑さを観察
 * - H28, H29, H30も同時に検証
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface TimeWindowStats {
  tick: number;
  entityCount: number;
  artifactCount: number;
  avgAge: number;
  clusteringCoefficient: number;
  cooperationRate: number;
  informationDiversity: number;
  artifactPerCapita: number;
  avgSkillHarvest: number;
  avgSkillMaintain: number;
}

function calculateClusteringCoefficient(universe: Universe): number {
  const stats = universe.getStats();
  const nodeOccupancy = stats.nodeOccupancy || [];
  
  if (nodeOccupancy.length === 0) return 0;
  
  const occupiedNodes = nodeOccupancy.filter(n => n > 0).length;
  const totalNodes = nodeOccupancy.length;
  
  // クラスタリング係数 = 1 - (占有ノード数 / 総ノード数)
  // 高いほどエンティティが集中している
  return 1 - (occupiedNodes / totalNodes);
}

function calculateInformationDiversity(universe: Universe): number {
  const entities = universe.getAllEntities();
  if (entities.length === 0) return 0;
  
  const statePatterns = new Set<string>();
  for (const entity of entities) {
    const stateData = entity.state.getData();
    if (stateData && stateData.length > 0) {
      // 最初の4バイトをパターンとして使用
      const pattern = Array.from(stateData.slice(0, 4)).join(',');
      statePatterns.add(pattern);
    }
  }
  
  return statePatterns.size;
}

function calculateAvgSkills(universe: Universe): { harvest: number; maintain: number } {
  const entities = universe.getAllEntities();
  if (entities.length === 0) return { harvest: 0, maintain: 0 };
  
  let totalHarvest = 0;
  let totalMaintain = 0;
  
  for (const entity of entities) {
    const stateData = entity.state.getData();
    if (stateData && stateData.length >= 8) {
      // スキル値を計算（0-255を0-1に正規化）
      totalHarvest += stateData[0] / 255;
      totalMaintain += stateData[2] / 255;
    }
  }
  
  return {
    harvest: totalHarvest / entities.length,
    maintain: totalMaintain / entities.length,
  };
}

function runLongTermSimulation(seed: number, totalTicks: number, windowSize: number): TimeWindowStats[] {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.018, // 活発レジーム
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount: 30, // 標準サイズ
      initialEntityCount: 50, // 標準人口
      edgeDensity: 0.25,
    },
  });

  const windowStats: TimeWindowStats[] = [];
  let windowReplications = 0;
  let windowCooperativeReplications = 0;

  for (let t = 0; t < totalTicks; t++) {
    universe.step();
    
    // イベントを集計
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'replication') {
        windowReplications++;
        if (event.data?.cooperative) {
          windowCooperativeReplications++;
        }
      }
    }
    universe.clearEventLog();
    
    // 時間窓ごとに統計を記録
    if ((t + 1) % windowSize === 0) {
      const stats = universe.getStats();
      const skills = calculateAvgSkills(universe);
      
      windowStats.push({
        tick: t + 1,
        entityCount: stats.entityCount,
        artifactCount: stats.artifactCount,
        avgAge: stats.averageAge,
        clusteringCoefficient: calculateClusteringCoefficient(universe),
        cooperationRate: windowReplications > 0 ? windowCooperativeReplications / windowReplications : 0,
        informationDiversity: calculateInformationDiversity(universe),
        artifactPerCapita: stats.entityCount > 0 ? stats.artifactCount / stats.entityCount : 0,
        avgSkillHarvest: skills.harvest,
        avgSkillMaintain: skills.maintain,
      });
      
      // 窓をリセット
      windowReplications = 0;
      windowCooperativeReplications = 0;
    }
  }

  return windowStats;
}

async function main() {
  console.log('=== 文明創発の長期観察 ===\n');
  console.log('目的: Q3「最小公理で文明は創発するか？」への接近\n');

  const seed = 42;
  const totalTicks = 10000;
  const windowSize = 1000;

  console.log(`設定: seed=${seed}, ticks=${totalTicks}, windowSize=${windowSize}`);
  console.log('シミュレーション開始...\n');

  const startTime = Date.now();
  const stats = runLongTermSimulation(seed, totalTicks, windowSize);
  const elapsed = (Date.now() - startTime) / 1000;

  console.log(`完了 (${elapsed.toFixed(1)}秒)\n`);

  // 結果表示
  console.log('=== 時系列データ ===\n');
  console.log('Tick\t人口\tArtifact\t年齢\tクラスタ\t協力率\t情報多様性\tArt/人口\tHarvest\tMaintain');
  
  for (const s of stats) {
    console.log(
      `${s.tick}\t${s.entityCount}\t${s.artifactCount}\t` +
      `${s.avgAge.toFixed(0)}\t${s.clusteringCoefficient.toFixed(3)}\t` +
      `${(s.cooperationRate * 100).toFixed(1)}%\t${s.informationDiversity}\t` +
      `${s.artifactPerCapita.toFixed(2)}\t${s.avgSkillHarvest.toFixed(3)}\t${s.avgSkillMaintain.toFixed(3)}`
    );
  }

  // 傾向分析
  console.log('\n=== 傾向分析 ===\n');
  
  const firstHalf = stats.slice(0, Math.floor(stats.length / 2));
  const secondHalf = stats.slice(Math.floor(stats.length / 2));
  
  const avgFirst = {
    entityCount: firstHalf.reduce((sum, s) => sum + s.entityCount, 0) / firstHalf.length,
    artifactCount: firstHalf.reduce((sum, s) => sum + s.artifactCount, 0) / firstHalf.length,
    cooperationRate: firstHalf.reduce((sum, s) => sum + s.cooperationRate, 0) / firstHalf.length,
    artifactPerCapita: firstHalf.reduce((sum, s) => sum + s.artifactPerCapita, 0) / firstHalf.length,
    avgSkillHarvest: firstHalf.reduce((sum, s) => sum + s.avgSkillHarvest, 0) / firstHalf.length,
  };
  
  const avgSecond = {
    entityCount: secondHalf.reduce((sum, s) => sum + s.entityCount, 0) / secondHalf.length,
    artifactCount: secondHalf.reduce((sum, s) => sum + s.artifactCount, 0) / secondHalf.length,
    cooperationRate: secondHalf.reduce((sum, s) => sum + s.cooperationRate, 0) / secondHalf.length,
    artifactPerCapita: secondHalf.reduce((sum, s) => sum + s.artifactPerCapita, 0) / secondHalf.length,
    avgSkillHarvest: secondHalf.reduce((sum, s) => sum + s.avgSkillHarvest, 0) / secondHalf.length,
  };
  
  console.log('前半 vs 後半:');
  console.log(`  人口: ${avgFirst.entityCount.toFixed(1)} → ${avgSecond.entityCount.toFixed(1)} (${((avgSecond.entityCount - avgFirst.entityCount) / avgFirst.entityCount * 100).toFixed(1)}%)`);
  console.log(`  Artifact: ${avgFirst.artifactCount.toFixed(1)} → ${avgSecond.artifactCount.toFixed(1)} (${((avgSecond.artifactCount - avgFirst.artifactCount) / avgFirst.artifactCount * 100).toFixed(1)}%)`);
  console.log(`  協力率: ${(avgFirst.cooperationRate * 100).toFixed(1)}% → ${(avgSecond.cooperationRate * 100).toFixed(1)}%`);
  console.log(`  Art/人口: ${avgFirst.artifactPerCapita.toFixed(2)} → ${avgSecond.artifactPerCapita.toFixed(2)}`);
  console.log(`  Harvestスキル: ${avgFirst.avgSkillHarvest.toFixed(3)} → ${avgSecond.avgSkillHarvest.toFixed(3)}`);

  // 文明指標の評価
  console.log('\n=== 文明指標の評価 ===\n');
  
  const finalStats = stats[stats.length - 1];
  
  // 文明の定義（仮）:
  // 1. 持続的な人口（絶滅していない）
  // 2. アーティファクトの蓄積（人口以上）
  // 3. 協力行動の存在（50%以上）
  // 4. 空間的クラスタ（0.3以上）
  
  const criteria = {
    sustainablePopulation: finalStats.entityCount > 10,
    artifactAccumulation: finalStats.artifactPerCapita > 1.0,
    cooperation: finalStats.cooperationRate > 0.5,
    clustering: finalStats.clusteringCoefficient > 0.3,
  };
  
  console.log('文明の基準（仮定義）:');
  console.log(`  1. 持続的な人口（>10体）: ${criteria.sustainablePopulation ? '✓' : '✗'} (${finalStats.entityCount}体)`);
  console.log(`  2. アーティファクト蓄積（>1.0/人）: ${criteria.artifactAccumulation ? '✓' : '✗'} (${finalStats.artifactPerCapita.toFixed(2)}/人)`);
  console.log(`  3. 協力行動（>50%）: ${criteria.cooperation ? '✓' : '✗'} (${(finalStats.cooperationRate * 100).toFixed(1)}%)`);
  console.log(`  4. 空間的クラスタ（>0.3）: ${criteria.clustering ? '✓' : '✗'} (${finalStats.clusteringCoefficient.toFixed(3)})`);
  
  const criteriaCount = Object.values(criteria).filter(v => v).length;
  
  console.log(`\n総合評価: ${criteriaCount}/4 基準を満たす`);
  
  if (criteriaCount >= 4) {
    console.log('→ 「文明」と呼べる状態に達している可能性');
  } else if (criteriaCount >= 2) {
    console.log('→ 「文明の萌芽」が観察される');
  } else {
    console.log('→ 「文明」には至っていない');
  }

  // H28, H29, H30の検証
  console.log('\n=== 仮説検証 ===\n');
  
  // H28: 協力複製は「利他的」ではなく「相互利益的」である
  console.log('H28（協力は相互利益的）:');
  console.log(`  協力率: ${(finalStats.cooperationRate * 100).toFixed(1)}%`);
  console.log('  → 協力が高率で発生しているが、利他性の検証には子の生存率分析が必要');
  
  // H29: 情報伝達は「言語」の前段階である
  console.log('\nH29（情報伝達は言語の前段階）:');
  console.log(`  情報多様性: ${finalStats.informationDiversity}`);
  console.log(`  人口: ${finalStats.entityCount}`);
  console.log(`  多様性/人口比: ${(finalStats.informationDiversity / finalStats.entityCount).toFixed(2)}`);
  console.log('  → 情報多様性が人口に近い場合、各個体が独自の情報を持っている');
  
  // H30: スキルボーナスの効果は「余剰」を生み出し、文明発達を加速する
  console.log('\nH30（余剰と文明発達）:');
  console.log(`  Art/人口（前半）: ${avgFirst.artifactPerCapita.toFixed(2)}`);
  console.log(`  Art/人口（後半）: ${avgSecond.artifactPerCapita.toFixed(2)}`);
  const surplusGrowth = (avgSecond.artifactPerCapita - avgFirst.artifactPerCapita) / avgFirst.artifactPerCapita * 100;
  console.log(`  変化: ${surplusGrowth.toFixed(1)}%`);
  if (surplusGrowth > 10) {
    console.log('  → 余剰（Art/人口）が増加しており、H30を支持');
  } else if (surplusGrowth > 0) {
    console.log('  → 余剰は微増、H30を部分的に支持');
  } else {
    console.log('  → 余剰は増加していない、H30を支持しない');
  }
}

main().catch(console.error);
