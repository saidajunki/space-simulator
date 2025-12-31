/**
 * H67検証: 空間的近接性とState類似度の関係
 * 
 * 仮説: 同一ノードに長く滞在するエンティティは、State類似度が高くなる傾向がある
 * 
 * 検証方法:
 * 1. 各ノードのエンティティのState類似度を計算
 * 2. ノード内平均類似度とノード間平均類似度を比較
 * 3. 「方言圏」の形成を観察
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface NodeStateInfo {
  nodeId: string;
  entityCount: number;
  avgIntraNodeSimilarity: number;  // ノード内類似度
  statePatterns: string[];  // ユニークなStateパターン
}

interface SimulationResult {
  seed: number;
  population: number;
  occupiedNodes: number;
  avgIntraNodeSimilarity: number;  // ノード内平均類似度
  avgInterNodeSimilarity: number;  // ノード間平均類似度
  similarityRatio: number;  // intra/inter比
  dialectRegions: number;  // 「方言圏」の数（類似度が高いノード群）
  nodeDetails: NodeStateInfo[];
}

// ハミング類似度
function calculateHammingSimilarity(state1: Uint8Array, state2: Uint8Array): number {
  if (state1.length === 0 || state2.length === 0) return 0;
  
  const minLen = Math.min(state1.length, state2.length);
  let matches = 0;
  
  for (let i = 0; i < minLen; i++) {
    if (state1[i] === state2[i]) matches++;
  }
  
  return matches / minLen;
}

async function runSimulation(seed: number): Promise<SimulationResult> {
  const config: UniverseConfig = {
    seed,
    nodeCount: 20,
    edgeDensity: 0.3,
    initialEntityCount: 50,
    resourceRegenerationRate: 0.020,
    maxTicks: 5000,
    logFrequency: 100,
  };

  const universe = new Universe(config);
  
  // シミュレーション実行
  for (let tick = 0; tick < config.maxTicks; tick++) {
    universe.step();
    universe.clearEventLog();
  }
  
  // 最終状態の取得
  const entities = universe.getAllEntities();
  const population = entities.length;
  
  // ノードごとにエンティティをグループ化
  const nodeEntities = new Map<string, { id: string; state: Uint8Array }[]>();
  for (const entity of entities) {
    const stateData = entity.state.getData();
    if (stateData.length === 0) continue;
    
    if (!nodeEntities.has(entity.nodeId)) {
      nodeEntities.set(entity.nodeId, []);
    }
    nodeEntities.get(entity.nodeId)!.push({
      id: entity.id,
      state: new Uint8Array(stateData),
    });
  }
  
  const occupiedNodes = nodeEntities.size;
  
  // ノード内類似度の計算
  const nodeDetails: NodeStateInfo[] = [];
  let totalIntraSimilarity = 0;
  let intraPairCount = 0;
  
  for (const [nodeId, nodeEnts] of nodeEntities) {
    if (nodeEnts.length < 2) {
      nodeDetails.push({
        nodeId,
        entityCount: nodeEnts.length,
        avgIntraNodeSimilarity: 0,
        statePatterns: nodeEnts.map(e => Array.from(e.state.slice(0, 4)).join(',')),
      });
      continue;
    }
    
    let nodeSimilaritySum = 0;
    let nodePairCount = 0;
    
    for (let i = 0; i < nodeEnts.length; i++) {
      for (let j = i + 1; j < nodeEnts.length; j++) {
        const sim = calculateHammingSimilarity(nodeEnts[i].state, nodeEnts[j].state);
        nodeSimilaritySum += sim;
        nodePairCount++;
        totalIntraSimilarity += sim;
        intraPairCount++;
      }
    }
    
    const avgSim = nodePairCount > 0 ? nodeSimilaritySum / nodePairCount : 0;
    
    // ユニークなStateパターン（最初の4バイト）
    const patterns = new Set<string>();
    for (const e of nodeEnts) {
      patterns.add(Array.from(e.state.slice(0, 4)).join(','));
    }
    
    nodeDetails.push({
      nodeId,
      entityCount: nodeEnts.length,
      avgIntraNodeSimilarity: avgSim,
      statePatterns: Array.from(patterns),
    });
  }
  
  const avgIntraNodeSimilarity = intraPairCount > 0 ? totalIntraSimilarity / intraPairCount : 0;
  
  // ノード間類似度の計算（異なるノードのエンティティ間）
  let totalInterSimilarity = 0;
  let interPairCount = 0;
  
  const nodeIds = Array.from(nodeEntities.keys());
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const ents1 = nodeEntities.get(nodeIds[i])!;
      const ents2 = nodeEntities.get(nodeIds[j])!;
      
      // サンプリング（最大100ペア）
      const maxPairs = Math.min(100, ents1.length * ents2.length);
      for (let k = 0; k < maxPairs; k++) {
        const e1 = ents1[Math.floor(Math.random() * ents1.length)];
        const e2 = ents2[Math.floor(Math.random() * ents2.length)];
        const sim = calculateHammingSimilarity(e1.state, e2.state);
        totalInterSimilarity += sim;
        interPairCount++;
      }
    }
  }
  
  const avgInterNodeSimilarity = interPairCount > 0 ? totalInterSimilarity / interPairCount : 0;
  
  // 「方言圏」の検出（ノード内類似度が0.1以上のノード）
  const dialectRegions = nodeDetails.filter(n => n.avgIntraNodeSimilarity >= 0.1).length;
  
  return {
    seed,
    population,
    occupiedNodes,
    avgIntraNodeSimilarity,
    avgInterNodeSimilarity,
    similarityRatio: avgInterNodeSimilarity > 0 ? avgIntraNodeSimilarity / avgInterNodeSimilarity : 0,
    dialectRegions,
    nodeDetails,
  };
}

async function main() {
  console.log('=== H67検証: 空間的近接性とState類似度 ===\n');
  console.log('仮説: 同一ノードのエンティティはStateが類似している傾向があるか？\n');
  
  const seeds = [42, 123, 456, 789, 1000];
  const results: SimulationResult[] = [];
  
  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const result = await runSimulation(seed);
    results.push(result);
    
    console.log(`  人口: ${result.population}, 占有ノード: ${result.occupiedNodes}`);
    console.log(`  ノード内類似度: ${result.avgIntraNodeSimilarity.toFixed(4)}`);
    console.log(`  ノード間類似度: ${result.avgInterNodeSimilarity.toFixed(4)}`);
    console.log(`  類似度比（intra/inter）: ${result.similarityRatio.toFixed(2)}x`);
    console.log(`  方言圏（類似度≥0.1）: ${result.dialectRegions}ノード\n`);
  }
  
  // 集計
  console.log('=== 集計結果 ===\n');
  
  const avgIntra = results.reduce((sum, r) => sum + r.avgIntraNodeSimilarity, 0) / results.length;
  const avgInter = results.reduce((sum, r) => sum + r.avgInterNodeSimilarity, 0) / results.length;
  const avgRatio = results.reduce((sum, r) => sum + r.similarityRatio, 0) / results.length;
  const totalDialects = results.reduce((sum, r) => sum + r.dialectRegions, 0);
  
  console.log(`平均ノード内類似度: ${avgIntra.toFixed(4)}`);
  console.log(`平均ノード間類似度: ${avgInter.toFixed(4)}`);
  console.log(`平均類似度比: ${avgRatio.toFixed(2)}x`);
  console.log(`総方言圏数: ${totalDialects}`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  const positiveRatioCount = results.filter(r => r.similarityRatio > 1.0).length;
  
  if (avgRatio > 2.0) {
    console.log('H67を強く支持: ノード内類似度がノード間類似度の2倍以上');
    console.log('→ 空間的近接性がState類似度を高めている');
    console.log('→ 「方言圏」の形成が観察される');
  } else if (avgRatio > 1.2) {
    console.log('H67を支持: ノード内類似度がノード間類似度より高い');
    console.log(`→ ${positiveRatioCount}/${results.length} のseedで比率>1.0`);
  } else if (avgRatio > 0.8) {
    console.log('H67は不明確: ノード内とノード間の類似度に有意な差がない');
  } else {
    console.log('H67を棄却: ノード間類似度の方が高い');
  }
  
  // 方言圏の詳細
  console.log('\n=== 方言圏の詳細 ===\n');
  for (const result of results) {
    const highSimNodes = result.nodeDetails
      .filter(n => n.avgIntraNodeSimilarity >= 0.1 && n.entityCount >= 2)
      .sort((a, b) => b.avgIntraNodeSimilarity - a.avgIntraNodeSimilarity);
    
    if (highSimNodes.length > 0) {
      console.log(`Seed ${result.seed}:`);
      for (const node of highSimNodes.slice(0, 3)) {
        console.log(`  ${node.nodeId}: ${node.entityCount}体, 類似度${node.avgIntraNodeSimilarity.toFixed(3)}, パターン数${node.statePatterns.length}`);
      }
    }
  }
}

main().catch(console.error);
