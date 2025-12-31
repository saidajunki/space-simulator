/**
 * H66検証: 協力ペアのState類似度
 * 
 * 仮説: 協力複製を行うペアは、State（内部情報）が類似している傾向があるか？
 * 
 * 検証方法:
 * 1. 協力複製イベントを収集
 * 2. 親とパートナーのState類似度を計算
 * 3. ランダムペアのState類似度と比較
 * 
 * 期待される結果:
 * - 協力ペアのState類似度 > ランダムペアのState類似度 → 言語的収束の萌芽
 * - 協力ペアのState類似度 ≈ ランダムペアのState類似度 → State類似は協力に影響しない
 */

import { Universe, UniverseConfig } from '../src/core/universe';

interface CooperationEvent {
  parentId: string;
  partnerId: string;
  parentState: Uint8Array;
  partnerState: Uint8Array;
  similarity: number;
}

interface SimulationResult {
  seed: number;
  cooperationEvents: number;
  avgCoopSimilarity: number;
  avgRandomSimilarity: number;
  similarityDiff: number;
  population: number;
  stateDiversity: number;
}

// State類似度を計算（コサイン類似度）
function calculateStateSimilarity(state1: Uint8Array, state2: Uint8Array): number {
  if (state1.length === 0 || state2.length === 0) return 0;
  
  const minLen = Math.min(state1.length, state2.length);
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < minLen; i++) {
    dotProduct += state1[i] * state2[i];
    norm1 += state1[i] * state1[i];
    norm2 += state2[i] * state2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ハミング距離ベースの類似度（0-1、1が完全一致）
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
  
  const cooperationEvents: CooperationEvent[] = [];
  const allStates: Map<string, Uint8Array> = new Map();
  
  // シミュレーション実行
  for (let tick = 0; tick < config.maxTicks; tick++) {
    universe.step();
    
    // 現在のエンティティのStateを記録
    const entities = universe.getAllEntities();
    for (const entity of entities) {
      allStates.set(entity.id, new Uint8Array(entity.state.getData()));
    }
    
    // イベントログから協力複製を抽出（partnerSelectedイベントを使用）
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'partnerSelected') {
        const parentId = (event as any).entityId;
        const partnerId = (event as any).partnerId;
        
        const parentState = allStates.get(parentId);
        const partnerState = allStates.get(partnerId);
        
        if (parentState && partnerState && parentState.length > 0 && partnerState.length > 0) {
          const similarity = calculateHammingSimilarity(parentState, partnerState);
          cooperationEvents.push({
            parentId,
            partnerId,
            parentState,
            partnerState,
            similarity,
          });
        }
      }
    }
    
    universe.clearEventLog();
  }
  
  // 最終状態の取得
  const finalEntities = universe.getAllEntities();
  const population = finalEntities.length;
  
  // State多様性の計算
  const uniqueStates = new Set<string>();
  for (const entity of finalEntities) {
    const stateData = entity.state.getData();
    uniqueStates.add(Array.from(stateData.slice(0, 8)).join(','));
  }
  const stateDiversity = uniqueStates.size;
  
  // 協力ペアの平均類似度
  const avgCoopSimilarity = cooperationEvents.length > 0
    ? cooperationEvents.reduce((sum, e) => sum + e.similarity, 0) / cooperationEvents.length
    : 0;
  
  // ランダムペアの平均類似度（比較用）
  let randomSimilaritySum = 0;
  let randomPairCount = 0;
  const stateArray = Array.from(allStates.values());
  
  if (stateArray.length >= 2) {
    // 最大1000ペアをサンプリング
    const sampleSize = Math.min(1000, stateArray.length * (stateArray.length - 1) / 2);
    for (let i = 0; i < sampleSize; i++) {
      const idx1 = Math.floor(Math.random() * stateArray.length);
      let idx2 = Math.floor(Math.random() * stateArray.length);
      while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * stateArray.length);
      }
      randomSimilaritySum += calculateHammingSimilarity(stateArray[idx1], stateArray[idx2]);
      randomPairCount++;
    }
  }
  
  const avgRandomSimilarity = randomPairCount > 0 ? randomSimilaritySum / randomPairCount : 0;
  
  return {
    seed,
    cooperationEvents: cooperationEvents.length,
    avgCoopSimilarity,
    avgRandomSimilarity,
    similarityDiff: avgCoopSimilarity - avgRandomSimilarity,
    population,
    stateDiversity,
  };
}

async function main() {
  console.log('=== H66検証: 協力ペアのState類似度 ===\n');
  console.log('仮説: 協力複製を行うペアは、Stateが類似している傾向があるか？\n');
  
  const seeds = [42, 123, 456, 789, 1000];
  const results: SimulationResult[] = [];
  
  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const result = await runSimulation(seed);
    results.push(result);
    
    console.log(`  協力イベント: ${result.cooperationEvents}`);
    console.log(`  協力ペア類似度: ${result.avgCoopSimilarity.toFixed(4)}`);
    console.log(`  ランダムペア類似度: ${result.avgRandomSimilarity.toFixed(4)}`);
    console.log(`  差分: ${result.similarityDiff > 0 ? '+' : ''}${result.similarityDiff.toFixed(4)}`);
    console.log(`  人口: ${result.population}, State多様性: ${result.stateDiversity}\n`);
  }
  
  // 集計
  console.log('=== 集計結果 ===\n');
  
  const avgCoopSim = results.reduce((sum, r) => sum + r.avgCoopSimilarity, 0) / results.length;
  const avgRandomSim = results.reduce((sum, r) => sum + r.avgRandomSimilarity, 0) / results.length;
  const avgDiff = results.reduce((sum, r) => sum + r.similarityDiff, 0) / results.length;
  const totalCoopEvents = results.reduce((sum, r) => sum + r.cooperationEvents, 0);
  
  console.log(`総協力イベント数: ${totalCoopEvents}`);
  console.log(`平均協力ペア類似度: ${avgCoopSim.toFixed(4)}`);
  console.log(`平均ランダムペア類似度: ${avgRandomSim.toFixed(4)}`);
  console.log(`平均差分: ${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(4)}`);
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  const positiveCount = results.filter(r => r.similarityDiff > 0).length;
  const significantCount = results.filter(r => r.similarityDiff > 0.01).length;
  
  if (avgDiff > 0.05) {
    console.log('H66を支持: 協力ペアはStateが類似している傾向がある');
    console.log('→ 言語的収束の萌芽が観察される可能性');
  } else if (avgDiff > 0.01) {
    console.log('H66を部分的に支持: 弱い正の相関がある');
    console.log(`→ ${positiveCount}/${results.length} のseedで正の差分`);
  } else if (avgDiff > -0.01) {
    console.log('H66は不明確: 協力ペアとランダムペアの類似度に有意な差がない');
    console.log('→ State類似は協力に影響していない');
  } else {
    console.log('H66を棄却: 協力ペアはむしろStateが異なる傾向がある');
    console.log('→ 多様性が協力を促進している可能性');
  }
  
  console.log(`\n正の差分を示したseed: ${positiveCount}/${results.length}`);
  console.log(`有意な正の差分（>0.01）を示したseed: ${significantCount}/${results.length}`);
}

main().catch(console.error);
