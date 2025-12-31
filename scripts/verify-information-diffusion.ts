/**
 * H88検証: エッジ密度は「移動」ではなく「情報拡散」を通じて方言圏に影響する
 * 
 * H79の検証で移動回数が0にもかかわらず、エッジ密度が方言圏に影響することが判明。
 * これはエッジ密度が「情報拡散」（interaction）を通じて方言圏に影響している可能性を示唆。
 * 
 * 検証方法:
 * 1. 異なるエッジ密度でシミュレーションを実行
 * 2. interaction回数（情報交換）を計測
 * 3. エッジ密度とinteraction回数、方言圏の関係を分析
 */

import { Universe } from '../src/core/universe';

interface DiffusionResult {
  edgeDensity: number;
  avgInteractionCount: number;
  avgInfoExchangeCount: number;
  avgDialectCount: number;
  avgWithinNodeSimilarity: number;
  avgBetweenNodeSimilarity: number;
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
  const edgeDensities = [0.1, 0.2, 0.3, 0.4, 0.5];
  
  console.log('=== H88検証: エッジ密度は「情報拡散」を通じて方言圏に影響する ===\n');
  
  const results: DiffusionResult[] = [];
  
  for (const edgeDensity of edgeDensities) {
    console.log(`\n--- エッジ密度: ${edgeDensity} ---`);
    
    let totalInteractionCount = 0;
    let totalInfoExchangeCount = 0;
    let totalDialectCount = 0;
    let totalWithinSim = 0;
    let totalBetweenSim = 0;
    let totalPopulation = 0;
    let simSamples = 0;
    
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
      
      let seedInteractionCount = 0;
      let seedInfoExchangeCount = 0;
      
      // シミュレーション実行
      for (let t = 0; t < ticks; t++) {
        universe.step();
        
        // イベントをカウント
        const events = universe.getEventLog();
        for (const event of events) {
          if (event.type === 'interaction') {
            seedInteractionCount++;
            // interactionは情報交換を含む
            seedInfoExchangeCount++;
          }
        }
        universe.clearEventLog();
      }
      
      totalInteractionCount += seedInteractionCount;
      totalInfoExchangeCount += seedInfoExchangeCount;
      
      // 最終状態を分析
      const entities = universe.getAllEntities();
      totalPopulation += entities.length;
      
      // ノードごとにエンティティをグループ化
      const nodeEntities = new Map<string, typeof entities>();
      for (const entity of entities) {
        const nodeId = entity.nodeId;
        if (!nodeEntities.has(nodeId)) {
          nodeEntities.set(nodeId, []);
        }
        nodeEntities.get(nodeId)!.push(entity);
      }
      
      // ノード内類似度とノード間類似度を計算
      let withinSimSum = 0;
      let withinPairs = 0;
      let betweenSimSum = 0;
      let betweenPairs = 0;
      let dialectCount = 0;
      
      const nodeIds = Array.from(nodeEntities.keys());
      
      for (const nodeId of nodeIds) {
        const nodeEnts = nodeEntities.get(nodeId)!;
        if (nodeEnts.length < 2) continue;
        
        // ノード内類似度
        let nodeSimSum = 0;
        let nodePairs = 0;
        for (let i = 0; i < nodeEnts.length; i++) {
          for (let j = i + 1; j < nodeEnts.length; j++) {
            const sim = calculateSimilarity(
              nodeEnts[i].state.getData(),
              nodeEnts[j].state.getData()
            );
            nodeSimSum += sim;
            nodePairs++;
            withinSimSum += sim;
            withinPairs++;
          }
        }
        
        const avgNodeSim = nodePairs > 0 ? nodeSimSum / nodePairs : 0;
        if (avgNodeSim >= 0.1) {
          dialectCount++;
        }
      }
      
      // ノード間類似度（異なるノードのエンティティ間）
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const ents1 = nodeEntities.get(nodeIds[i])!;
          const ents2 = nodeEntities.get(nodeIds[j])!;
          
          // サンプリング（全ペアは多すぎる）
          const maxSamples = 10;
          const samples = Math.min(maxSamples, ents1.length * ents2.length);
          
          for (let s = 0; s < samples; s++) {
            const e1 = ents1[Math.floor(Math.random() * ents1.length)];
            const e2 = ents2[Math.floor(Math.random() * ents2.length)];
            const sim = calculateSimilarity(
              e1.state.getData(),
              e2.state.getData()
            );
            betweenSimSum += sim;
            betweenPairs++;
          }
        }
      }
      
      totalDialectCount += dialectCount;
      totalWithinSim += withinPairs > 0 ? withinSimSum / withinPairs : 0;
      totalBetweenSim += betweenPairs > 0 ? betweenSimSum / betweenPairs : 0;
      simSamples++;
    }
    
    const avgInteractionCount = totalInteractionCount / seeds.length;
    const avgInfoExchangeCount = totalInfoExchangeCount / seeds.length;
    const avgDialectCount = totalDialectCount / seeds.length;
    const avgWithinSim = totalWithinSim / simSamples;
    const avgBetweenSim = totalBetweenSim / simSamples;
    const avgPopulation = totalPopulation / seeds.length;
    
    console.log(`  平均interaction回数: ${avgInteractionCount.toFixed(0)}`);
    console.log(`  平均情報交換回数: ${avgInfoExchangeCount.toFixed(0)}`);
    console.log(`  平均方言圏数: ${avgDialectCount.toFixed(2)}`);
    console.log(`  平均ノード内類似度: ${avgWithinSim.toFixed(4)}`);
    console.log(`  平均ノード間類似度: ${avgBetweenSim.toFixed(4)}`);
    console.log(`  類似度比率: ${(avgWithinSim / (avgBetweenSim || 0.001)).toFixed(2)}x`);
    console.log(`  平均人口: ${avgPopulation.toFixed(1)}`);
    
    results.push({
      edgeDensity,
      avgInteractionCount,
      avgInfoExchangeCount,
      avgDialectCount,
      avgWithinNodeSimilarity: avgWithinSim,
      avgBetweenNodeSimilarity: avgBetweenSim,
      avgPopulation
    });
  }
  
  // 相関分析
  console.log('\n\n=== 相関分析 ===');
  
  const n = results.length;
  
  // エッジ密度 vs interaction回数
  const sumX = results.reduce((sum, r) => sum + r.edgeDensity, 0);
  const sumY_int = results.reduce((sum, r) => sum + r.avgInteractionCount, 0);
  const sumXY_int = results.reduce((sum, r) => sum + r.edgeDensity * r.avgInteractionCount, 0);
  const sumX2 = results.reduce((sum, r) => sum + r.edgeDensity * r.edgeDensity, 0);
  const sumY2_int = results.reduce((sum, r) => sum + r.avgInteractionCount * r.avgInteractionCount, 0);
  
  const corr_edge_int = (n * sumXY_int - sumX * sumY_int) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2_int - sumY_int * sumY_int));
  
  console.log(`\nエッジ密度 vs interaction回数: ${isNaN(corr_edge_int) ? 'N/A' : corr_edge_int.toFixed(4)}`);
  
  // エッジ密度 vs 方言圏数
  const sumY_dial = results.reduce((sum, r) => sum + r.avgDialectCount, 0);
  const sumXY_dial = results.reduce((sum, r) => sum + r.edgeDensity * r.avgDialectCount, 0);
  const sumY2_dial = results.reduce((sum, r) => sum + r.avgDialectCount * r.avgDialectCount, 0);
  
  const corr_edge_dial = (n * sumXY_dial - sumX * sumY_dial) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2_dial - sumY_dial * sumY_dial));
  
  console.log(`エッジ密度 vs 方言圏数: ${corr_edge_dial.toFixed(4)}`);
  
  // エッジ密度 vs ノード間類似度
  const sumY_between = results.reduce((sum, r) => sum + r.avgBetweenNodeSimilarity, 0);
  const sumXY_between = results.reduce((sum, r) => sum + r.edgeDensity * r.avgBetweenNodeSimilarity, 0);
  const sumY2_between = results.reduce((sum, r) => sum + r.avgBetweenNodeSimilarity * r.avgBetweenNodeSimilarity, 0);
  
  const corr_edge_between = (n * sumXY_between - sumX * sumY_between) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2_between - sumY_between * sumY_between));
  
  console.log(`エッジ密度 vs ノード間類似度: ${corr_edge_between.toFixed(4)}`);
  
  // interaction回数 vs ノード間類似度
  const sumXY_int_between = results.reduce((sum, r) => sum + r.avgInteractionCount * r.avgBetweenNodeSimilarity, 0);
  
  const corr_int_between = (n * sumXY_int_between - sumY_int * sumY_between) / 
    Math.sqrt((n * sumY2_int - sumY_int * sumY_int) * (n * sumY2_between - sumY_between * sumY_between));
  
  console.log(`interaction回数 vs ノード間類似度: ${isNaN(corr_int_between) ? 'N/A' : corr_int_between.toFixed(4)}`);
  
  // 結果テーブル
  console.log('\n\n=== 結果サマリー ===');
  console.log('| エッジ密度 | interaction | 方言圏数 | ノード内類似度 | ノード間類似度 | 比率 | 人口 |');
  console.log('|-----------|------------|---------|--------------|--------------|------|------|');
  for (const r of results) {
    const ratio = r.avgWithinNodeSimilarity / (r.avgBetweenNodeSimilarity || 0.001);
    console.log(`| ${r.edgeDensity.toFixed(1)} | ${r.avgInteractionCount.toFixed(0)} | ${r.avgDialectCount.toFixed(2)} | ${r.avgWithinNodeSimilarity.toFixed(4)} | ${r.avgBetweenNodeSimilarity.toFixed(4)} | ${ratio.toFixed(1)}x | ${r.avgPopulation.toFixed(1)} |`);
  }
  
  // 結論
  console.log('\n\n=== 結論 ===');
  
  const interactionVaries = Math.max(...results.map(r => r.avgInteractionCount)) - 
                            Math.min(...results.map(r => r.avgInteractionCount)) > 100;
  
  if (interactionVaries && Math.abs(corr_edge_int) > 0.5) {
    console.log('H88を支持: エッジ密度はinteraction回数に影響する');
    console.log(`  エッジ密度とinteraction回数の相関: ${corr_edge_int.toFixed(3)}`);
    
    if (Math.abs(corr_int_between) > 0.5) {
      console.log('  interaction回数がノード間類似度に影響（情報拡散効果）');
      console.log(`  interaction回数とノード間類似度の相関: ${corr_int_between.toFixed(3)}`);
    }
  } else if (!interactionVaries) {
    console.log('H88を検証不能: interaction回数がエッジ密度によって変化しない');
    console.log('  エッジ密度の効果は「情報拡散」以外のメカニズムによる可能性');
    
    // 代替仮説: 空間構造自体が方言圏に影響
    console.log('\n代替仮説: エッジ密度は「空間構造」を通じて方言圏に影響');
    console.log(`  エッジ密度と方言圏数の相関: ${corr_edge_dial.toFixed(3)}`);
    console.log(`  エッジ密度とノード間類似度の相関: ${corr_edge_between.toFixed(3)}`);
    
    if (corr_edge_between > 0.3) {
      console.log('  高エッジ密度 → ノード間類似度上昇 → 方言圏の境界が曖昧に');
    }
  } else {
    console.log('H88を棄却: エッジ密度とinteraction回数に有意な相関がない');
    console.log(`  相関係数: ${corr_edge_int.toFixed(3)}`);
  }
}

runVerification().catch(console.error);
