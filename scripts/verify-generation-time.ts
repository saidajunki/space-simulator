/**
 * H84検証: 世代時間は環境条件（資源再生率など）に依存する
 * 
 * 検証方法:
 * 1. 異なる資源再生率でシミュレーションを実行
 * 2. 世代時間（複製間隔）を測定
 * 3. 資源再生率と世代時間の相関を分析
 */

import { Universe } from '../src/core/universe';

interface GenerationStats {
  regenRate: number;
  avgGenerationTime: number;
  maxGeneration: number;
  totalReplications: number;
  avgPopulation: number;
}

async function runVerification() {
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 5000;
  const regenRates = [0.010, 0.014, 0.018, 0.022, 0.026];
  
  console.log('=== H84検証: 世代時間は環境条件（資源再生率など）に依存する ===\n');
  
  const results: GenerationStats[] = [];
  
  for (const regenRate of regenRates) {
    console.log(`\n--- 資源再生率: ${regenRate} ---`);
    
    let totalGenerationTime = 0;
    let totalReplications = 0;
    let totalMaxGeneration = 0;
    let totalPopulation = 0;
    let populationSamples = 0;
    
    for (const seed of seeds) {
      const universe = new Universe({
        seed,
        worldGen: {
          nodeCount: 25,
          edgeDensity: 0.3,
          initialEntityCount: 50
        },
        resourceRegenerationRate: regenRate
      });
      
      // 世代を追跡
      const generationMap = new Map<string, number>();
      const birthTickMap = new Map<string, number>();
      
      // 初期エンティティは世代0
      for (const entity of universe.getAllEntities()) {
        generationMap.set(entity.id, 0);
        birthTickMap.set(entity.id, 0);
      }
      
      let seedReplications = 0;
      let seedGenerationTimeSum = 0;
      
      // シミュレーション実行
      for (let t = 0; t < ticks; t++) {
        universe.step();
        
        // 複製イベントを処理
        const events = universe.getEventLog();
        for (const event of events) {
          if (event.type === 'replication') {
            const parentId = (event as any).parentId;
            const childId = (event as any).childId;
            if (parentId && childId) {
              const parentGen = generationMap.get(parentId) ?? 0;
              generationMap.set(childId, parentGen + 1);
              birthTickMap.set(childId, t);
              
              // 親の誕生tickからの経過時間を計算
              const parentBirthTick = birthTickMap.get(parentId) ?? 0;
              const generationTime = t - parentBirthTick;
              seedGenerationTimeSum += generationTime;
              seedReplications++;
            }
          }
        }
        universe.clearEventLog();
        
        // 人口をサンプリング
        if ((t + 1) % 500 === 0) {
          totalPopulation += universe.getAllEntities().length;
          populationSamples++;
        }
      }
      
      // 最大世代を計算
      let maxGen = 0;
      for (const gen of generationMap.values()) {
        if (gen > maxGen) maxGen = gen;
      }
      
      totalReplications += seedReplications;
      totalGenerationTime += seedGenerationTimeSum;
      totalMaxGeneration += maxGen;
    }
    
    const avgGenerationTime = totalReplications > 0 ? totalGenerationTime / totalReplications : 0;
    const avgMaxGeneration = totalMaxGeneration / seeds.length;
    const avgPopulation = populationSamples > 0 ? totalPopulation / populationSamples : 0;
    
    console.log(`  総複製数: ${totalReplications}`);
    console.log(`  平均世代時間: ${avgGenerationTime.toFixed(1)} tick`);
    console.log(`  平均最大世代: ${avgMaxGeneration.toFixed(1)}`);
    console.log(`  平均人口: ${avgPopulation.toFixed(1)}`);
    
    results.push({
      regenRate,
      avgGenerationTime,
      maxGeneration: avgMaxGeneration,
      totalReplications,
      avgPopulation
    });
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===');
  
  // 資源再生率と世代時間の相関
  const n = results.length;
  const sumX = results.reduce((sum, r) => sum + r.regenRate, 0);
  const sumY = results.reduce((sum, r) => sum + r.avgGenerationTime, 0);
  const sumXY = results.reduce((sum, r) => sum + r.regenRate * r.avgGenerationTime, 0);
  const sumX2 = results.reduce((sum, r) => sum + r.regenRate * r.regenRate, 0);
  const sumY2 = results.reduce((sum, r) => sum + r.avgGenerationTime * r.avgGenerationTime, 0);
  
  const correlation = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  console.log(`\n資源再生率 vs 世代時間の相関: ${correlation.toFixed(4)}`);
  
  // 資源再生率と複製数の相関
  const sumY_rep = results.reduce((sum, r) => sum + r.totalReplications, 0);
  const sumXY_rep = results.reduce((sum, r) => sum + r.regenRate * r.totalReplications, 0);
  const sumY2_rep = results.reduce((sum, r) => sum + r.totalReplications * r.totalReplications, 0);
  
  const correlation_rep = (n * sumXY_rep - sumX * sumY_rep) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2_rep - sumY_rep * sumY_rep));
  
  console.log(`資源再生率 vs 複製数の相関: ${correlation_rep.toFixed(4)}`);
  
  // 結果テーブル
  console.log('\n\n=== 結果サマリー ===');
  console.log('| 資源再生率 | 世代時間 | 最大世代 | 複製数 | 平均人口 |');
  console.log('|-----------|---------|---------|--------|---------|');
  for (const r of results) {
    console.log(`| ${r.regenRate.toFixed(3)} | ${r.avgGenerationTime.toFixed(1)} | ${r.maxGeneration.toFixed(1)} | ${r.totalReplications} | ${r.avgPopulation.toFixed(1)} |`);
  }
  
  // 結論
  console.log('\n\n=== 結論 ===');
  if (Math.abs(correlation) > 0.7) {
    const direction = correlation < 0 ? '負' : '正';
    console.log(`H84を強く支持: 資源再生率と世代時間に強い${direction}の相関（${correlation.toFixed(3)}）`);
    if (correlation < 0) {
      console.log('  資源が豊富なほど世代時間が短い（複製が速い）');
    } else {
      console.log('  資源が豊富なほど世代時間が長い（複製が遅い）');
    }
  } else if (Math.abs(correlation) > 0.4) {
    console.log(`H84を部分的に支持: 資源再生率と世代時間に中程度の相関（${correlation.toFixed(3)}）`);
  } else {
    console.log(`H84を棄却: 資源再生率と世代時間に有意な相関がない（${correlation.toFixed(3)}）`);
  }
}

runVerification().catch(console.error);
