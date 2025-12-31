/**
 * H60検証: State→行動接続の効果
 * 
 * 仮説: 「情報→行動選択」の接続を追加しても、言語が創発するとは限らない
 * 
 * 検証方法:
 * - A群: State特徴量の重みが進化する（通常）
 * - B群: State特徴量の重みを0に固定（進化しない）
 * 
 * 観測指標:
 * - 情報多様性（state分布のエントロピー）
 * - 行動パターンの多様性
 * - 生存率・人口
 * - 協力率
 * - State特徴量の重みの進化
 */

import { Universe, UniverseConfig, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';
import { FeatureIndex, FEATURE_COUNT, ACTION_COUNT } from '../src/core/behavior-rule.js';

interface TrialResult {
  group: 'A' | 'B';
  seed: number;
  finalPopulation: number;
  maxPopulation: number;
  survivalRate: number;
  cooperationRate: number;
  stateEntropy: number;
  actionEntropy: number;
  avgStateChange: number;
  avgStateWeightMagnitude: number;
}

function calculateEntropy(counts: Map<string, number>): number {
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  
  let entropy = 0;
  for (const count of counts.values()) {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

function runTrial(seed: number, stateFeatureEnabled: boolean): TrialResult {
  const config: Partial<UniverseConfig> = {
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: 50,
      initialResourceAmount: 80,
    },
    resourceRegenerationRate: 0.012,
    entropyRate: 0.001,
  };

  const universe = new Universe(config);
  
  const ticks = 3000;
  let maxPopulation = 0;
  let totalCooperations = 0;
  let totalReplications = 0;
  
  // State変化追跡
  const stateHistory: Map<string, Uint8Array> = new Map();
  let totalStateChange = 0;
  let stateChangeCount = 0;
  
  for (let t = 0; t < ticks; t++) {
    // B群: State特徴量の重みを0に固定（毎tick）
    if (!stateFeatureEnabled) {
      for (const entity of universe.getAllEntities()) {
        const weights = entity.behaviorRule.actionWeights;
        // StateFeature0-3の重みを全行動で0に固定
        for (let action = 0; action < ACTION_COUNT; action++) {
          weights[action * FEATURE_COUNT + FeatureIndex.StateFeature0] = 0;
          weights[action * FEATURE_COUNT + FeatureIndex.StateFeature1] = 0;
          weights[action * FEATURE_COUNT + FeatureIndex.StateFeature2] = 0;
          weights[action * FEATURE_COUNT + FeatureIndex.StateFeature3] = 0;
        }
      }
    }
    
    universe.step();
    
    const stats = universe.getStats();
    if (stats.entityCount > maxPopulation) {
      maxPopulation = stats.entityCount;
    }
    
    // イベントログから協力・複製をカウント
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'replication') {
        totalReplications++;
      }
      if (event.type === 'partnerSelected') {
        totalCooperations++;
      }
    }
    universe.clearEventLog();
    
    // State変化を追跡（100tick毎）
    if (t % 100 === 0) {
      for (const entity of universe.getAllEntities()) {
        const key = entity.id;
        const currentState = entity.state.getData();
        const prevState = stateHistory.get(key);
        
        if (prevState) {
          // ハミング距離を計算
          let diff = 0;
          for (let i = 0; i < Math.min(currentState.length, prevState.length); i++) {
            if (currentState[i] !== prevState[i]) diff++;
          }
          totalStateChange += diff;
          stateChangeCount++;
        }
        
        stateHistory.set(key, new Uint8Array(currentState));
      }
    }
  }
  
  const finalStats = universe.getStats();
  
  // State分布のエントロピー計算
  const stateCounts: Map<string, number> = new Map();
  for (const entity of universe.getAllEntities()) {
    const stateKey = Array.from(entity.state.getData().slice(0, 4)).join(',');
    stateCounts.set(stateKey, (stateCounts.get(stateKey) ?? 0) + 1);
  }
  const stateEntropy = calculateEntropy(stateCounts);
  
  // 行動パターンのエントロピー（遺伝子分布から推定）
  const geneCounts: Map<string, number> = new Map();
  for (const entity of universe.getAllEntities()) {
    const geneKey = Array.from(entity.behaviorRule.genes).map(g => Math.round(g * 10)).join(',');
    geneCounts.set(geneKey, (geneCounts.get(geneKey) ?? 0) + 1);
  }
  const actionEntropy = calculateEntropy(geneCounts);
  
  // State特徴量の重みの大きさを計算
  let totalWeightMagnitude = 0;
  let weightCount = 0;
  for (const entity of universe.getAllEntities()) {
    const weights = entity.behaviorRule.actionWeights;
    for (let action = 0; action < ACTION_COUNT; action++) {
      totalWeightMagnitude += Math.abs(weights[action * FEATURE_COUNT + FeatureIndex.StateFeature0] ?? 0);
      totalWeightMagnitude += Math.abs(weights[action * FEATURE_COUNT + FeatureIndex.StateFeature1] ?? 0);
      totalWeightMagnitude += Math.abs(weights[action * FEATURE_COUNT + FeatureIndex.StateFeature2] ?? 0);
      totalWeightMagnitude += Math.abs(weights[action * FEATURE_COUNT + FeatureIndex.StateFeature3] ?? 0);
      weightCount += 4;
    }
  }
  const avgStateWeightMagnitude = weightCount > 0 ? totalWeightMagnitude / weightCount : 0;
  
  const cooperationRate = totalReplications > 0 ? totalCooperations / totalReplications : 0;
  const survivalRate = maxPopulation > 0 ? finalStats.entityCount / maxPopulation : 0;
  const avgStateChange = stateChangeCount > 0 ? totalStateChange / stateChangeCount : 0;
  
  return {
    group: stateFeatureEnabled ? 'A' : 'B',
    seed,
    finalPopulation: finalStats.entityCount,
    maxPopulation,
    survivalRate,
    cooperationRate,
    stateEntropy,
    actionEntropy,
    avgStateChange,
    avgStateWeightMagnitude,
  };
}

function main() {
  console.log('=== H60検証: State→行動接続の効果 ===\n');
  console.log('仮説: 「情報→行動選択」の接続を追加しても、言語が創発するとは限らない\n');
  console.log('方法: A群はState特徴量の重みが進化、B群は重みを0に固定\n');
  
  const trials = 10;
  const resultsA: TrialResult[] = [];
  const resultsB: TrialResult[] = [];
  
  console.log('実行中...');
  
  for (let i = 0; i < trials; i++) {
    const seed = 10000 + i;
    
    // A群: State特徴量ON（重みが進化）
    const resultA = runTrial(seed, true);
    resultsA.push(resultA);
    
    // B群: State特徴量OFF（重みを0に固定）
    const resultB = runTrial(seed, false);
    resultsB.push(resultB);
    
    console.log(`  Trial ${i + 1}/${trials} 完了 (A: pop=${resultA.finalPopulation}, B: pop=${resultB.finalPopulation})`);
  }
  
  // 集計
  const avgA = {
    finalPopulation: resultsA.reduce((a, b) => a + b.finalPopulation, 0) / trials,
    maxPopulation: resultsA.reduce((a, b) => a + b.maxPopulation, 0) / trials,
    survivalRate: resultsA.reduce((a, b) => a + b.survivalRate, 0) / trials,
    cooperationRate: resultsA.reduce((a, b) => a + b.cooperationRate, 0) / trials,
    stateEntropy: resultsA.reduce((a, b) => a + b.stateEntropy, 0) / trials,
    actionEntropy: resultsA.reduce((a, b) => a + b.actionEntropy, 0) / trials,
    avgStateChange: resultsA.reduce((a, b) => a + b.avgStateChange, 0) / trials,
    avgStateWeightMagnitude: resultsA.reduce((a, b) => a + b.avgStateWeightMagnitude, 0) / trials,
  };
  
  const avgB = {
    finalPopulation: resultsB.reduce((a, b) => a + b.finalPopulation, 0) / trials,
    maxPopulation: resultsB.reduce((a, b) => a + b.maxPopulation, 0) / trials,
    survivalRate: resultsB.reduce((a, b) => a + b.survivalRate, 0) / trials,
    cooperationRate: resultsB.reduce((a, b) => a + b.cooperationRate, 0) / trials,
    stateEntropy: resultsB.reduce((a, b) => a + b.stateEntropy, 0) / trials,
    actionEntropy: resultsB.reduce((a, b) => a + b.actionEntropy, 0) / trials,
    avgStateChange: resultsB.reduce((a, b) => a + b.avgStateChange, 0) / trials,
    avgStateWeightMagnitude: resultsB.reduce((a, b) => a + b.avgStateWeightMagnitude, 0) / trials,
  };
  
  console.log('\n=== 結果 ===\n');
  console.log('A群（State特徴量ON - 重みが進化）:');
  console.log(`  最終人口: ${avgA.finalPopulation.toFixed(1)}`);
  console.log(`  最大人口: ${avgA.maxPopulation.toFixed(1)}`);
  console.log(`  生存率: ${(avgA.survivalRate * 100).toFixed(1)}%`);
  console.log(`  協力率: ${(avgA.cooperationRate * 100).toFixed(1)}%`);
  console.log(`  State多様性（エントロピー）: ${avgA.stateEntropy.toFixed(3)}`);
  console.log(`  行動多様性（エントロピー）: ${avgA.actionEntropy.toFixed(3)}`);
  console.log(`  平均State変化: ${avgA.avgStateChange.toFixed(2)}`);
  console.log(`  State重みの大きさ: ${avgA.avgStateWeightMagnitude.toFixed(4)}`);
  
  console.log('\nB群（State特徴量OFF - 重みを0に固定）:');
  console.log(`  最終人口: ${avgB.finalPopulation.toFixed(1)}`);
  console.log(`  最大人口: ${avgB.maxPopulation.toFixed(1)}`);
  console.log(`  生存率: ${(avgB.survivalRate * 100).toFixed(1)}%`);
  console.log(`  協力率: ${(avgB.cooperationRate * 100).toFixed(1)}%`);
  console.log(`  State多様性（エントロピー）: ${avgB.stateEntropy.toFixed(3)}`);
  console.log(`  行動多様性（エントロピー）: ${avgB.actionEntropy.toFixed(3)}`);
  console.log(`  平均State変化: ${avgB.avgStateChange.toFixed(2)}`);
  console.log(`  State重みの大きさ: ${avgB.avgStateWeightMagnitude.toFixed(4)}`);
  
  console.log('\n=== 比較 ===\n');
  const popDiff = avgB.finalPopulation > 0 
    ? ((avgA.finalPopulation - avgB.finalPopulation) / avgB.finalPopulation * 100)
    : (avgA.finalPopulation > 0 ? 100 : 0);
  const survDiff = avgB.survivalRate > 0
    ? ((avgA.survivalRate - avgB.survivalRate) / avgB.survivalRate * 100)
    : (avgA.survivalRate > 0 ? 100 : 0);
  const coopDiff = avgB.cooperationRate > 0 
    ? ((avgA.cooperationRate - avgB.cooperationRate) / avgB.cooperationRate * 100)
    : (avgA.cooperationRate > 0 ? 100 : 0);
  const stateDiff = avgB.stateEntropy > 0
    ? ((avgA.stateEntropy - avgB.stateEntropy) / avgB.stateEntropy * 100)
    : (avgA.stateEntropy > 0 ? 100 : 0);
  const actionDiff = avgB.actionEntropy > 0
    ? ((avgA.actionEntropy - avgB.actionEntropy) / avgB.actionEntropy * 100)
    : (avgA.actionEntropy > 0 ? 100 : 0);
  const weightDiff = avgB.avgStateWeightMagnitude > 0
    ? ((avgA.avgStateWeightMagnitude - avgB.avgStateWeightMagnitude) / avgB.avgStateWeightMagnitude * 100)
    : (avgA.avgStateWeightMagnitude > 0 ? 100 : 0);
  
  console.log(`最終人口差: ${popDiff >= 0 ? '+' : ''}${popDiff.toFixed(1)}%`);
  console.log(`生存率差: ${survDiff >= 0 ? '+' : ''}${survDiff.toFixed(1)}%`);
  console.log(`協力率差: ${coopDiff >= 0 ? '+' : ''}${coopDiff.toFixed(1)}%`);
  console.log(`State多様性差: ${stateDiff >= 0 ? '+' : ''}${stateDiff.toFixed(1)}%`);
  console.log(`行動多様性差: ${actionDiff >= 0 ? '+' : ''}${actionDiff.toFixed(1)}%`);
  console.log(`State重み差: ${weightDiff >= 0 ? '+' : ''}${weightDiff.toFixed(1)}%`);
  
  // 言語創発の判定
  // 言語創発の指標: State多様性が高く、かつ行動多様性も高い
  const languageThreshold = 2.0; // エントロピー閾値
  const languageEmergenceA = avgA.stateEntropy > languageThreshold && avgA.actionEntropy > languageThreshold;
  const languageEmergenceB = avgB.stateEntropy > languageThreshold && avgB.actionEntropy > languageThreshold;
  
  console.log('\n=== 言語創発判定 ===\n');
  console.log(`A群: ${languageEmergenceA ? '創発の兆候あり' : '創発なし'} (State: ${avgA.stateEntropy.toFixed(2)}, Action: ${avgA.actionEntropy.toFixed(2)})`);
  console.log(`B群: ${languageEmergenceB ? '創発の兆候あり' : '創発なし'} (State: ${avgB.stateEntropy.toFixed(2)}, Action: ${avgB.actionEntropy.toFixed(2)})`);
  
  // H60の判定
  console.log('\n=== H60判定 ===\n');
  
  // State→行動接続があっても言語が創発しない、または両群で同様の場合、H60は支持される
  const significantDifference = Math.abs(stateDiff) > 30 || Math.abs(actionDiff) > 30;
  const h60Supported = !significantDifference || (!languageEmergenceA && !languageEmergenceB);
  
  if (h60Supported) {
    console.log('結果: H60を支持');
    console.log('理由: State→行動接続を追加しても、言語の創発は自動的には起こらない');
    if (!significantDifference) {
      console.log('      A群とB群の多様性に大きな差がなく、接続だけでは不十分');
    }
  } else {
    console.log('結果: H60を棄却');
    console.log('理由: State→行動接続により、有意な多様性の差が観測された');
  }
  
  // 追加観察
  console.log('\n=== 追加観察 ===\n');
  
  // State重みの進化
  if (avgA.avgStateWeightMagnitude > 0.01) {
    console.log(`State特徴量の重みが進化している（平均: ${avgA.avgStateWeightMagnitude.toFixed(4)}）`);
    console.log('  → 自然選択によりState→行動の接続が強化される可能性がある');
  } else {
    console.log('State特徴量の重みはほぼ0のまま');
    console.log('  → 現在の環境ではState→行動接続に選択圧がかかっていない');
  }
  
  console.log('\nState→行動接続の効果:');
  if (Math.abs(popDiff) > 10) {
    console.log(`  - 人口に${popDiff > 0 ? '正' : '負'}の影響（${popDiff.toFixed(1)}%）`);
  } else {
    console.log('  - 人口への影響は限定的');
  }
  if (Math.abs(coopDiff) > 10) {
    console.log(`  - 協力率に${coopDiff > 0 ? '正' : '負'}の影響（${coopDiff.toFixed(1)}%）`);
  } else {
    console.log('  - 協力率への影響は限定的');
  }
}

main();
