/**
 * レジーム分類の改善スクリプト
 * 
 * 目的: フィードバックに基づき、レジーム探索の集計方法を改善
 * - 最終tickの瞬間値ではなく、累積/率/時間窓で分類
 * - より正確なレジーム判定
 */

import { Universe, DEFAULT_UNIVERSE_CONFIG } from '../src/core/universe.js';

interface TimeWindowStats {
  window: number;
  avgEntityCount: number;
  avgArtifactCount: number;
  totalInteractions: number;
  totalReplications: number;
  totalDeaths: number;
  populationGrowthRate: number;
  survivalRate: number;
}

interface RegimeClassification {
  seed: number;
  regenRate: number;
  regime: string;
  confidence: number;
  timeWindows: TimeWindowStats[];
  finalStats: {
    entityCount: number;
    artifactCount: number;
    avgAge: number;
  };
}

function classifyRegime(windows: TimeWindowStats[]): { regime: string; confidence: number } {
  const lastWindow = windows[windows.length - 1];
  const firstWindow = windows[0];
  
  if (!lastWindow || !firstWindow) {
    return { regime: 'unknown', confidence: 0 };
  }
  
  // 絶滅判定
  if (lastWindow.avgEntityCount < 1) {
    return { regime: 'extinction', confidence: 0.9 };
  }
  
  // 人口変化率
  const populationChange = (lastWindow.avgEntityCount - firstWindow.avgEntityCount) / Math.max(1, firstWindow.avgEntityCount);
  
  // 活動レベル（相互作用 + 複製）
  const activityLevel = (lastWindow.totalInteractions + lastWindow.totalReplications) / 1000;
  
  // 安定性（人口変動の標準偏差）
  const avgPop = windows.reduce((sum, w) => sum + w.avgEntityCount, 0) / windows.length;
  const popVariance = windows.reduce((sum, w) => sum + Math.pow(w.avgEntityCount - avgPop, 2), 0) / windows.length;
  const popStdDev = Math.sqrt(popVariance);
  const stabilityCoef = popStdDev / Math.max(1, avgPop);
  
  // レジーム判定
  if (lastWindow.avgEntityCount < 5) {
    if (activityLevel < 10) {
      return { regime: 'static', confidence: 0.8 };
    } else {
      return { regime: 'sparse-active', confidence: 0.7 };
    }
  }
  
  if (lastWindow.avgEntityCount >= 5 && lastWindow.avgEntityCount < 20) {
    if (stabilityCoef < 0.3) {
      return { regime: 'stable-small', confidence: 0.8 };
    } else {
      return { regime: 'fluctuating-small', confidence: 0.7 };
    }
  }
  
  if (lastWindow.avgEntityCount >= 20) {
    if (stabilityCoef < 0.3) {
      return { regime: 'stable-large', confidence: 0.8 };
    } else if (populationChange > 0.5) {
      return { regime: 'growing', confidence: 0.7 };
    } else if (populationChange < -0.3) {
      return { regime: 'declining', confidence: 0.7 };
    } else {
      return { regime: 'active', confidence: 0.8 };
    }
  }
  
  return { regime: 'unknown', confidence: 0.5 };
}

function runSimulation(seed: number, regenRate: number, ticks: number, windowSize: number): RegimeClassification {
  const universe = new Universe({
    ...DEFAULT_UNIVERSE_CONFIG,
    seed,
    resourceRegenerationRate: regenRate,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
    worldGen: {
      nodeCount: 30,
      initialEntityCount: 50,
      edgeDensity: 0.3,
    },
  });

  const timeWindows: TimeWindowStats[] = [];
  let windowEntitySum = 0;
  let windowArtifactSum = 0;
  let windowInteractions = 0;
  let windowReplications = 0;
  let windowDeaths = 0;
  let windowTicks = 0;
  let prevEntityCount = 50;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    const stats = universe.getStats();
    const events = universe.getEventLog();
    
    windowEntitySum += stats.entityCount;
    windowArtifactSum += stats.artifactCount;
    windowTicks++;
    
    for (const event of events) {
      if (event.type === 'interaction') windowInteractions++;
      if (event.type === 'replication') windowReplications++;
      if (event.type === 'entityDied') windowDeaths++;
    }
    universe.clearEventLog();
    
    // 時間窓の終了
    if ((t + 1) % windowSize === 0) {
      const avgEntityCount = windowEntitySum / windowTicks;
      const populationGrowthRate = (avgEntityCount - prevEntityCount) / Math.max(1, prevEntityCount);
      const survivalRate = windowDeaths > 0 ? 1 - (windowDeaths / (windowEntitySum / windowTicks + windowDeaths)) : 1;
      
      timeWindows.push({
        window: timeWindows.length,
        avgEntityCount,
        avgArtifactCount: windowArtifactSum / windowTicks,
        totalInteractions: windowInteractions,
        totalReplications: windowReplications,
        totalDeaths: windowDeaths,
        populationGrowthRate,
        survivalRate,
      });
      
      prevEntityCount = avgEntityCount;
      windowEntitySum = 0;
      windowArtifactSum = 0;
      windowInteractions = 0;
      windowReplications = 0;
      windowDeaths = 0;
      windowTicks = 0;
    }
  }

  const finalStats = universe.getStats();
  const { regime, confidence } = classifyRegime(timeWindows);

  return {
    seed,
    regenRate,
    regime,
    confidence,
    timeWindows,
    finalStats: {
      entityCount: finalStats.entityCount,
      artifactCount: finalStats.artifactCount,
      avgAge: finalStats.averageAge,
    },
  };
}

async function main() {
  console.log('=== レジーム分類の改善検証 ===\n');
  console.log('目的: 累積/率/時間窓でレジームを分類\n');

  const seeds = [42, 123, 456];
  const regenRates = [0.004, 0.008, 0.012, 0.016, 0.020, 0.024];
  const ticks = 5000;
  const windowSize = 500;

  const results: RegimeClassification[] = [];

  for (const regenRate of regenRates) {
    console.log(`\n--- 資源再生率: ${regenRate} ---`);
    
    for (const seed of seeds) {
      console.log(`  Seed ${seed}...`);
      const result = runSimulation(seed, regenRate, ticks, windowSize);
      results.push(result);
      
      console.log(`    レジーム: ${result.regime} (信頼度: ${result.confidence.toFixed(2)})`);
      console.log(`    最終人口: ${result.finalStats.entityCount}, アーティファクト: ${result.finalStats.artifactCount}`);
    }
  }

  // 集計
  console.log('\n\n=== レジーム分布 ===\n');
  
  const regimeCounts = new Map<string, number>();
  for (const result of results) {
    const count = regimeCounts.get(result.regime) ?? 0;
    regimeCounts.set(result.regime, count + 1);
  }
  
  for (const [regime, count] of regimeCounts.entries()) {
    console.log(`${regime}: ${count}件 (${(count / results.length * 100).toFixed(1)}%)`);
  }

  // regenRate別のレジーム分布
  console.log('\n\n=== regenRate別レジーム ===\n');
  
  for (const regenRate of regenRates) {
    const rateResults = results.filter(r => r.regenRate === regenRate);
    const regimes = rateResults.map(r => r.regime).join(', ');
    console.log(`${regenRate}: ${regimes}`);
  }
}

main().catch(console.error);
