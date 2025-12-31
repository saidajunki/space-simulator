/**
 * H85検証: 方言圏の維持には「継続的な親子ペアの生成」が必要
 * 
 * H83の検証で親子ペアがあっても92.6%は消滅することが判明。
 * 方言圏の維持には継続的な親子ペアの生成が必要という仮説を検証。
 * 
 * 検証方法:
 * 1. 方言圏の維持/消滅を追跡
 * 2. 維持された方言圏での複製イベント（親子ペア生成）を計測
 * 3. 消滅した方言圏での複製イベントを計測
 * 4. 複製頻度と方言圏維持の関係を分析
 */

import { Universe } from '../src/core/universe';

interface DialectSnapshot {
  tick: number;
  nodeId: string;
  isDialect: boolean;
  population: number;
  similarity: number;
  replicationsSinceLastSnapshot: number;
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
  
  console.log('=== H85検証: 方言圏の維持には「継続的な親子ペアの生成」が必要 ===\n');
  
  // 維持された方言圏と消滅した方言圏の複製頻度を比較
  let maintainedDialects: { replications: number; duration: number }[] = [];
  let lostDialects: { replications: number; duration: number }[] = [];
  
  for (const seed of seeds) {
    console.log(`\n--- Seed: ${seed} ---`);
    
    const universe = new Universe({
      seed,
      worldGen: {
        nodeCount: 25,
        edgeDensity: 0.3,
        initialEntityCount: 80
      },
      resourceRegenerationRate: 0.018
    });
    
    // ノードごとの複製イベントを追跡
    const nodeReplications = new Map<string, number>();
    
    // 前回のスナップショット
    let prevDialectNodes = new Map<string, { tick: number; replications: number }>();
    
    // シミュレーション実行
    for (let t = 0; t < ticks; t++) {
      universe.step();
      
      // 複製イベントをノードごとにカウント
      const events = universe.getEventLog();
      for (const event of events) {
        if (event.type === 'replication') {
          // 複製が発生したノードを特定（親のノード）
          const parentId = (event as any).parentId;
          const entities = universe.getAllEntities();
          const parent = entities.find(e => e.id === parentId);
          if (parent) {
            const nodeId = parent.nodeId;
            nodeReplications.set(nodeId, (nodeReplications.get(nodeId) || 0) + 1);
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
        
        // 現在の方言圏ノードを特定
        const currentDialectNodes = new Map<string, { tick: number; replications: number }>();
        
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
            const replications = nodeReplications.get(nodeId) || 0;
            currentDialectNodes.set(nodeId, { tick: t + 1, replications });
          }
        }
        
        // 前回の方言圏との比較
        for (const [nodeId, prevData] of prevDialectNodes) {
          const duration = (t + 1) - prevData.tick + snapshotInterval;
          const currentReplications = nodeReplications.get(nodeId) || 0;
          const replicationsDuringPeriod = currentReplications - prevData.replications;
          
          if (currentDialectNodes.has(nodeId)) {
            // 維持された
            maintainedDialects.push({
              replications: replicationsDuringPeriod,
              duration: snapshotInterval
            });
          } else {
            // 消滅した
            lostDialects.push({
              replications: replicationsDuringPeriod,
              duration: snapshotInterval
            });
          }
        }
        
        // 次のスナップショット用に更新
        prevDialectNodes = new Map();
        for (const [nodeId, data] of currentDialectNodes) {
          prevDialectNodes.set(nodeId, {
            tick: t + 1,
            replications: nodeReplications.get(nodeId) || 0
          });
        }
      }
    }
    
    console.log(`  維持された方言圏: ${maintainedDialects.length}`);
    console.log(`  消滅した方言圏: ${lostDialects.length}`);
  }
  
  // 分析
  console.log('\n\n=== 分析結果 ===');
  
  const avgMaintainedReplications = maintainedDialects.length > 0
    ? maintainedDialects.reduce((sum, d) => sum + d.replications, 0) / maintainedDialects.length
    : 0;
  
  const avgLostReplications = lostDialects.length > 0
    ? lostDialects.reduce((sum, d) => sum + d.replications, 0) / lostDialects.length
    : 0;
  
  console.log(`\n維持された方言圏の平均複製数: ${avgMaintainedReplications.toFixed(2)}`);
  console.log(`消滅した方言圏の平均複製数: ${avgLostReplications.toFixed(2)}`);
  
  // 複製があった場合の維持率
  const maintainedWithReplications = maintainedDialects.filter(d => d.replications > 0).length;
  const lostWithReplications = lostDialects.filter(d => d.replications > 0).length;
  const maintainedWithoutReplications = maintainedDialects.filter(d => d.replications === 0).length;
  const lostWithoutReplications = lostDialects.filter(d => d.replications === 0).length;
  
  const totalWithReplications = maintainedWithReplications + lostWithReplications;
  const totalWithoutReplications = maintainedWithoutReplications + lostWithoutReplications;
  
  const maintainRateWithReplications = totalWithReplications > 0
    ? maintainedWithReplications / totalWithReplications
    : 0;
  
  const maintainRateWithoutReplications = totalWithoutReplications > 0
    ? maintainedWithoutReplications / totalWithoutReplications
    : 0;
  
  console.log(`\n複製あり: 維持率 ${(maintainRateWithReplications * 100).toFixed(1)}% (${maintainedWithReplications}/${totalWithReplications})`);
  console.log(`複製なし: 維持率 ${(maintainRateWithoutReplications * 100).toFixed(1)}% (${maintainedWithoutReplications}/${totalWithoutReplications})`);
  
  // 複製数別の維持率
  console.log('\n複製数別の維持率:');
  const replicationBuckets = [0, 1, 2, 3, 5, 10];
  for (let i = 0; i < replicationBuckets.length; i++) {
    const min = replicationBuckets[i];
    const max = i < replicationBuckets.length - 1 ? replicationBuckets[i + 1] - 1 : Infinity;
    
    const maintained = maintainedDialects.filter(d => d.replications >= min && d.replications <= max).length;
    const lost = lostDialects.filter(d => d.replications >= min && d.replications <= max).length;
    const total = maintained + lost;
    const rate = total > 0 ? maintained / total : 0;
    
    const label = max === Infinity ? `${min}+` : min === max ? `${min}` : `${min}-${max}`;
    console.log(`  複製数${label}: 維持率 ${(rate * 100).toFixed(1)}% (${maintained}/${total})`);
  }
  
  // 結論
  console.log('\n\n=== 結論 ===');
  
  const replicationDiff = avgMaintainedReplications - avgLostReplications;
  const rateDiff = maintainRateWithReplications - maintainRateWithoutReplications;
  
  if (rateDiff > 0.1 || replicationDiff > 0.5) {
    console.log('H85を支持: 継続的な親子ペアの生成が方言圏維持に寄与');
    console.log(`  複製ありの維持率: ${(maintainRateWithReplications * 100).toFixed(1)}%`);
    console.log(`  複製なしの維持率: ${(maintainRateWithoutReplications * 100).toFixed(1)}%`);
    console.log(`  維持率の差: ${(rateDiff * 100).toFixed(1)}%`);
    console.log(`  維持された方言圏の平均複製数: ${avgMaintainedReplications.toFixed(2)}`);
    console.log(`  消滅した方言圏の平均複製数: ${avgLostReplications.toFixed(2)}`);
  } else {
    console.log('H85を棄却: 継続的な親子ペアの生成は方言圏維持に有意な影響がない');
    console.log(`  複製ありの維持率: ${(maintainRateWithReplications * 100).toFixed(1)}%`);
    console.log(`  複製なしの維持率: ${(maintainRateWithoutReplications * 100).toFixed(1)}%`);
    console.log(`  維持率の差: ${(rateDiff * 100).toFixed(1)}%`);
  }
}

runVerification().catch(console.error);
