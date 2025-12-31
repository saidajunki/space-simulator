/**
 * H68検証: 方言圏は時間とともに分化するか
 * 
 * 仮説: 長期シミュレーションでは、ノード間のState差異が拡大し、
 *       「方言圏」がより明確になる
 * 
 * 検証方法:
 * 1. 長期シミュレーション（20,000 tick）を実行
 * 2. 時間経過に伴うノード内/ノード間類似度の変化を追跡
 * 3. 「方言圏」の分化を観察
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface TimePoint {
  tick: number;
  population: number;
  occupiedNodes: number;
  avgIntraNodeSimilarity: number;
  avgInterNodeSimilarity: number;
  similarityRatio: number;
  dialectRegions: number;
}

interface SimulationResult {
  seed: number;
  timePoints: TimePoint[];
  initialRatio: number;
  finalRatio: number;
  ratioChange: number;
  dialectGrowth: number;
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
  
  // ノードごとにエンティティをグループ化
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
  
  // ノード間類似度（サンプリング）
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

async function runSimulation(seed: number): Promise<SimulationResult> {
  const config: UniverseConfig = {
    seed,
    nodeCount: 20,
    edgeDensity: 0.3,
    initialEntityCount: 50,
    resourceRegenerationRate: 0.020,
    maxTicks: 10000,
    logFrequency: 100,
  };

  const universe = new Universe(config);
  const timePoints: TimePoint[] = [];
  
  // 測定ポイント
  const measurePoints = [1000, 2000, 5000, 7500, 10000];
  
  for (let tick = 0; tick < config.maxTicks; tick++) {
    universe.step();
    universe.clearEventLog();
    
    if (measurePoints.includes(tick)) {
      const entities = universe.getAllEntities();
      const population = entities.length;
      
      // 占有ノード数
      const occupiedNodes = new Set(entities.map(e => e.nodeId)).size;
      
      // 類似度計算
      const { intra, inter, dialects } = calculateSimilarities(universe);
      
      timePoints.push({
        tick,
        population,
        occupiedNodes,
        avgIntraNodeSimilarity: intra,
        avgInterNodeSimilarity: inter,
        similarityRatio: inter > 0 ? intra / inter : 0,
        dialectRegions: dialects,
      });
    }
  }
  
  const initialRatio = timePoints[0]?.similarityRatio ?? 0;
  const finalRatio = timePoints[timePoints.length - 1]?.similarityRatio ?? 0;
  const initialDialects = timePoints[0]?.dialectRegions ?? 0;
  const finalDialects = timePoints[timePoints.length - 1]?.dialectRegions ?? 0;
  
  return {
    seed,
    timePoints,
    initialRatio,
    finalRatio,
    ratioChange: finalRatio - initialRatio,
    dialectGrowth: finalDialects - initialDialects,
  };
}

async function main() {
  console.log('=== H68検証: 方言圏は時間とともに分化するか ===\n');
  
  const seeds = [42, 123, 456, 789, 1000];
  const results: SimulationResult[] = [];
  
  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const result = await runSimulation(seed);
    results.push(result);
    
    console.log(`  初期比率: ${result.initialRatio.toFixed(2)}x → 最終比率: ${result.finalRatio.toFixed(2)}x`);
    console.log(`  比率変化: ${result.ratioChange > 0 ? '+' : ''}${result.ratioChange.toFixed(2)}`);
    console.log(`  方言圏変化: ${result.dialectGrowth > 0 ? '+' : ''}${result.dialectGrowth}\n`);
  }
  
  // 時系列の詳細
  console.log('=== 時系列の詳細 ===\n');
  console.log('Tick\t| Intra\t| Inter\t| Ratio\t| Dialects');
  console.log('--------|-------|-------|-------|----------');
  
  // 全seedの平均を計算
  const avgByTick = new Map<number, { intra: number; inter: number; ratio: number; dialects: number; count: number }>();
  
  for (const result of results) {
    for (const tp of result.timePoints) {
      if (!avgByTick.has(tp.tick)) {
        avgByTick.set(tp.tick, { intra: 0, inter: 0, ratio: 0, dialects: 0, count: 0 });
      }
      const avg = avgByTick.get(tp.tick)!;
      avg.intra += tp.avgIntraNodeSimilarity;
      avg.inter += tp.avgInterNodeSimilarity;
      avg.ratio += tp.similarityRatio;
      avg.dialects += tp.dialectRegions;
      avg.count++;
    }
  }
  
  for (const [tick, avg] of Array.from(avgByTick.entries()).sort((a, b) => a[0] - b[0])) {
    const n = avg.count;
    console.log(`${tick}\t| ${(avg.intra/n).toFixed(4)}\t| ${(avg.inter/n).toFixed(4)}\t| ${(avg.ratio/n).toFixed(1)}x\t| ${(avg.dialects/n).toFixed(1)}`);
  }
  
  // 集計
  console.log('\n=== 集計結果 ===\n');
  
  const avgRatioChange = results.reduce((sum, r) => sum + r.ratioChange, 0) / results.length;
  const avgDialectGrowth = results.reduce((sum, r) => sum + r.dialectGrowth, 0) / results.length;
  const positiveRatioCount = results.filter(r => r.ratioChange > 0).length;
  const positiveDialectCount = results.filter(r => r.dialectGrowth > 0).length;
  
  console.log(`平均比率変化: ${avgRatioChange > 0 ? '+' : ''}${avgRatioChange.toFixed(2)}`);
  console.log(`平均方言圏変化: ${avgDialectGrowth > 0 ? '+' : ''}${avgDialectGrowth.toFixed(1)}`);
  console.log(`比率増加したseed: ${positiveRatioCount}/${results.length}`);
  console.log(`方言圏増加したseed: ${positiveDialectCount}/${results.length}`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  if (avgRatioChange > 5 && positiveRatioCount >= 4) {
    console.log('H68を強く支持: 方言圏は時間とともに明確に分化する');
  } else if (avgRatioChange > 0 && positiveRatioCount >= 3) {
    console.log('H68を支持: 方言圏は時間とともに分化する傾向がある');
  } else if (avgRatioChange > -5 && avgRatioChange < 5) {
    console.log('H68は不明確: 方言圏の分化に一貫した傾向がない');
  } else {
    console.log('H68を棄却: 方言圏は時間とともに収束する（分化しない）');
  }
}

main().catch(console.error);
