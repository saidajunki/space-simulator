/**
 * H70検証: 人口増加は新しい方言圏を生むか
 * 
 * 仮説: 人口が増えると新しいノードが占有され、新しい「方言圏」が形成される
 * 
 * 検証方法:
 * 1. 初期人口を変えてシミュレーションを実行
 * 2. 人口と方言圏数の関係を観察
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface SimulationResult {
  seed: number;
  initialPopulation: number;
  finalPopulation: number;
  occupiedNodes: number;
  dialectRegions: number;
  avgIntraNodeSimilarity: number;
  avgInterNodeSimilarity: number;
  similarityRatio: number;
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

function calculateSimilarities(universe: Universe): { intra: number; inter: number; dialects: number; occupied: number } {
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
  
  const occupied = nodeEntities.size;
  
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
  
  return { intra: avgIntra, inter: avgInter, dialects: dialectCount, occupied };
}

async function runSimulation(seed: number, initialPopulation: number): Promise<SimulationResult> {
  const config: UniverseConfig = {
    seed,
    nodeCount: 30,
    edgeDensity: 0.3,
    initialEntityCount: initialPopulation,
    resourceRegenerationRate: 0.020,
    maxTicks: 5000,
    logFrequency: 100,
  };

  const universe = new Universe(config);
  
  for (let tick = 0; tick < config.maxTicks; tick++) {
    universe.step();
    universe.clearEventLog();
  }
  
  const entities = universe.getAllEntities();
  const finalPopulation = entities.length;
  
  const { intra, inter, dialects, occupied } = calculateSimilarities(universe);
  
  return {
    seed,
    initialPopulation,
    finalPopulation,
    occupiedNodes: occupied,
    dialectRegions: dialects,
    avgIntraNodeSimilarity: intra,
    avgInterNodeSimilarity: inter,
    similarityRatio: inter > 0 ? intra / inter : 0,
  };
}

async function main() {
  console.log('=== H70検証: 人口増加と方言圏の関係 ===\n');
  console.log('仮説: 人口が増えると新しい方言圏が形成される\n');
  
  const seeds = [42, 123, 456];
  const initialPopulations = [20, 50, 100, 150];
  
  const results: SimulationResult[] = [];
  
  for (const pop of initialPopulations) {
    console.log(`初期人口 ${pop} を実行中...`);
    
    for (const seed of seeds) {
      const result = await runSimulation(seed, pop);
      results.push(result);
      console.log(`  Seed ${seed}: 最終人口${result.finalPopulation}, 占有${result.occupiedNodes}ノード, 方言圏${result.dialectRegions}`);
    }
    console.log();
  }
  
  // 初期人口別の集計
  console.log('=== 初期人口別集計 ===\n');
  console.log('初期人口\t| 最終人口\t| 占有ノード\t| 方言圏\t| 比率');
  console.log('--------|----------|-----------|-------|------');
  
  for (const pop of initialPopulations) {
    const groupResults = results.filter(r => r.initialPopulation === pop);
    const avgFinal = groupResults.reduce((sum, r) => sum + r.finalPopulation, 0) / groupResults.length;
    const avgOccupied = groupResults.reduce((sum, r) => sum + r.occupiedNodes, 0) / groupResults.length;
    const avgDialects = groupResults.reduce((sum, r) => sum + r.dialectRegions, 0) / groupResults.length;
    const avgRatio = groupResults.reduce((sum, r) => sum + r.similarityRatio, 0) / groupResults.length;
    
    console.log(`${pop}\t\t| ${avgFinal.toFixed(0)}\t\t| ${avgOccupied.toFixed(1)}\t\t| ${avgDialects.toFixed(1)}\t| ${avgRatio.toFixed(1)}x`);
  }
  
  // 相関分析
  console.log('\n=== 相関分析 ===\n');
  
  const finalPops = results.map(r => r.finalPopulation);
  const occupiedNodes = results.map(r => r.occupiedNodes);
  const dialects = results.map(r => r.dialectRegions);
  const ratios = results.map(r => r.similarityRatio);
  
  const popDialectCorr = calculateCorrelation(finalPops, dialects);
  const popOccupiedCorr = calculateCorrelation(finalPops, occupiedNodes);
  const occupiedDialectCorr = calculateCorrelation(occupiedNodes, dialects);
  const popRatioCorr = calculateCorrelation(finalPops, ratios);
  
  console.log(`最終人口 vs 方言圏数: ${popDialectCorr.toFixed(3)}`);
  console.log(`最終人口 vs 占有ノード: ${popOccupiedCorr.toFixed(3)}`);
  console.log(`占有ノード vs 方言圏数: ${occupiedDialectCorr.toFixed(3)}`);
  console.log(`最終人口 vs 類似度比率: ${popRatioCorr.toFixed(3)}`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  if (popDialectCorr > 0.5) {
    console.log('H70を支持: 人口増加は新しい方言圏を生む');
    console.log(`→ 人口と方言圏数に正の相関（${popDialectCorr.toFixed(3)}）`);
  } else if (popDialectCorr > 0.2) {
    console.log('H70を部分的に支持: 人口と方言圏に弱い正の相関');
    console.log(`→ 相関係数: ${popDialectCorr.toFixed(3)}`);
  } else if (popDialectCorr > -0.2) {
    console.log('H70は不明確: 人口と方言圏に明確な関係がない');
    console.log(`→ 相関係数: ${popDialectCorr.toFixed(3)}`);
  } else {
    console.log('H70を棄却: 人口増加は方言圏を減らす');
    console.log(`→ 相関係数: ${popDialectCorr.toFixed(3)}`);
  }
  
  // 媒介分析
  console.log('\n=== 媒介分析 ===\n');
  if (popOccupiedCorr > 0.5 && occupiedDialectCorr > 0.5) {
    console.log('人口 → 占有ノード → 方言圏 の因果経路が示唆される');
    console.log(`人口→占有: ${popOccupiedCorr.toFixed(3)}, 占有→方言圏: ${occupiedDialectCorr.toFixed(3)}`);
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
