/**
 * H81検証: 方言圏の形成は「親子ペアの空間的集中」によって起きる
 * 
 * 検証方法:
 * 1. 複数のスナップショットで方言圏を特定
 * 2. 方言圏内のエンティティの親子関係を分析
 * 3. 方言圏内の親子ペア率と非方言圏の親子ペア率を比較
 */

import { Universe } from '../src/core/universe';

interface DialectSnapshot {
  tick: number;
  nodeId: string;
  entities: string[];
  similarity: number;
  parentChildPairs: number;
  totalPairs: number;
  isDialect: boolean;
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
  const seeds = [42, 123, 456, 789, 1000, 2000, 3000, 4000];
  const ticks = 5000;
  const snapshotInterval = 500;
  
  console.log('=== H81検証: 方言圏の形成は「親子ペアの空間的集中」によって起きる ===\n');
  
  let totalDialectSnapshots = 0;
  let totalNonDialectSnapshots = 0;
  let totalDialectParentChildPairs = 0;
  let totalDialectPairs = 0;
  let totalNonDialectParentChildPairs = 0;
  let totalNonDialectPairs = 0;
  
  for (const seed of seeds) {
    console.log(`\n--- Seed ${seed} ---`);
    
    const universe = new Universe({
      seed,
      worldGen: {
        nodeCount: 25,
        edgeDensity: 0.25,
        initialEntityCount: 80
      },
      resourceRegenerationRate: 0.018
    });
    
    // 親子関係を追跡
    const parentMap = new Map<string, string>();
    
    // 初期エンティティを登録
    for (const entity of universe.getAllEntities()) {
      // 初期エンティティは親なし
    }
    
    let seedDialectSnapshots = 0;
    let seedNonDialectSnapshots = 0;
    let seedDialectParentChildPairs = 0;
    let seedDialectPairs = 0;
    let seedNonDialectParentChildPairs = 0;
    let seedNonDialectPairs = 0;
    
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
            parentMap.set(childId, parentId);
          }
        }
      }
      universe.clearEventLog();
      
      // スナップショット
      if ((t + 1) % snapshotInterval === 0) {
        const entities = universe.getAllEntities();
        
        // ノードごとにエンティティをグループ化
        const nodeEntities = new Map<string, typeof entities>();
        for (const entity of entities) {
          const nodeId = entity.nodeId;
          if (!nodeEntities.has(nodeId)) {
            nodeEntities.set(nodeId, []);
          }
          nodeEntities.get(nodeId)!.push(entity);
        }
        
        // 各ノードの分析
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
          
          // 親子ペアをカウント
          let parentChildPairs = 0;
          for (let i = 0; i < nodeEnts.length; i++) {
            for (let j = i + 1; j < nodeEnts.length; j++) {
              const id1 = nodeEnts[i].id;
              const id2 = nodeEnts[j].id;
              if (parentMap.get(id1) === id2 || parentMap.get(id2) === id1) {
                parentChildPairs++;
              }
            }
          }
          
          const isDialect = avgSimilarity >= 0.1;
          
          if (isDialect) {
            seedDialectSnapshots++;
            seedDialectParentChildPairs += parentChildPairs;
            seedDialectPairs += pairCount;
          } else {
            seedNonDialectSnapshots++;
            seedNonDialectParentChildPairs += parentChildPairs;
            seedNonDialectPairs += pairCount;
          }
        }
      }
    }
    
    const dialectRate = seedDialectPairs > 0 ? seedDialectParentChildPairs / seedDialectPairs : 0;
    const nonDialectRate = seedNonDialectPairs > 0 ? seedNonDialectParentChildPairs / seedNonDialectPairs : 0;
    
    console.log(`方言圏スナップショット: ${seedDialectSnapshots}`);
    console.log(`非方言圏スナップショット: ${seedNonDialectSnapshots}`);
    console.log(`方言圏の親子ペア率: ${(dialectRate * 100).toFixed(1)}% (${seedDialectParentChildPairs}/${seedDialectPairs})`);
    console.log(`非方言圏の親子ペア率: ${(nonDialectRate * 100).toFixed(1)}% (${seedNonDialectParentChildPairs}/${seedNonDialectPairs})`);
    
    totalDialectSnapshots += seedDialectSnapshots;
    totalNonDialectSnapshots += seedNonDialectSnapshots;
    totalDialectParentChildPairs += seedDialectParentChildPairs;
    totalDialectPairs += seedDialectPairs;
    totalNonDialectParentChildPairs += seedNonDialectParentChildPairs;
    totalNonDialectPairs += seedNonDialectPairs;
  }
  
  // 全体集計
  console.log('\n\n=== 全体集計 ===');
  
  const overallDialectRate = totalDialectPairs > 0 ? totalDialectParentChildPairs / totalDialectPairs : 0;
  const overallNonDialectRate = totalNonDialectPairs > 0 ? totalNonDialectParentChildPairs / totalNonDialectPairs : 0;
  
  console.log(`\n総方言圏スナップショット: ${totalDialectSnapshots}`);
  console.log(`総非方言圏スナップショット: ${totalNonDialectSnapshots}`);
  console.log(`\n親子ペア率:`);
  console.log(`  方言圏: ${(overallDialectRate * 100).toFixed(1)}% (${totalDialectParentChildPairs}/${totalDialectPairs})`);
  console.log(`  非方言圏: ${(overallNonDialectRate * 100).toFixed(1)}% (${totalNonDialectParentChildPairs}/${totalNonDialectPairs})`);
  console.log(`  比率: ${overallNonDialectRate > 0 ? (overallDialectRate / overallNonDialectRate).toFixed(2) : 'N/A'}x`);
  
  // 結論
  console.log('\n\n=== 結論 ===');
  if (overallDialectRate > overallNonDialectRate * 1.5) {
    console.log('H81を支持: 方言圏は親子ペアの空間的集中によって形成される');
    console.log(`  方言圏の親子ペア率(${(overallDialectRate * 100).toFixed(1)}%)は非方言圏(${(overallNonDialectRate * 100).toFixed(1)}%)より高い`);
  } else if (overallDialectRate > overallNonDialectRate) {
    console.log('H81を部分的に支持: 方言圏は親子ペアの集中傾向があるが、差は小さい');
    console.log(`  方言圏: ${(overallDialectRate * 100).toFixed(1)}%, 非方言圏: ${(overallNonDialectRate * 100).toFixed(1)}%`);
  } else {
    console.log('H81を棄却: 方言圏と非方言圏で親子ペア率に有意な差がない');
    console.log(`  方言圏: ${(overallDialectRate * 100).toFixed(1)}%, 非方言圏: ${(overallNonDialectRate * 100).toFixed(1)}%`);
  }
}

runVerification().catch(console.error);
