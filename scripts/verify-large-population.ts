/**
 * 大規模人口での選択圧検証スクリプト
 * 
 * 目的: H20, H24を検証
 * - H20: 人口が少ないため、遺伝的浮動が選択を上回っている
 * - H24: 選択圧は存在するが、遺伝的浮動に埋もれている
 * 
 * アプローチ:
 * 1. 人口を100体以上に増やす
 * 2. 遺伝的浮動の影響を減らす
 * 3. 選択圧が検出できるか検証
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';
import { extractSkills, SkillIndex } from '../src/core/skill.js';

interface EntitySnapshot {
  id: string;
  harvestSkill: number;
  energy: number;
  age: number;
  deathTick?: number;
}

interface SimulationResult {
  seed: number;
  initialPopulation: number;
  finalPopulation: number;
  totalDeaths: number;
  totalBirths: number;
  avgHarvestSkillSurvivors: number;
  avgHarvestSkillDeceased: number;
  skillDifference: number;
  selectionCoefficient: number;
  effectivePopulationSize: number;
}

function runSimulation(seed: number, initialPop: number, ticks: number): SimulationResult {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.020, // 大人口を維持できる程度
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount: 50, // 大きめのワールド
      initialEntityCount: initialPop, // 正しいパラメータ名
      edgeDensity: 0.3,
    },
  });

  const initialEntities = new Map<string, EntitySnapshot>();
  const deceased: EntitySnapshot[] = [];
  
  for (const entity of universe.getAllEntities()) {
    const skills = extractSkills(entity.state.getData());
    initialEntities.set(entity.id, {
      id: entity.id,
      harvestSkill: skills[SkillIndex.Harvest]!,
      energy: entity.energy,
      age: entity.age,
    });
  }

  let totalDeaths = 0;
  let totalBirths = 0;
  let populationSum = 0;
  let populationCount = 0;

  for (let t = 0; t < ticks; t++) {
    const beforeEntities = new Set(universe.getAllEntities().map(e => e.id));
    
    universe.step();
    
    const afterEntities = new Set(universe.getAllEntities().map(e => e.id));
    
    // 人口を記録
    populationSum += afterEntities.size;
    populationCount++;
    
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
    
    for (const entity of universe.getAllEntities()) {
      if (!beforeEntities.has(entity.id) && !initialEntities.has(entity.id)) {
        const skills = extractSkills(entity.state.getData());
        initialEntities.set(entity.id, {
          id: entity.id,
          harvestSkill: skills[SkillIndex.Harvest]!,
          energy: entity.energy,
          age: entity.age,
        });
        totalBirths++;
      }
    }
  }

  const survivors: EntitySnapshot[] = [];
  for (const entity of universe.getAllEntities()) {
    const snapshot = initialEntities.get(entity.id);
    if (snapshot) {
      snapshot.energy = entity.energy;
      snapshot.age = entity.age;
      survivors.push(snapshot);
    }
  }

  const avgHarvestSkillSurvivors = survivors.length > 0
    ? survivors.reduce((sum, e) => sum + e.harvestSkill, 0) / survivors.length
    : 0;
  const avgHarvestSkillDeceased = deceased.length > 0
    ? deceased.reduce((sum, e) => sum + e.harvestSkill, 0) / deceased.length
    : 0;
  
  const skillDifference = avgHarvestSkillSurvivors - avgHarvestSkillDeceased;
  
  const allSkills = [...survivors, ...deceased].map(e => e.harvestSkill);
  const mean = allSkills.reduce((a, b) => a + b, 0) / allSkills.length;
  const variance = allSkills.reduce((sum, x) => sum + (x - mean) ** 2, 0) / allSkills.length;
  const stdDev = Math.sqrt(variance);
  const selectionCoefficient = stdDev > 0 ? skillDifference / stdDev : 0;

  // 有効集団サイズ（平均人口）
  const effectivePopulationSize = populationSum / populationCount;

  return {
    seed,
    initialPopulation: initialPop,
    finalPopulation: survivors.length,
    totalDeaths,
    totalBirths,
    avgHarvestSkillSurvivors,
    avgHarvestSkillDeceased,
    skillDifference,
    selectionCoefficient,
    effectivePopulationSize,
  };
}

async function main() {
  console.log('=== 大規模人口での選択圧検証 ===\n');
  console.log('目的: 人口を増やして遺伝的浮動の影響を減らし、選択圧を検出\n');

  const seeds = [42, 123, 456, 789, 1000];
  const populations = [50, 100, 150]; // 異なる初期人口
  const ticks = 10000;

  const results: SimulationResult[] = [];

  for (const pop of populations) {
    console.log(`\n--- 初期人口: ${pop} ---`);
    
    for (const seed of seeds) {
      console.log(`  Seed ${seed}...`);
      const result = runSimulation(seed, pop, ticks);
      results.push(result);
      
      console.log(`    有効集団サイズ: ${result.effectivePopulationSize.toFixed(1)}`);
      console.log(`    生存: ${result.finalPopulation}, 死亡: ${result.totalDeaths}, 出生: ${result.totalBirths}`);
      console.log(`    生存者Harvest平均: ${result.avgHarvestSkillSurvivors.toFixed(3)}`);
      console.log(`    死亡者Harvest平均: ${result.avgHarvestSkillDeceased.toFixed(3)}`);
      console.log(`    選択係数: ${result.selectionCoefficient.toFixed(3)}`);
    }
  }

  // 集計
  console.log('\n\n=== 集計結果 ===\n');
  
  for (const pop of populations) {
    const popResults = results.filter(r => r.initialPopulation === pop);
    const avgSelectionCoef = popResults.reduce((sum, r) => sum + r.selectionCoefficient, 0) / popResults.length;
    const avgEffectivePop = popResults.reduce((sum, r) => sum + r.effectivePopulationSize, 0) / popResults.length;
    const positiveCount = popResults.filter(r => r.selectionCoefficient > 0).length;
    
    console.log(`初期人口 ${pop}:`);
    console.log(`  平均有効集団サイズ: ${avgEffectivePop.toFixed(1)}`);
    console.log(`  平均選択係数: ${avgSelectionCoef.toFixed(4)}`);
    console.log(`  正の選択圧が観察されたケース: ${positiveCount}/${popResults.length}`);
    console.log();
  }

  // 結論
  console.log('\n=== 結論 ===\n');
  
  const smallPopResults = results.filter(r => r.initialPopulation === 50);
  const largePopResults = results.filter(r => r.initialPopulation === 150);
  
  const avgSelectionSmall = smallPopResults.reduce((sum, r) => sum + r.selectionCoefficient, 0) / smallPopResults.length;
  const avgSelectionLarge = largePopResults.reduce((sum, r) => sum + r.selectionCoefficient, 0) / largePopResults.length;
  
  const positiveSmall = smallPopResults.filter(r => r.selectionCoefficient > 0).length;
  const positiveLarge = largePopResults.filter(r => r.selectionCoefficient > 0).length;
  
  if (positiveLarge > positiveSmall) {
    console.log('✓ 大人口では選択圧がより明確に観察された');
    console.log(`  小人口: 正の選択圧 ${positiveSmall}/5, 平均係数 ${avgSelectionSmall.toFixed(3)}`);
    console.log(`  大人口: 正の選択圧 ${positiveLarge}/5, 平均係数 ${avgSelectionLarge.toFixed(3)}`);
    console.log('  → H20, H24を支持: 遺伝的浮動が選択圧を埋もれさせていた');
  } else if (avgSelectionLarge > avgSelectionSmall) {
    console.log('△ 大人口で選択係数が改善したが、明確な差はない');
    console.log(`  小人口: 平均係数 ${avgSelectionSmall.toFixed(3)}`);
    console.log(`  大人口: 平均係数 ${avgSelectionLarge.toFixed(3)}`);
    console.log('  → さらなる検証が必要');
  } else {
    console.log('✗ 人口を増やしても選択圧は改善しなかった');
    console.log(`  小人口: 平均係数 ${avgSelectionSmall.toFixed(3)}`);
    console.log(`  大人口: 平均係数 ${avgSelectionLarge.toFixed(3)}`);
    console.log('  → H20, H24を棄却: 遺伝的浮動以外の要因が支配的');
  }
}

main().catch(console.error);
