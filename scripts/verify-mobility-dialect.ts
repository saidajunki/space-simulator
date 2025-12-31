/**
 * H69検証: 移動頻度が高いと方言圏は収束するか
 * 
 * 仮説: 移動が活発な環境では、ノード間で情報が混ざり、方言圏の分化が抑制される
 * 
 * 検証方法:
 * 1. 移動コストを変えてシミュレーションを実行
 * 2. 移動頻度と方言圏分化の関係を観察
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface SimulationResult {
  seed: number;
  moveCost: number;
  moveCount: number;
  population: number;
  avgIntraNodeSimilarity: number;
  avgInterNodeSimilarity: number;
  similarityRatio: number;
  dialectRegions: number;
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

function calculateSimilarities(universe: Universe): { intra: number; inter: number; dialects: number } {
  const entities = universe.getAllEntities();
  
  const nodeEntities = new Map<string, Uint8Array[]>();
  for (const entity of entities) {
    const stateData = entity.state.getData();
    if (stateData.length === 0) continue;
    
    if (!nodeEntities.has(entity.nodeId)) {
      nodeEntities.set(entity.nodeId, []);
    }
    nodeEntities.get(entity.nodeId)!.push(new Uint8Array(stateData));
  }
  
  // ノード内類似度
  let totalIntraSimilarity = 0;
  let intraPairCount = 0;
  let dialectCount = 0;
  
  for (const [, states] of nodeEntities) {
    if (states.length < 2) continue;
    
    let nodeSim = 0;
    let nodePairs = 0;
    
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const sim = calculateHammingSimilarity(states[i], states[j]);
        nodeSim += sim;
        nodePairs++;
        totalIntraSimilarity += sim;
        intraPairCount++;
      }
    }
    
    if (nodePairs > 0 && nodeSim / nodePairs >= 0.1) {
      dialectCount++;
    }
  }
  
  const avgIntra = intraPairCount > 0 ? totalIntraSimilarity / intraPairCount : 0;
  
  // ノード間類似度
  let totalInterSimilarity = 0;
  let interPairCount = 0;
  
  const nodeIds = Array.from(nodeEntities.keys());
  for (let i = 0; i < nodeIds.length && interPairCount < 500; i++) {
    for (let j = i + 1; j < nodeIds.length && interPairCount < 500; j++) {
      const states1 = nodeEntities.get(nodeIds[i])!;
      const states2 = nodeEntities.get(nodeIds[j])!;
      
      const s1 = states1[Math.floor(Math.random() * states1.length)];
      const s2 = states2[Math.floor(Math.random() * states2.length)];
      totalInterSimilarity += calculateHammingSimilarity(s1, s2);
      interPairCount++;
    }
  }
  
  const avgInter = interPairCount > 0 ? totalInterSimilarity / interPairCount : 0;
  
  return { intra: avgIntra, inter: avgInter, dialects: dialectCount };
}

async function runSimulation(seed: number, moveCostMultiplier: number): Promise<SimulationResult> {
  // 移動コストを調整するために、エッジ密度を変える
  // 高いエッジ密度 = 移動しやすい = 移動頻度が高い
  const edgeDensity = moveCostMultiplier < 1 ? 0.5 : (moveCostMultiplier > 1 ? 0.15 : 0.3);
  
  const config: UniverseConfig = {
    seed,
    nodeCount: 20,
    edgeDensity,
    initialEntityCount: 50,
    resourceRegenerationRate: 0.020,
    maxTicks: 5000,
    logFrequency: 100,
  };

  const universe = new Universe(config);
  let moveCount = 0;
  
  for (let tick = 0; tick < config.maxTicks; tick++) {
    universe.step();
    
    // 移動イベントをカウント
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'entityMoved') {
        moveCount++;
      }
    }
    
    universe.clearEventLog();
  }
  
  const entities = universe.getAllEntities();
  const population = entities.length;
  
  const { intra, inter, dialects } = calculateSimilarities(universe);
  
  return {
    seed,
    moveCost: moveCostMultiplier,
    moveCount,
    population,
    avgIntraNodeSimilarity: intra,
    avgInterNodeSimilarity: inter,
    similarityRatio: inter > 0 ? intra / inter : 0,
    dialectRegions: dialects,
  };
}

async function main() {
  console.log('=== H69検証: 移動頻度と方言圏の関係 ===\n');
  console.log('仮説: 移動頻度が高いと方言圏は収束する\n');
  
  const seeds = [42, 123, 456];
  const moveCostMultipliers = [0.5, 1.0, 2.0];  // 低コスト（高移動）、標準、高コスト（低移動）
  
  const results: SimulationResult[] = [];
  
  for (const multiplier of moveCostMultipliers) {
    console.log(`移動コスト倍率 ${multiplier}x を実行中...`);
    
    for (const seed of seeds) {
      const result = await runSimulation(seed, multiplier);
      results.push(result);
      console.log(`  Seed ${seed}: 移動${result.moveCount}回, 比率${result.similarityRatio.toFixed(1)}x, 方言圏${result.dialectRegions}`);
    }
    console.log();
  }
  
  // 移動コスト別の集計
  console.log('=== 移動コスト別集計 ===\n');
  console.log('コスト\t| 移動回数\t| 比率\t| 方言圏');
  console.log('--------|-----------|-------|--------');
  
  for (const multiplier of moveCostMultipliers) {
    const groupResults = results.filter(r => r.moveCost === multiplier);
    const avgMoves = groupResults.reduce((sum, r) => sum + r.moveCount, 0) / groupResults.length;
    const avgRatio = groupResults.reduce((sum, r) => sum + r.similarityRatio, 0) / groupResults.length;
    const avgDialects = groupResults.reduce((sum, r) => sum + r.dialectRegions, 0) / groupResults.length;
    
    console.log(`${multiplier}x\t| ${avgMoves.toFixed(0)}\t\t| ${avgRatio.toFixed(1)}x\t| ${avgDialects.toFixed(1)}`);
  }
  
  // 相関分析
  console.log('\n=== 相関分析 ===\n');
  
  const moves = results.map(r => r.moveCount);
  const ratios = results.map(r => r.similarityRatio);
  const dialects = results.map(r => r.dialectRegions);
  
  // 移動回数と比率の相関
  const moveRatioCorr = calculateCorrelation(moves, ratios);
  const moveDialectCorr = calculateCorrelation(moves, dialects);
  
  console.log(`移動回数 vs 類似度比率: ${moveRatioCorr.toFixed(3)}`);
  console.log(`移動回数 vs 方言圏数: ${moveDialectCorr.toFixed(3)}`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  if (moveRatioCorr < -0.3) {
    console.log('H69を支持: 移動頻度が高いと方言圏は収束する');
    console.log(`→ 移動回数と類似度比率に負の相関（${moveRatioCorr.toFixed(3)}）`);
  } else if (moveRatioCorr > 0.3) {
    console.log('H69を棄却: 移動頻度が高いと方言圏は分化する');
    console.log(`→ 移動回数と類似度比率に正の相関（${moveRatioCorr.toFixed(3)}）`);
  } else {
    console.log('H69は不明確: 移動頻度と方言圏に明確な関係がない');
    console.log(`→ 相関係数: ${moveRatioCorr.toFixed(3)}`);
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

main().catch(console.error);
