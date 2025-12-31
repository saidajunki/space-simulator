/**
 * H79検証: 方言圏の維持には「移動の制限」が必要
 * 
 * 検証方法:
 * 1. 異なるエッジ密度（移動の容易さ）でシミュレーションを実行
 * 2. 方言圏の維持率を比較
 * 3. エッジ密度と方言圏維持率の相関を分析
 */

import { Universe } from '../src/core/universe';

interface MobilityResult {
  edgeDensity: number;
  avgDialectCount: number;
  avgMaintainRate: number;
  avgMoveCount: number;
  avgPopulation: number;
}

function calculateSimilarity(state1: Uint8Array, state2: Uint8Array): number {
  if (state1.length === 0 || state2.length === 0) return 0;
  const minLen = Math.min(state1.length, state2.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (state1[i] === state2[i]) matches++;
  }
  return matches / minLen;
}

async function runVerification() {
  const seeds = [42, 123, 456, 789, 1000];
  const ticks = 5000;
  const snapshotInterval = 250;
  const edgeDensities = [0.1, 0.2, 0.3, 0.4, 0.5];
  
  console.log('=== H79検証: 方言圏の維持には「移動の制限」が必要 ===\n');
  
  const results: MobilityResult[] = [];
  
  for (const edgeDensity of edgeDensities) {
    console.log(`\n--- エッジ密度: ${edgeDensity} ---`);
    
    let totalDialectCount = 0;
    let totalMaintainCount = 0;
    let totalTransitions = 0;
    let totalMoveCount = 0;
    let totalPopulation = 0;
    let populationSamples = 0;
    
    for (const seed of seeds) {
      const universe = new Universe({
        seed,
        worldGen: {
          nodeCount: 25,
          edgeDensity,
          initialEntityCount: 80
        },
        resourceRegenerationRate: 0.018
      });
      
      // 前回の方言圏ノード
      let prevDialectNodes = new Set<string>();
      let seedMoveCount = 0;
      
      // シミュレーション実行
      for (let t = 0; t < ticks; t++) {
        universe.step();
        
        // 移動イベントをカウント
        const events = universe.getEventLog();
        for (const event of events) {
          if (event.type === 'move') {
            seedMoveCount++;
          }
        }
        universe.clearEventLog();
        
        // スナップショット
        if ((t + 1) % snapshotInterval === 0) {
          const entities = universe.getAllEntities();
          
          // 人口をサンプリング
          totalPopulation += entities.length;
          populationSamples++;
          
          // ノードごとにエンティティをグループ化
          const nodeEntities = new Map<string, typeof entities>();
          for (const entity of entities) {
            const nodeId = entity.nodeId;
            if (!nodeEntities.has(nodeId)) {
              nodeEntities.set(nodeId, []);
            }
            nodeEntities.get(nodeId)!.push(entity);
          }
          
          // 現在の方言圏ノードを特定
          const currentDialectNodes = new Set<string>();
          
          for (const [nodeId, nodeEnts] of nodeEntities) {
            if (nodeEnts.length < 2) continue;
            
            // ノード内類似度を計算
            let totalSim = 0;
            let pairCount = 0;
            for (let i = 0; i < nodeEnts.length; i++) {
              for (let j = i + 1; j < nodeEnts.length; j++) {
                const sim = calculateSimilarity(
                  nodeEnts[i].state.getData(),
                  nodeEnts[j].state.getData()
                );
                totalSim += sim;
                pairCount++;
              }
            }
            const avgSimilarity = pairCount > 0 ? totalSim / pairCount : 0;
            
            if (avgSimilarity >= 0.1) {
              currentDialectNodes.add(nodeId);
            }
          }
          
          totalDialectCount += currentDialectNodes.size;
          
          // 維持率を計算（前回方言圏だったノードが今回も方言圏か）
          for (const nodeId of prevDialectNodes) {
            totalTransitions++;
            if (currentDialectNodes.has(nodeId)) {
              totalMaintainCount++;
            }
          }
          
          prevDialectNodes = currentDialectNodes;
        }
      }
      
      totalMoveCount += seedMoveCount;
    }
    
    const avgDialectCount = totalDialectCount / (seeds.length * (ticks / snapshotInterval));
    const avgMaintainRate = totalTransitions > 0 ? totalMaintainCount / totalTransitions : 0;
    const avgMoveCount = totalMoveCount / seeds.length;
    const avgPopulation = populationSamples > 0 ? totalPopulation / populationSamples : 0;
    
    console.log(`  平均方言圏数: ${avgDialectCount.toFixed(2)}`);
    console.log(`  方言圏維持率: ${(avgMaintainRate * 100).toFixed(1)}%`);
    console.log(`  平均移動回数: ${avgMoveCount.toFixed(0)}`);
    console.log(`  平均人口: ${avgPopulation.toFixed(1)}`);
    
    results.push({
      edgeDensity,
      avgDialectCount,
      avgMaintainRate,
      avgMoveCount,
      avgPopulation
    });
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===');
  
  const n = results.length;
  const sumX = results.reduce((sum, r) => sum + r.edgeDensity, 0);
  const sumY = results.reduce((sum, r) => sum + r.avgMaintainRate, 0);
  const sumXY = results.reduce((sum, r) => sum + r.edgeDensity * r.avgMaintainRate, 0);
  const sumX2 = results.reduce((sum, r) => sum + r.edgeDensity * r.edgeDensity, 0);
  const sumY2 = results.reduce((sum, r) => sum + r.avgMaintainRate * r.avgMaintainRate, 0);
  
  const correlation = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  console.log(`\nエッジ密度 vs 方言圏維持率の相関: ${correlation.toFixed(4)}`);
  
  // 移動回数との相関
  const sumY_move = results.reduce((sum, r) => sum + r.avgMoveCount, 0);
  const sumXY_move = results.reduce((sum, r) => sum + r.edgeDensity * r.avgMoveCount, 0);
  const sumY2_move = results.reduce((sum, r) => sum + r.avgMoveCount * r.avgMoveCount, 0);
  
  const correlation_move = (n * sumXY_move - sumX * sumY_move) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2_move - sumY_move * sumY_move));
  
  console.log(`エッジ密度 vs 移動回数の相関: ${correlation_move.toFixed(4)}`);
  
  // 移動回数と維持率の相関
  const sumXY_move_maintain = results.reduce((sum, r) => sum + r.avgMoveCount * r.avgMaintainRate, 0);
  
  const correlation_move_maintain = (n * sumXY_move_maintain - sumY_move * sumY) / 
    Math.sqrt((n * sumY2_move - sumY_move * sumY_move) * (n * sumY2 - sumY * sumY));
  
  console.log(`移動回数 vs 方言圏維持率の相関: ${correlation_move_maintain.toFixed(4)}`);
  
  // 結果テーブル
  console.log('\n\n=== 結果サマリー ===');
  console.log('| エッジ密度 | 方言圏数 | 維持率 | 移動回数 | 人口 |');
  console.log('|-----------|---------|--------|---------|------|');
  for (const r of results) {
    console.log(`| ${r.edgeDensity.toFixed(1)} | ${r.avgDialectCount.toFixed(2)} | ${(r.avgMaintainRate * 100).toFixed(1)}% | ${r.avgMoveCount.toFixed(0)} | ${r.avgPopulation.toFixed(1)} |`);
  }
  
  // 結論
  console.log('\n\n=== 結論 ===');
  if (correlation < -0.5) {
    console.log('H79を支持: 移動の制限（低エッジ密度）が方言圏維持に必要');
    console.log(`  エッジ密度と維持率に負の相関（${correlation.toFixed(3)}）`);
  } else if (correlation > 0.5) {
    console.log('H79を棄却: 移動の容易さ（高エッジ密度）が方言圏維持に有利');
    console.log(`  エッジ密度と維持率に正の相関（${correlation.toFixed(3)}）`);
  } else {
    console.log('H79を棄却: エッジ密度と方言圏維持率に有意な相関がない');
    console.log(`  相関係数: ${correlation.toFixed(3)}`);
  }
}

runVerification().catch(console.error);
