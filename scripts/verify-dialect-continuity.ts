/**
 * H83検証: 方言圏の維持には「継続的な親子ペアの存在」が必要
 * 
 * 検証方法:
 * 1. 方言圏の持続/消滅を追跡
 * 2. 持続した方言圏と消滅した方言圏で親子ペアの継続性を比較
 * 3. 親子ペアが解消されると方言圏が消滅するかを検証
 */

import { Universe } from '../src/core/universe';

interface DialectState {
  nodeId: string;
  similarity: number;
  entityCount: number;
  parentChildPairs: number;
  totalPairs: number;
  hasParentChild: boolean;
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
  const snapshotInterval = 250;
  
  console.log('=== H83検証: 方言圏の維持には「継続的な親子ペアの存在」が必要 ===\n');
  
  // 方言圏の遷移を追跡
  let totalTransitions = 0;
  let dialectToDialect_withPC = 0; // 親子ペアあり→方言圏維持
  let dialectToDialect_noPC = 0;   // 親子ペアなし→方言圏維持
  let dialectToNon_withPC = 0;     // 親子ペアあり→方言圏消滅
  let dialectToNon_noPC = 0;       // 親子ペアなし→方言圏消滅
  
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
    
    // 前回のスナップショット
    let prevDialectStates = new Map<string, DialectState>();
    
    let seedTransitions = 0;
    let seedDialectToDialect_withPC = 0;
    let seedDialectToDialect_noPC = 0;
    let seedDialectToNon_withPC = 0;
    let seedDialectToNon_noPC = 0;
    
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
        
        // 現在の方言圏状態を計算
        const currentDialectStates = new Map<string, DialectState>();
        
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
          
          currentDialectStates.set(nodeId, {
            nodeId,
            similarity: avgSimilarity,
            entityCount: nodeEnts.length,
            parentChildPairs,
            totalPairs: pairCount,
            hasParentChild: parentChildPairs > 0
          });
        }
        
        // 遷移を分析（前回方言圏だったノードについて）
        for (const [nodeId, prevState] of prevDialectStates) {
          if (prevState.similarity < 0.1) continue; // 前回方言圏でなければスキップ
          
          const currentState = currentDialectStates.get(nodeId);
          const isStillDialect = currentState && currentState.similarity >= 0.1;
          const hadParentChild = prevState.hasParentChild;
          
          seedTransitions++;
          
          if (isStillDialect) {
            if (hadParentChild) {
              seedDialectToDialect_withPC++;
            } else {
              seedDialectToDialect_noPC++;
            }
          } else {
            if (hadParentChild) {
              seedDialectToNon_withPC++;
            } else {
              seedDialectToNon_noPC++;
            }
          }
        }
        
        prevDialectStates = currentDialectStates;
      }
    }
    
    const maintainRate_withPC = (seedDialectToDialect_withPC + seedDialectToNon_withPC) > 0
      ? seedDialectToDialect_withPC / (seedDialectToDialect_withPC + seedDialectToNon_withPC)
      : 0;
    const maintainRate_noPC = (seedDialectToDialect_noPC + seedDialectToNon_noPC) > 0
      ? seedDialectToDialect_noPC / (seedDialectToDialect_noPC + seedDialectToNon_noPC)
      : 0;
    
    console.log(`遷移数: ${seedTransitions}`);
    console.log(`親子ペアあり: 維持${seedDialectToDialect_withPC}, 消滅${seedDialectToNon_withPC} (維持率${(maintainRate_withPC * 100).toFixed(1)}%)`);
    console.log(`親子ペアなし: 維持${seedDialectToDialect_noPC}, 消滅${seedDialectToNon_noPC} (維持率${(maintainRate_noPC * 100).toFixed(1)}%)`);
    
    totalTransitions += seedTransitions;
    dialectToDialect_withPC += seedDialectToDialect_withPC;
    dialectToDialect_noPC += seedDialectToDialect_noPC;
    dialectToNon_withPC += seedDialectToNon_withPC;
    dialectToNon_noPC += seedDialectToNon_noPC;
  }
  
  // 全体集計
  console.log('\n\n=== 全体集計 ===');
  
  const overallMaintainRate_withPC = (dialectToDialect_withPC + dialectToNon_withPC) > 0
    ? dialectToDialect_withPC / (dialectToDialect_withPC + dialectToNon_withPC)
    : 0;
  const overallMaintainRate_noPC = (dialectToDialect_noPC + dialectToNon_noPC) > 0
    ? dialectToDialect_noPC / (dialectToDialect_noPC + dialectToNon_noPC)
    : 0;
  
  console.log(`\n総遷移数: ${totalTransitions}`);
  console.log(`\n親子ペアあり:`);
  console.log(`  維持: ${dialectToDialect_withPC}`);
  console.log(`  消滅: ${dialectToNon_withPC}`);
  console.log(`  維持率: ${(overallMaintainRate_withPC * 100).toFixed(1)}%`);
  console.log(`\n親子ペアなし:`);
  console.log(`  維持: ${dialectToDialect_noPC}`);
  console.log(`  消滅: ${dialectToNon_noPC}`);
  console.log(`  維持率: ${(overallMaintainRate_noPC * 100).toFixed(1)}%`);
  console.log(`\n維持率の比: ${overallMaintainRate_noPC > 0 ? (overallMaintainRate_withPC / overallMaintainRate_noPC).toFixed(2) : 'N/A'}x`);
  
  // 結論
  console.log('\n\n=== 結論 ===');
  if (overallMaintainRate_withPC > overallMaintainRate_noPC * 1.5) {
    console.log('H83を支持: 方言圏の維持には継続的な親子ペアの存在が必要');
    console.log(`  親子ペアあり維持率(${(overallMaintainRate_withPC * 100).toFixed(1)}%)は親子ペアなし(${(overallMaintainRate_noPC * 100).toFixed(1)}%)より高い`);
  } else if (overallMaintainRate_withPC > overallMaintainRate_noPC) {
    console.log('H83を部分的に支持: 親子ペアは方言圏維持に寄与するが、差は小さい');
  } else {
    console.log('H83を棄却: 親子ペアの有無と方言圏維持に有意な関係がない');
  }
}

runVerification().catch(console.error);
