/**
 * H86検証: 世代時間は「人口密度」に依存する
 * 
 * H84の検証で資源再生率と世代時間に相関がないことが判明。
 * 中間的な資源再生率で世代時間が最大になることから、人口密度が影響している可能性。
 * 
 * 検証方法:
 * 1. 異なる人口密度（ノード数を変えて）でシミュレーションを実行
 * 2. 世代時間（平均複製間隔）を計測
 * 3. 人口密度と世代時間の相関を分析
 */

import { Universe } from '../src/core/universe';

interface DensityResult {
  nodeCount: number;
  avgPopulation: number;
  avgDensity: number;
  avgGenerationTime: number;
  totalReplications: number;
  avgReplicationRate: number;
}

async function runVerification() {
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 5000;
  const nodeCounts = [10, 15, 20, 30, 50];
  
  console.log('=== H86検証: 世代時間は「人口密度」に依存する ===\n');
  
  const results: DensityResult[] = [];
  
  for (const nodeCount of nodeCounts) {
    console.log(`\n--- ノード数: ${nodeCount} ---`);
    
    let totalPopulation = 0;
    let totalReplications = 0;
    let totalGenerationTime = 0;
    let generationTimeSamples = 0;
    let populationSamples = 0;
    
    for (const seed of seeds) {
      const universe = new Universe({
        seed,
        worldGen: {
          nodeCount,
          edgeDensity: 0.3,
          initialEntityCount: 80
        },
        resourceRegenerationRate: 0.018
      });
      
      // 複製イベントの時刻を記録
      const replicationTimes: number[] = [];
      
      // シミュレーション実行
      for (let t = 0; t < ticks; t++) {
        universe.step();
        
        // イベントをカウント
        const events = universe.getEventLog();
        for (const event of events) {
          if (event.type === 'replication') {
            replicationTimes.push(t);
          }
        }
        universe.clearEventLog();
        
        // 人口をサンプリング（100 tickごと）
        if ((t + 1) % 100 === 0) {
          const entities = universe.getAllEntities();
          totalPopulation += entities.length;
          populationSamples++;
        }
      }
      
      totalReplications += replicationTimes.length;
      
      // 世代時間を計算（連続する複製間の平均間隔）
      if (replicationTimes.length > 1) {
        let intervalSum = 0;
        for (let i = 1; i < replicationTimes.length; i++) {
          intervalSum += replicationTimes[i] - replicationTimes[i - 1];
        }
        const avgInterval = intervalSum / (replicationTimes.length - 1);
        totalGenerationTime += avgInterval;
        generationTimeSamples++;
      }
    }
    
    const avgPopulation = populationSamples > 0 ? totalPopulation / populationSamples : 0;
    const avgDensity = avgPopulation / nodeCount;
    const avgGenerationTime = generationTimeSamples > 0 ? totalGenerationTime / generationTimeSamples : 0;
    const avgReplications = totalReplications / seeds.length;
    const avgReplicationRate = avgReplications / ticks;
    
    console.log(`  平均人口: ${avgPopulation.toFixed(1)}`);
    console.log(`  平均密度: ${avgDensity.toFixed(3)} 体/ノード`);
    console.log(`  平均世代時間: ${avgGenerationTime.toFixed(1)} tick`);
    console.log(`  総複製数: ${avgReplications.toFixed(0)}`);
    console.log(`  複製率: ${avgReplicationRate.toFixed(4)} /tick`);
    
    results.push({
      nodeCount,
      avgPopulation,
      avgDensity,
      avgGenerationTime,
      totalReplications: avgReplications,
      avgReplicationRate
    });
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===');
  
  const n = results.length;
  
  // 人口密度 vs 世代時間
  const sumX = results.reduce((sum, r) => sum + r.avgDensity, 0);
  const sumY = results.reduce((sum, r) => sum + r.avgGenerationTime, 0);
  const sumXY = results.reduce((sum, r) => sum + r.avgDensity * r.avgGenerationTime, 0);
  const sumX2 = results.reduce((sum, r) => sum + r.avgDensity * r.avgDensity, 0);
  const sumY2 = results.reduce((sum, r) => sum + r.avgGenerationTime * r.avgGenerationTime, 0);
  
  const corr_density_gen = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  console.log(`\n人口密度 vs 世代時間: ${isNaN(corr_density_gen) ? 'N/A' : corr_density_gen.toFixed(4)}`);
  
  // 人口 vs 世代時間
  const sumX_pop = results.reduce((sum, r) => sum + r.avgPopulation, 0);
  const sumXY_pop = results.reduce((sum, r) => sum + r.avgPopulation * r.avgGenerationTime, 0);
  const sumX2_pop = results.reduce((sum, r) => sum + r.avgPopulation * r.avgPopulation, 0);
  
  const corr_pop_gen = (n * sumXY_pop - sumX_pop * sumY) / 
    Math.sqrt((n * sumX2_pop - sumX_pop * sumX_pop) * (n * sumY2 - sumY * sumY));
  
  console.log(`人口 vs 世代時間: ${isNaN(corr_pop_gen) ? 'N/A' : corr_pop_gen.toFixed(4)}`);
  
  // ノード数 vs 世代時間
  const sumX_node = results.reduce((sum, r) => sum + r.nodeCount, 0);
  const sumXY_node = results.reduce((sum, r) => sum + r.nodeCount * r.avgGenerationTime, 0);
  const sumX2_node = results.reduce((sum, r) => sum + r.nodeCount * r.nodeCount, 0);
  
  const corr_node_gen = (n * sumXY_node - sumX_node * sumY) / 
    Math.sqrt((n * sumX2_node - sumX_node * sumX_node) * (n * sumY2 - sumY * sumY));
  
  console.log(`ノード数 vs 世代時間: ${corr_node_gen.toFixed(4)}`);
  
  // 人口密度 vs 複製率
  const sumY_rep = results.reduce((sum, r) => sum + r.avgReplicationRate, 0);
  const sumXY_rep = results.reduce((sum, r) => sum + r.avgDensity * r.avgReplicationRate, 0);
  const sumY2_rep = results.reduce((sum, r) => sum + r.avgReplicationRate * r.avgReplicationRate, 0);
  
  const corr_density_rep = (n * sumXY_rep - sumX * sumY_rep) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2_rep - sumY_rep * sumY_rep));
  
  console.log(`人口密度 vs 複製率: ${isNaN(corr_density_rep) ? 'N/A' : corr_density_rep.toFixed(4)}`);
  
  // 結果テーブル
  console.log('\n\n=== 結果サマリー ===');
  console.log('| ノード数 | 人口 | 密度 | 世代時間 | 複製数 | 複製率 |');
  console.log('|---------|------|------|---------|--------|--------|');
  for (const r of results) {
    console.log(`| ${r.nodeCount} | ${r.avgPopulation.toFixed(1)} | ${r.avgDensity.toFixed(3)} | ${r.avgGenerationTime.toFixed(1)} | ${r.totalReplications.toFixed(0)} | ${r.avgReplicationRate.toFixed(4)} |`);
  }
  
  // 結論
  console.log('\n\n=== 結論 ===');
  
  if (Math.abs(corr_density_gen) > 0.5) {
    if (corr_density_gen > 0) {
      console.log('H86を支持: 人口密度が高いほど世代時間が長い');
    } else {
      console.log('H86を支持（逆方向）: 人口密度が高いほど世代時間が短い');
    }
    console.log(`  人口密度と世代時間の相関: ${corr_density_gen.toFixed(3)}`);
  } else {
    console.log('H86を棄却: 人口密度と世代時間に有意な相関がない');
    console.log(`  相関係数: ${corr_density_gen.toFixed(3)}`);
  }
  
  // 追加の考察
  console.log('\n追加の考察:');
  console.log(`  人口と世代時間の相関: ${corr_pop_gen.toFixed(3)}`);
  console.log(`  ノード数と世代時間の相関: ${corr_node_gen.toFixed(3)}`);
  console.log(`  人口密度と複製率の相関: ${corr_density_rep.toFixed(3)}`);
  
  if (Math.abs(corr_pop_gen) > Math.abs(corr_density_gen)) {
    console.log('\n  → 世代時間は「人口密度」よりも「絶対人口」に依存する可能性');
  }
  if (Math.abs(corr_node_gen) > Math.abs(corr_density_gen)) {
    console.log('\n  → 世代時間は「人口密度」よりも「空間構造（ノード数）」に依存する可能性');
  }
}

runVerification().catch(console.error);
