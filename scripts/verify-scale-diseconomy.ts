/**
 * 規模の不経済の原因分析スクリプト
 * 
 * 目的: H32「小集団の方が一人当たりの生産性が高い」の原因を分析
 * - 人口規模と一人当たり生産性の関係
 * - 資源競争、移動コスト、協調コストの影響を分析
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface ScaleAnalysis {
  initialPopulation: number;
  seed: number;
  // 基本指標
  avgPopulation: number;
  avgArtifacts: number;
  artPerCapita: number;
  // 効率指標
  avgEnergyPerEntity: number;
  avgHarvestPerEntity: number;
  avgReplicationRate: number;
  // 競争指標
  avgEntitiesPerNode: number;
  resourceUtilization: number;
  // 協調指標
  cooperationRate: number;
  avgInteractionsPerEntity: number;
}

function runSimulation(seed: number, initialPopulation: number, ticks: number): ScaleAnalysis {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: 0.018,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: initialPopulation,
      edgeDensity: 0.3,
    },
  });

  let totalPopulation = 0;
  let totalArtifacts = 0;
  let totalEnergy = 0;
  let totalHarvests = 0;
  let totalReplications = 0;
  let totalCooperativeReplications = 0;
  let totalInteractions = 0;
  let samples = 0;

  // ノード数
  const nodeCount = 30;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    const entities = universe.getAllEntities();
    const artifacts = universe.getAllArtifacts();
    const events = universe.getEventLog();
    
    // 基本指標
    totalPopulation += entities.length;
    totalArtifacts += artifacts.length;
    totalEnergy += entities.reduce((sum, e) => sum + e.energy, 0);
    samples++;
    
    // イベント集計
    for (const event of events) {
      if (event.type === 'harvest') {
        totalHarvests++;
      } else if (event.type === 'replication') {
        totalReplications++;
      } else if (event.type === 'partnerSelected') {
        totalCooperativeReplications++;
      } else if (event.type === 'interaction') {
        totalInteractions++;
      }
    }
  }

  const avgPopulation = totalPopulation / samples;
  const avgArtifacts = totalArtifacts / samples;
  const artPerCapita = avgPopulation > 0 ? avgArtifacts / avgPopulation : 0;
  const avgEnergyPerEntity = avgPopulation > 0 ? (totalEnergy / samples) / avgPopulation : 0;
  const avgHarvestPerEntity = avgPopulation > 0 ? totalHarvests / (avgPopulation * ticks) : 0;
  const avgReplicationRate = avgPopulation > 0 ? totalReplications / (avgPopulation * ticks) : 0;
  const avgEntitiesPerNode = avgPopulation / nodeCount;
  const resourceUtilization = avgPopulation / (nodeCount * 10); // 仮の最大収容力
  const cooperationRate = totalReplications > 0 ? totalCooperativeReplications / totalReplications : 0;
  const avgInteractionsPerEntity = avgPopulation > 0 ? totalInteractions / (avgPopulation * ticks) : 0;

  return {
    initialPopulation,
    seed,
    avgPopulation,
    avgArtifacts,
    artPerCapita,
    avgEnergyPerEntity,
    avgHarvestPerEntity,
    avgReplicationRate,
    avgEntitiesPerNode,
    resourceUtilization,
    cooperationRate,
    avgInteractionsPerEntity,
  };
}

async function main() {
  console.log('=== 規模の不経済の原因分析 ===\n');
  console.log('目的: H32「小集団の方が一人当たりの生産性が高い」の原因を分析\n');

  const populations = [20, 50, 100, 150, 200];
  const seeds = [42, 123, 456];
  const ticks = 1500;

  const results: ScaleAnalysis[] = [];

  for (const pop of populations) {
    console.log(`\n初期人口 ${pop}:`);
    for (const seed of seeds) {
      const result = runSimulation(seed, pop, ticks);
      results.push(result);
      console.log(`  Seed ${seed}: 平均人口=${result.avgPopulation.toFixed(1)}, Art/人=${result.artPerCapita.toFixed(2)}`);
    }
  }

  // 人口規模ごとに集計
  console.log('\n\n=== 人口規模別集計 ===\n');
  
  console.log('| 初期人口 | 平均人口 | Art/人 | エネルギー/人 | 採取/人 | 複製率 | 密度/ノード | 協力率 |');
  console.log('|----------|----------|--------|---------------|---------|--------|-------------|--------|');
  
  for (const pop of populations) {
    const popResults = results.filter(r => r.initialPopulation === pop);
    const avg = {
      avgPopulation: popResults.reduce((sum, r) => sum + r.avgPopulation, 0) / popResults.length,
      artPerCapita: popResults.reduce((sum, r) => sum + r.artPerCapita, 0) / popResults.length,
      avgEnergyPerEntity: popResults.reduce((sum, r) => sum + r.avgEnergyPerEntity, 0) / popResults.length,
      avgHarvestPerEntity: popResults.reduce((sum, r) => sum + r.avgHarvestPerEntity, 0) / popResults.length,
      avgReplicationRate: popResults.reduce((sum, r) => sum + r.avgReplicationRate, 0) / popResults.length,
      avgEntitiesPerNode: popResults.reduce((sum, r) => sum + r.avgEntitiesPerNode, 0) / popResults.length,
      cooperationRate: popResults.reduce((sum, r) => sum + r.cooperationRate, 0) / popResults.length,
    };
    
    console.log(`| ${pop} | ${avg.avgPopulation.toFixed(1)} | ${avg.artPerCapita.toFixed(2)} | ${avg.avgEnergyPerEntity.toFixed(2)} | ${avg.avgHarvestPerEntity.toFixed(3)} | ${avg.avgReplicationRate.toFixed(4)} | ${avg.avgEntitiesPerNode.toFixed(2)} | ${(avg.cooperationRate * 100).toFixed(1)}% |`);
  }

  // 相関分析
  console.log('\n\n=== 相関分析 ===\n');
  
  // 人口とArt/人の相関
  const popValues = results.map(r => r.avgPopulation);
  const artPerCapitaValues = results.map(r => r.artPerCapita);
  const energyValues = results.map(r => r.avgEnergyPerEntity);
  const harvestValues = results.map(r => r.avgHarvestPerEntity);
  const densityValues = results.map(r => r.avgEntitiesPerNode);
  
  const correlate = (x: number[], y: number[]): number => {
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
  
  console.log(`人口 vs Art/人: r = ${correlate(popValues, artPerCapitaValues).toFixed(3)}`);
  console.log(`人口 vs エネルギー/人: r = ${correlate(popValues, energyValues).toFixed(3)}`);
  console.log(`人口 vs 採取/人: r = ${correlate(popValues, harvestValues).toFixed(3)}`);
  console.log(`密度 vs Art/人: r = ${correlate(densityValues, artPerCapitaValues).toFixed(3)}`);
  console.log(`密度 vs エネルギー/人: r = ${correlate(densityValues, energyValues).toFixed(3)}`);

  // 結論
  console.log('\n\n=== 結論 ===\n');
  
  const smallPop = results.filter(r => r.initialPopulation === 20);
  const largePop = results.filter(r => r.initialPopulation === 200);
  
  const smallAvgArtPerCapita = smallPop.reduce((sum, r) => sum + r.artPerCapita, 0) / smallPop.length;
  const largeAvgArtPerCapita = largePop.reduce((sum, r) => sum + r.artPerCapita, 0) / largePop.length;
  const smallAvgEnergy = smallPop.reduce((sum, r) => sum + r.avgEnergyPerEntity, 0) / smallPop.length;
  const largeAvgEnergy = largePop.reduce((sum, r) => sum + r.avgEnergyPerEntity, 0) / largePop.length;
  const smallAvgHarvest = smallPop.reduce((sum, r) => sum + r.avgHarvestPerEntity, 0) / smallPop.length;
  const largeAvgHarvest = largePop.reduce((sum, r) => sum + r.avgHarvestPerEntity, 0) / largePop.length;
  
  console.log('小集団(20) vs 大集団(200)の比較:');
  console.log(`  Art/人: ${smallAvgArtPerCapita.toFixed(2)} vs ${largeAvgArtPerCapita.toFixed(2)} (${((smallAvgArtPerCapita / largeAvgArtPerCapita - 1) * 100).toFixed(1)}%)`);
  console.log(`  エネルギー/人: ${smallAvgEnergy.toFixed(2)} vs ${largeAvgEnergy.toFixed(2)} (${((smallAvgEnergy / largeAvgEnergy - 1) * 100).toFixed(1)}%)`);
  console.log(`  採取/人: ${smallAvgHarvest.toFixed(3)} vs ${largeAvgHarvest.toFixed(3)} (${((smallAvgHarvest / largeAvgHarvest - 1) * 100).toFixed(1)}%)`);
  
  const popArtCorr = correlate(popValues, artPerCapitaValues);
  const popEnergyCorr = correlate(popValues, energyValues);
  
  if (popArtCorr < -0.3 && popEnergyCorr < -0.3) {
    console.log('\n→ H32を支持: 規模の不経済が確認された');
    console.log('  原因: 資源競争による一人当たりエネルギーの減少');
  } else if (popArtCorr < -0.3) {
    console.log('\n→ H32を部分的に支持: Art/人は減少するが、エネルギー/人は減少しない');
    console.log('  原因: 資源競争以外の要因（協調コスト、移動コストなど）');
  } else {
    console.log('\n→ H32を棄却: 規模の不経済は確認されなかった');
  }
}

main().catch(console.error);
