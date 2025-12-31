/**
 * スキル選択圧の検証スクリプト
 * 
 * 目的: H21-H23を検証
 * - H21: スキルボーナスが生存に与える影響が小さすぎる
 * - H22: スキルボーナスは「行動効率」を上げるだけで、「生存確率」に直接影響しない
 * - H23: スキルが低くても他の要因で補えるため、選択圧が弱い
 * 
 * アプローチ:
 * 1. 厳しい環境（低資源再生率）でシミュレーション
 * 2. 生存者と死亡者のスキル分布を比較
 * 3. 選択圧が発生しているか検証
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';
import { extractSkills, SkillIndex, SKILL_COUNT } from '../src/core/skill.js';

interface EntitySnapshot {
  id: string;
  harvestSkill: number;
  repairSkill: number;
  createSkill: number;
  moveSkill: number;
  energy: number;
  age: number;
  deathTick?: number;
}

interface SimulationResult {
  seed: number;
  regenRate: number;
  initialPopulation: number;
  finalPopulation: number;
  totalDeaths: number;
  totalBirths: number;
  survivors: EntitySnapshot[];
  deceased: EntitySnapshot[];
  avgHarvestSkillSurvivors: number;
  avgHarvestSkillDeceased: number;
  skillDifference: number;
  selectionCoefficient: number;
}

function runSimulation(seed: number, regenRate: number, ticks: number): SimulationResult {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: regenRate,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0, // 強めの係数
    worldGen: {
      nodeCount: 20,
      entityCount: 50, // 中程度の初期人口
      edgeDensity: 0.3,
    },
  });

  // 初期エンティティのスナップショット
  const initialEntities = new Map<string, EntitySnapshot>();
  const deceased: EntitySnapshot[] = [];
  
  for (const entity of universe.getAllEntities()) {
    const skills = extractSkills(entity.state.getData());
    initialEntities.set(entity.id, {
      id: entity.id,
      harvestSkill: skills[SkillIndex.Harvest]!,
      repairSkill: skills[SkillIndex.Repair]!,
      createSkill: skills[SkillIndex.Create]!,
      moveSkill: skills[SkillIndex.Move]!,
      energy: entity.energy,
      age: entity.age,
    });
  }

  let totalDeaths = 0;
  let totalBirths = 0;

  // シミュレーション実行
  for (let t = 0; t < ticks; t++) {
    const beforeEntities = new Set(universe.getAllEntities().map(e => e.id));
    
    universe.step();
    
    const afterEntities = new Set(universe.getAllEntities().map(e => e.id));
    
    // 死亡したエンティティを記録
    for (const id of beforeEntities) {
      if (!afterEntities.has(id)) {
        const snapshot = initialEntities.get(id);
        if (snapshot) {
          snapshot.deathTick = t;
          deceased.push(snapshot);
        }
        totalDeaths++;
      }
    }
    
    // 新しく生まれたエンティティを記録
    for (const entity of universe.getAllEntities()) {
      if (!beforeEntities.has(entity.id) && !initialEntities.has(entity.id)) {
        const skills = extractSkills(entity.state.getData());
        initialEntities.set(entity.id, {
          id: entity.id,
          harvestSkill: skills[SkillIndex.Harvest]!,
          repairSkill: skills[SkillIndex.Repair]!,
          createSkill: skills[SkillIndex.Create]!,
          moveSkill: skills[SkillIndex.Move]!,
          energy: entity.energy,
          age: entity.age,
        });
        totalBirths++;
      }
    }
  }

  // 生存者のスナップショット
  const survivors: EntitySnapshot[] = [];
  for (const entity of universe.getAllEntities()) {
    const snapshot = initialEntities.get(entity.id);
    if (snapshot) {
      snapshot.energy = entity.energy;
      snapshot.age = entity.age;
      survivors.push(snapshot);
    }
  }

  // 統計計算
  const avgHarvestSkillSurvivors = survivors.length > 0
    ? survivors.reduce((sum, e) => sum + e.harvestSkill, 0) / survivors.length
    : 0;
  const avgHarvestSkillDeceased = deceased.length > 0
    ? deceased.reduce((sum, e) => sum + e.harvestSkill, 0) / deceased.length
    : 0;
  
  const skillDifference = avgHarvestSkillSurvivors - avgHarvestSkillDeceased;
  
  // 選択係数: (生存者の平均 - 死亡者の平均) / 全体の標準偏差
  const allSkills = [...survivors, ...deceased].map(e => e.harvestSkill);
  const mean = allSkills.reduce((a, b) => a + b, 0) / allSkills.length;
  const variance = allSkills.reduce((sum, x) => sum + (x - mean) ** 2, 0) / allSkills.length;
  const stdDev = Math.sqrt(variance);
  const selectionCoefficient = stdDev > 0 ? skillDifference / stdDev : 0;

  return {
    seed,
    regenRate,
    initialPopulation: 50,
    finalPopulation: survivors.length,
    totalDeaths,
    totalBirths,
    survivors,
    deceased,
    avgHarvestSkillSurvivors,
    avgHarvestSkillDeceased,
    skillDifference,
    selectionCoefficient,
  };
}

async function main() {
  console.log('=== スキル選択圧の検証 ===\n');
  console.log('目的: 厳しい環境でスキルの選択圧が発生するか検証\n');

  const seeds = [42, 123, 456, 789, 1000];
  const regenRates = [0.010, 0.012, 0.014, 0.016]; // 中間的な環境
  const ticks = 10000; // より長期

  const results: SimulationResult[] = [];

  for (const regenRate of regenRates) {
    console.log(`\n--- 資源再生率: ${regenRate} ---`);
    
    for (const seed of seeds) {
      console.log(`  Seed ${seed}...`);
      const result = runSimulation(seed, regenRate, ticks);
      results.push(result);
      
      console.log(`    生存: ${result.finalPopulation}, 死亡: ${result.totalDeaths}, 出生: ${result.totalBirths}`);
      console.log(`    生存者Harvest平均: ${result.avgHarvestSkillSurvivors.toFixed(3)}`);
      console.log(`    死亡者Harvest平均: ${result.avgHarvestSkillDeceased.toFixed(3)}`);
      console.log(`    差分: ${result.skillDifference.toFixed(3)}, 選択係数: ${result.selectionCoefficient.toFixed(3)}`);
    }
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  
  for (const regenRate of regenRates) {
    const rateResults = results.filter(r => r.regenRate === regenRate);
    const avgSelectionCoef = rateResults.reduce((sum, r) => sum + r.selectionCoefficient, 0) / rateResults.length;
    const avgSkillDiff = rateResults.reduce((sum, r) => sum + r.skillDifference, 0) / rateResults.length;
    const avgFinalPop = rateResults.reduce((sum, r) => sum + r.finalPopulation, 0) / rateResults.length;
    const avgDeaths = rateResults.reduce((sum, r) => sum + r.totalDeaths, 0) / rateResults.length;
    
    console.log(`資源再生率 ${regenRate}:`);
    console.log(`  平均最終人口: ${avgFinalPop.toFixed(1)}`);
    console.log(`  平均死亡数: ${avgDeaths.toFixed(1)}`);
    console.log(`  平均スキル差分: ${avgSkillDiff.toFixed(4)}`);
    console.log(`  平均選択係数: ${avgSelectionCoef.toFixed(4)}`);
    console.log();
  }

  // 選択圧の判定
  console.log('\n=== 結論 ===\n');
  
  const harshResults = results.filter(r => r.regenRate === 0.004);
  const avgSelectionHarsh = harshResults.reduce((sum, r) => sum + r.selectionCoefficient, 0) / harshResults.length;
  
  if (avgSelectionHarsh > 0.1) {
    console.log('✓ 厳しい環境では選択圧が観察された');
    console.log(`  選択係数: ${avgSelectionHarsh.toFixed(3)} (> 0.1)`);
    console.log('  → H23を支持: 資源が豊富な環境では選択圧が弱い');
  } else if (avgSelectionHarsh > 0.05) {
    console.log('△ 弱い選択圧が観察された');
    console.log(`  選択係数: ${avgSelectionHarsh.toFixed(3)} (0.05-0.1)`);
    console.log('  → さらなる検証が必要');
  } else {
    console.log('✗ 厳しい環境でも選択圧は観察されなかった');
    console.log(`  選択係数: ${avgSelectionHarsh.toFixed(3)} (< 0.05)`);
    console.log('  → H21-H22を支持: スキルが生存に直接影響していない');
  }
}

main().catch(console.error);
