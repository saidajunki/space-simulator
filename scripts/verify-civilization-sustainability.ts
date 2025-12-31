/**
 * 文明の持続性検証: 4/4達成条件での長期シミュレーション
 * 
 * 目的:
 * 1. 4/4達成後の文明の持続性を検証
 * 2. 長期的な創発現象を観察
 * 3. 文明の「成熟」パターンを特定
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface TimeSeriesData {
  tick: number;
  pop: number;
  artPerCapita: number;
  hhi: number;
  coopRate: number;
  civScore: number;
  avgEnergy: number;
  avgAge: number;
}

function runLongSimulation(nodeCount: number, regenRate: number, seed: number, ticks: number): {
  timeSeries: TimeSeriesData[];
  summary: {
    avgCivScore: number;
    civScore4_4Rate: number;
    maxPop: number;
    minPop: number;
    avgPop: number;
    finalPop: number;
    avgArtPerCapita: number;
    avgHHI: number;
    avgCoopRate: number;
    avgAge: number;
  };
} {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount,
      edgeDensity: 0.4,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: regenRate,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };

  const universe = new Universe(config);
  const timeSeries: TimeSeriesData[] = [];
  
  let totalPop = 0;
  let totalArtPerCapita = 0;
  let totalHHI = 0;
  let totalCoopRate = 0;
  let totalCivScore = 0;
  let totalAge = 0;
  let samples = 0;
  let civScore4_4Count = 0;
  let maxPop = 0;
  let minPop = Infinity;
  
  let partnerSelections = 0;
  let replications = 0;
  let windowPartnerSelections = 0;
  let windowReplications = 0;

  const sampleInterval = 100; // 100 tickごとにサンプリング

  for (let t = 0; t < ticks; t++) {
    universe.step();
    const stats = universe.getStats();
    
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'partnerSelected') {
        partnerSelections++;
        windowPartnerSelections++;
      }
      if (event.type === 'replication') {
        replications++;
        windowReplications++;
      }
    }
    universe.clearEventLog();
    
    // サンプリング
    if ((t + 1) % sampleInterval === 0 && stats.entityCount > 0) {
      const values = Array.from(stats.spatialDistribution.values());
      const shares = values.map(v => v / stats.entityCount);
      const hhi = shares.reduce((sum, s) => sum + s * s, 0);
      
      const artPerCapita = stats.artifactCount / stats.entityCount;
      const coopRate = windowReplications > 0 ? (windowPartnerSelections / windowReplications) * 100 : 0;
      
      // 文明スコア（新定義）
      let civScore = 0;
      if (stats.entityCount >= 10) civScore++;
      if (artPerCapita >= 5) civScore++;
      if (coopRate >= 50) civScore++;
      if (hhi >= 0.15) civScore++;
      
      const data: TimeSeriesData = {
        tick: t + 1,
        pop: stats.entityCount,
        artPerCapita,
        hhi,
        coopRate,
        civScore,
        avgEnergy: stats.entityEnergy !== undefined ? stats.entityEnergy / stats.entityCount : 0,
        avgAge: stats.averageAge,
      };
      
      timeSeries.push(data);
      
      totalPop += stats.entityCount;
      totalArtPerCapita += artPerCapita;
      totalHHI += hhi;
      totalCoopRate += coopRate;
      totalCivScore += civScore;
      totalAge += stats.averageAge;
      samples++;
      
      if (civScore === 4) civScore4_4Count++;
      if (stats.entityCount > maxPop) maxPop = stats.entityCount;
      if (stats.entityCount < minPop) minPop = stats.entityCount;
      
      // ウィンドウをリセット
      windowPartnerSelections = 0;
      windowReplications = 0;
    }
  }

  const finalStats = universe.getStats();

  return {
    timeSeries,
    summary: {
      avgCivScore: samples > 0 ? totalCivScore / samples : 0,
      civScore4_4Rate: samples > 0 ? (civScore4_4Count / samples) * 100 : 0,
      maxPop,
      minPop: minPop === Infinity ? 0 : minPop,
      avgPop: samples > 0 ? totalPop / samples : 0,
      finalPop: finalStats.entityCount,
      avgArtPerCapita: samples > 0 ? totalArtPerCapita / samples : 0,
      avgHHI: samples > 0 ? totalHHI / samples : 0,
      avgCoopRate: samples > 0 ? totalCoopRate / samples : 0,
      avgAge: samples > 0 ? totalAge / samples : 0,
    },
  };
}

async function main() {
  console.log('=== 文明の持続性検証: 4/4達成条件での長期シミュレーション ===\n');
  
  // 4/4達成しやすい条件
  const configs = [
    { nodeCount: 20, regenRate: 0.020, label: '標準' },
    { nodeCount: 25, regenRate: 0.024, label: '最適' },
    { nodeCount: 20, regenRate: 0.028, label: '豊富' },
  ];
  
  const seeds = [42, 123, 456];
  const ticks = 10000; // 長期シミュレーション
  
  for (const cfg of configs) {
    console.log(`\n=== ${cfg.label}条件 (ノード=${cfg.nodeCount}, 再生率=${cfg.regenRate}) ===\n`);
    
    for (const seed of seeds) {
      console.log(`--- Seed ${seed} ---`);
      const result = runLongSimulation(cfg.nodeCount, cfg.regenRate, seed, ticks);
      
      console.log(`  平均文明スコア: ${result.summary.avgCivScore.toFixed(2)}/4`);
      console.log(`  4/4達成率: ${result.summary.civScore4_4Rate.toFixed(1)}%`);
      console.log(`  人口: ${result.summary.minPop}〜${result.summary.maxPop} (平均${result.summary.avgPop.toFixed(1)}, 最終${result.summary.finalPop})`);
      console.log(`  平均Art/人: ${result.summary.avgArtPerCapita.toFixed(2)}`);
      console.log(`  平均HHI: ${result.summary.avgHHI.toFixed(3)}`);
      console.log(`  平均協力率: ${result.summary.avgCoopRate.toFixed(1)}%`);
      console.log(`  平均年齢: ${result.summary.avgAge.toFixed(0)} tick`);
      
      // 時系列の傾向分析
      const firstHalf = result.timeSeries.slice(0, result.timeSeries.length / 2);
      const secondHalf = result.timeSeries.slice(result.timeSeries.length / 2);
      
      const firstHalfCivScore = firstHalf.reduce((s, d) => s + d.civScore, 0) / firstHalf.length;
      const secondHalfCivScore = secondHalf.reduce((s, d) => s + d.civScore, 0) / secondHalf.length;
      
      const trend = secondHalfCivScore - firstHalfCivScore;
      console.log(`  文明スコア傾向: ${trend > 0.1 ? '上昇' : trend < -0.1 ? '下降' : '安定'} (前半${firstHalfCivScore.toFixed(2)} → 後半${secondHalfCivScore.toFixed(2)})`);
      console.log('');
    }
  }
  
  // 結論
  console.log('\n=== 結論 ===\n');
  console.log('文明の持続性を検証しました。');
  console.log('4/4達成条件での長期シミュレーションの結果を確認してください。');
}

main().catch(console.error);
