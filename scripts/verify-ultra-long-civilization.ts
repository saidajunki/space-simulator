/**
 * 超長期文明シミュレーション検証
 * 
 * 目的: H48の検証 - 「文明の持続には適度な人口が必要」
 * 
 * 方法:
 * - 最適条件（ノード数12）で50,000 tickのシミュレーション
 * - 文明スコアの時系列変化を観察
 * - 「文明の罠」（成長→HHI低下→スコア低下）の発生を確認
 * - 人口とHHIの関係を分析
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface TimeSeriesData {
  tick: number;
  population: number;
  artifacts: number;
  artPerCapita: number;
  cooperationRate: number;
  hhi: number;
  civilizationScore: number;
  is4of4: boolean;
}

function runSimulation(seed: number): TimeSeriesData[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 12, // 最適値
      edgeDensity: 0.4,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: 0.024,
    toolEffectEnabled: true,
    knowledgeBonusEnabled: true,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  };
  
  const universe = new Universe(config);
  const timeSeries: TimeSeriesData[] = [];
  
  let totalCooperativeReplications = 0;
  let totalSoloReplications = 0;
  
  const TOTAL_TICKS = 50000;
  const SAMPLE_INTERVAL = 500; // 500 tickごとにサンプリング
  
  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    universe.step();
    
    // イベントから協力複製を集計
    const events = universe.getEventLog();
    for (const event of events) {
      if (event.type === 'partnerSelected') {
        totalCooperativeReplications++;
      }
      if (event.type === 'replication') {
        totalSoloReplications++;
      }
    }
    universe.clearEventLog();
    
    // サンプリング
    if (tick % SAMPLE_INTERVAL === 0 || tick === TOTAL_TICKS - 1) {
      const stats = universe.getStats();
      const population = stats.entityCount;
      const artifactCount = stats.artifactCount;
      const artPerCapita = population > 0 ? artifactCount / population : 0;
      
      // 協力率の計算
      const totalReplications = totalSoloReplications;
      const cooperationRate = totalReplications > 0 
        ? (totalCooperativeReplications / totalReplications) * 100 
        : 0;
      
      // HHIの計算
      let hhi = 0;
      if (population > 0) {
        const values = Array.from(stats.spatialDistribution.values());
        const shares = values.map(v => v / population);
        hhi = shares.reduce((sum, s) => sum + s * s, 0);
      }
      
      // 文明スコアの計算
      let civilizationScore = 0;
      if (population >= 10) civilizationScore++;
      if (artPerCapita >= 5) civilizationScore++;
      if (cooperationRate >= 50) civilizationScore++;
      if (hhi >= 0.15) civilizationScore++;
      
      timeSeries.push({
        tick,
        population,
        artifacts: artifactCount,
        artPerCapita,
        cooperationRate,
        hhi,
        civilizationScore,
        is4of4: civilizationScore === 4
      });
    }
  }
  
  return timeSeries;
}

function main() {
  console.log('=== 超長期文明シミュレーション検証 ===\n');
  console.log('目的: H48の検証 - 「文明の持続には適度な人口が必要」\n');
  console.log('条件:');
  console.log('- ノード数: 12（最適値）');
  console.log('- エッジ密度: 0.4');
  console.log('- 初期人口: 50');
  console.log('- 資源再生率: 0.024');
  console.log('- シミュレーション長: 50,000 tick\n');
  
  const seeds = [42, 123, 456, 789, 1000];
  const allResults: Map<number, TimeSeriesData[]> = new Map();
  
  for (const seed of seeds) {
    console.log(`Seed ${seed} を実行中...`);
    const timeSeries = runSimulation(seed);
    allResults.set(seed, timeSeries);
    
    // 最終状態を表示
    const final = timeSeries[timeSeries.length - 1];
    console.log(`  最終状態: Pop=${final.population}, Art/人=${final.artPerCapita.toFixed(1)}, ` +
      `Coop=${final.cooperationRate.toFixed(1)}%, HHI=${final.hhi.toFixed(3)}, Score=${final.civilizationScore}/4`);
  }
  
  console.log('\n=== 時系列分析 ===\n');
  
  // 各seedの4/4達成率を時間帯別に分析
  const timeWindows = [
    { name: '初期 (0-10k)', start: 0, end: 10000 },
    { name: '中期 (10k-25k)', start: 10000, end: 25000 },
    { name: '後期 (25k-40k)', start: 25000, end: 40000 },
    { name: '終期 (40k-50k)', start: 40000, end: 50000 }
  ];
  
  console.log('時間帯別 4/4達成率:');
  console.log('Seed\t' + timeWindows.map(w => w.name).join('\t'));
  
  for (const seed of seeds) {
    const timeSeries = allResults.get(seed)!;
    const rates: string[] = [];
    
    for (const window of timeWindows) {
      const windowData = timeSeries.filter(d => d.tick >= window.start && d.tick < window.end);
      const rate = windowData.length > 0 
        ? (windowData.filter(d => d.is4of4).length / windowData.length * 100).toFixed(1)
        : '0.0';
      rates.push(rate + '%');
    }
    
    console.log(`${seed}\t${rates.join('\t')}`);
  }
  
  // 人口とHHIの関係を分析
  console.log('\n=== 人口とHHIの関係 ===\n');
  
  const allDataPoints: { population: number; hhi: number }[] = [];
  for (const timeSeries of allResults.values()) {
    for (const data of timeSeries) {
      if (data.population > 0) {
        allDataPoints.push({ population: data.population, hhi: data.hhi });
      }
    }
  }
  
  // 人口帯別のHHI平均
  const populationBands = [
    { name: '1-10', min: 1, max: 10 },
    { name: '11-20', min: 11, max: 20 },
    { name: '21-30', min: 21, max: 30 },
    { name: '31-40', min: 31, max: 40 },
    { name: '41+', min: 41, max: Infinity }
  ];
  
  console.log('人口帯\t平均HHI\tサンプル数\t4/4達成可能');
  for (const band of populationBands) {
    const bandData = allDataPoints.filter(d => d.population >= band.min && d.population <= band.max);
    if (bandData.length > 0) {
      const avgHHI = bandData.reduce((sum, d) => sum + d.hhi, 0) / bandData.length;
      const canAchieve = avgHHI >= 0.15 ? '✓' : '✗';
      console.log(`${band.name}\t${avgHHI.toFixed(3)}\t${bandData.length}\t${canAchieve}`);
    }
  }
  
  // 相関分析
  const n = allDataPoints.length;
  const sumX = allDataPoints.reduce((sum, d) => sum + d.population, 0);
  const sumY = allDataPoints.reduce((sum, d) => sum + d.hhi, 0);
  const sumXY = allDataPoints.reduce((sum, d) => sum + d.population * d.hhi, 0);
  const sumX2 = allDataPoints.reduce((sum, d) => sum + d.population * d.population, 0);
  const sumY2 = allDataPoints.reduce((sum, d) => sum + d.hhi * d.hhi, 0);
  
  const correlation = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  console.log(`\n人口-HHI相関係数: ${correlation.toFixed(3)}`);
  
  // 文明の罠の検出
  console.log('\n=== 「文明の罠」の検出 ===\n');
  
  for (const seed of seeds) {
    const timeSeries = allResults.get(seed)!;
    
    // 4/4達成後に3/4以下に落ちたケースを検出
    let trapCount = 0;
    let was4of4 = false;
    
    for (const data of timeSeries) {
      if (data.is4of4) {
        was4of4 = true;
      } else if (was4of4 && data.civilizationScore < 4) {
        trapCount++;
        was4of4 = false; // リセット
      }
    }
    
    // 最大人口と最大HHIのtickを特定
    const maxPopData = timeSeries.reduce((max, d) => d.population > max.population ? d : max);
    const maxHHIData = timeSeries.reduce((max, d) => d.hhi > max.hhi ? d : max);
    
    console.log(`Seed ${seed}:`);
    console.log(`  文明の罠発生回数: ${trapCount}`);
    console.log(`  最大人口: ${maxPopData.population} (tick ${maxPopData.tick})`);
    console.log(`  最大HHI: ${maxHHIData.hhi.toFixed(3)} (tick ${maxHHIData.tick})`);
    console.log(`  最終スコア: ${timeSeries[timeSeries.length - 1].civilizationScore}/4`);
  }
  
  // 結論
  console.log('\n=== 結論 ===\n');
  
  // 全体の4/4達成率
  let total4of4 = 0;
  let totalSamples = 0;
  for (const timeSeries of allResults.values()) {
    total4of4 += timeSeries.filter(d => d.is4of4).length;
    totalSamples += timeSeries.length;
  }
  const overall4of4Rate = (total4of4 / totalSamples * 100).toFixed(1);
  
  console.log(`全体の4/4達成率: ${overall4of4Rate}%`);
  console.log(`人口-HHI相関: ${correlation.toFixed(3)} (${correlation < -0.3 ? '負の相関あり' : '相関弱い'})`);
  
  if (correlation < -0.3) {
    console.log('\n→ H48を支持: 人口が増えるとHHIが低下し、文明スコアが下がる傾向がある');
    console.log('→ 「文明の罠」は実在する: 成長が文明維持を阻害する');
  } else {
    console.log('\n→ H48は不明確: 人口とHHIの関係は弱い');
  }
}

main();
