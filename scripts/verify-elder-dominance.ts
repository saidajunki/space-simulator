/**
 * H63検証: 超長期では「長老」が集団を支配するか
 * 
 * 仮説: 100,000 tickのシミュレーションで、長寿個体の遺伝子が集団に広がり、
 * 世代交代が極端に遅くなる可能性がある。
 * 
 * 検証方法:
 * 1. 超長期シミュレーション（50,000 tick）を実行
 * 2. 長老（上位10%の年齢）の特性を分析
 * 3. 長老の遺伝子が集団に広がっているか確認
 * 4. 世代交代率の時間変化を追跡
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface ElderAnalysis {
  tick: number;
  population: number;
  avgAge: number;
  maxAge: number;
  elderCount: number;  // 上位10%の年齢の個体数
  elderAvgAge: number;
  elderShareOfPop: number;  // 長老が占める割合
  birthCount: number;  // このtickでの出生数
  deathCount: number;  // このtickでの死亡数
  generationTurnover: number;  // 世代交代率 = 出生数 / 人口
  elderGenesSimilarity: number;  // 長老の遺伝子と集団平均の類似度
  youngestAge: number;  // 最年少の年齢
  ageVariance: number;  // 年齢の分散
}

function calculateGeneDistance(genes1: Float32Array, genes2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < genes1.length; i++) {
    const diff = (genes1[i] ?? 0) - (genes2[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function runSimulation(seed: number, ticks: number): ElderAnalysis[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 20,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: 0.020,
  };

  const universe = new Universe(config);
  const analyses: ElderAnalysis[] = [];
  const sampleInterval = 2500;  // 2500 tick間隔
  
  let prevPopulation = 50;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const entities = universe.getAllEntities();
      const events = universe.getEventLog();
      
      // 出生・死亡カウント（直近のサンプル間隔）
      const birthCount = events.filter(e => e.type === 'replication').length;
      const deathCount = events.filter(e => e.type === 'death').length;
      
      if (entities.length >= 2) {
        // 年齢でソート
        const sortedByAge = [...entities].sort((a, b) => b.age - a.age);
        const ages = sortedByAge.map(e => e.age);
        
        // 基本統計
        const avgAge = ages.reduce((s, a) => s + a, 0) / ages.length;
        const maxAge = ages[0]!;
        const youngestAge = ages[ages.length - 1]!;
        
        // 年齢の分散
        const ageVariance = ages.reduce((s, a) => s + (a - avgAge) ** 2, 0) / ages.length;
        
        // 長老（上位10%）の分析
        const elderThreshold = Math.max(1, Math.floor(entities.length * 0.1));
        const elders = sortedByAge.slice(0, elderThreshold);
        const elderAvgAge = elders.reduce((s, e) => s + e.age, 0) / elders.length;
        
        // 長老の遺伝子と集団平均の類似度
        // 集団の平均遺伝子を計算
        const geneLength = entities[0]!.behaviorRule.genes.length;
        const avgGenes = new Float32Array(geneLength);
        for (const entity of entities) {
          for (let i = 0; i < geneLength; i++) {
            avgGenes[i]! += entity.behaviorRule.genes[i]! / entities.length;
          }
        }
        
        // 長老の遺伝子と集団平均の距離
        let elderSimilarity = 0;
        for (const elder of elders) {
          const distance = calculateGeneDistance(elder.behaviorRule.genes, avgGenes);
          elderSimilarity += 1 / (1 + distance);  // 距離が小さいほど類似度が高い
        }
        elderSimilarity /= elders.length;
        
        analyses.push({
          tick: t + 1,
          population: entities.length,
          avgAge,
          maxAge,
          elderCount: elders.length,
          elderAvgAge,
          elderShareOfPop: elders.length / entities.length,
          birthCount,
          deathCount,
          generationTurnover: entities.length > 0 ? birthCount / entities.length : 0,
          elderGenesSimilarity: elderSimilarity,
          youngestAge,
          ageVariance,
        });
      } else if (entities.length === 1) {
        analyses.push({
          tick: t + 1,
          population: 1,
          avgAge: entities[0]!.age,
          maxAge: entities[0]!.age,
          elderCount: 1,
          elderAvgAge: entities[0]!.age,
          elderShareOfPop: 1,
          birthCount,
          deathCount,
          generationTurnover: birthCount,
          elderGenesSimilarity: 1,
          youngestAge: entities[0]!.age,
          ageVariance: 0,
        });
      } else {
        analyses.push({
          tick: t + 1,
          population: 0,
          avgAge: 0,
          maxAge: 0,
          elderCount: 0,
          elderAvgAge: 0,
          elderShareOfPop: 0,
          birthCount,
          deathCount,
          generationTurnover: 0,
          elderGenesSimilarity: 0,
          youngestAge: 0,
          ageVariance: 0,
        });
      }
      
      prevPopulation = entities.length;
    }
    
    universe.clearEventLog();
  }

  return analyses;
}

// 相関係数を計算
function correlation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  
  const avgX = x.reduce((s, v) => s + v, 0) / n;
  const avgY = y.reduce((s, v) => s + v, 0) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - avgX;
    const dy = y[i]! - avgY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denom = Math.sqrt(denomX * denomY);
  return denom > 0 ? numerator / denom : 0;
}

// メイン実行
console.log('=== H63検証: 超長期では「長老」が集団を支配するか ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 50000;

interface SeedResult {
  seed: number;
  avgAgeIncrease: number;
  maxAgeIncrease: number;
  generationTurnoverDecrease: number;
  elderSimilarityIncrease: number;
  ageVarianceIncrease: number;
  timeVsAvgAgeCorr: number;
  timeVsGenTurnoverCorr: number;
}

const results: SeedResult[] = [];

for (const seed of seeds) {
  console.log(`=== Seed ${seed} (${ticks.toLocaleString()} tick) ===\n`);
  const analyses = runSimulation(seed, ticks);
  
  if (analyses.length < 2) {
    console.log('データ不足\n');
    continue;
  }
  
  // 前半と後半の比較
  const half = Math.floor(analyses.length / 2);
  const firstHalf = analyses.slice(0, half);
  const secondHalf = analyses.slice(half);
  
  const firstAvgAge = firstHalf.reduce((s, a) => s + a.avgAge, 0) / firstHalf.length;
  const secondAvgAge = secondHalf.reduce((s, a) => s + a.avgAge, 0) / secondHalf.length;
  
  const firstMaxAge = firstHalf.reduce((s, a) => s + a.maxAge, 0) / firstHalf.length;
  const secondMaxAge = secondHalf.reduce((s, a) => s + a.maxAge, 0) / secondHalf.length;
  
  const firstGenTurnover = firstHalf.reduce((s, a) => s + a.generationTurnover, 0) / firstHalf.length;
  const secondGenTurnover = secondHalf.reduce((s, a) => s + a.generationTurnover, 0) / secondHalf.length;
  
  const firstElderSim = firstHalf.reduce((s, a) => s + a.elderGenesSimilarity, 0) / firstHalf.length;
  const secondElderSim = secondHalf.reduce((s, a) => s + a.elderGenesSimilarity, 0) / secondHalf.length;
  
  const firstAgeVar = firstHalf.reduce((s, a) => s + a.ageVariance, 0) / firstHalf.length;
  const secondAgeVar = secondHalf.reduce((s, a) => s + a.ageVariance, 0) / secondHalf.length;
  
  // 時系列相関
  const ticks_arr = analyses.map(a => a.tick);
  const avgAges = analyses.map(a => a.avgAge);
  const genTurnovers = analyses.map(a => a.generationTurnover);
  
  const timeVsAvgAgeCorr = correlation(ticks_arr, avgAges);
  const timeVsGenTurnoverCorr = correlation(ticks_arr, genTurnovers);
  
  console.log('前半 vs 後半の比較:\n');
  console.log('| 指標 | 前半 | 後半 | 変化 |');
  console.log('|------|------|------|------|');
  console.log(`| 平均年齢 | ${firstAvgAge.toFixed(0)} | ${secondAvgAge.toFixed(0)} | ${((secondAvgAge - firstAvgAge) / firstAvgAge * 100).toFixed(1)}% |`);
  console.log(`| 最大年齢 | ${firstMaxAge.toFixed(0)} | ${secondMaxAge.toFixed(0)} | ${((secondMaxAge - firstMaxAge) / firstMaxAge * 100).toFixed(1)}% |`);
  console.log(`| 世代交代率 | ${firstGenTurnover.toFixed(4)} | ${secondGenTurnover.toFixed(4)} | ${((secondGenTurnover - firstGenTurnover) / firstGenTurnover * 100).toFixed(1)}% |`);
  console.log(`| 長老遺伝子類似度 | ${firstElderSim.toFixed(4)} | ${secondElderSim.toFixed(4)} | ${((secondElderSim - firstElderSim) / firstElderSim * 100).toFixed(1)}% |`);
  console.log(`| 年齢分散 | ${firstAgeVar.toFixed(0)} | ${secondAgeVar.toFixed(0)} | ${((secondAgeVar - firstAgeVar) / firstAgeVar * 100).toFixed(1)}% |`);
  
  console.log(`\n時系列相関:`);
  console.log(`  時間 vs 平均年齢: ${timeVsAvgAgeCorr.toFixed(3)}`);
  console.log(`  時間 vs 世代交代率: ${timeVsGenTurnoverCorr.toFixed(3)}`);
  
  // 最終状態の詳細
  const final = analyses[analyses.length - 1]!;
  console.log(`\n最終状態 (tick ${final.tick}):`);
  console.log(`  人口: ${final.population}`);
  console.log(`  平均年齢: ${final.avgAge.toFixed(0)}`);
  console.log(`  最大年齢: ${final.maxAge}`);
  console.log(`  最年少年齢: ${final.youngestAge}`);
  console.log(`  長老数: ${final.elderCount}`);
  console.log(`  長老平均年齢: ${final.elderAvgAge.toFixed(0)}`);
  console.log(`  長老遺伝子類似度: ${final.elderGenesSimilarity.toFixed(4)}`);
  console.log(`  世代交代率: ${final.generationTurnover.toFixed(4)}`);
  console.log();
  
  results.push({
    seed,
    avgAgeIncrease: (secondAvgAge - firstAvgAge) / firstAvgAge * 100,
    maxAgeIncrease: (secondMaxAge - firstMaxAge) / firstMaxAge * 100,
    generationTurnoverDecrease: (secondGenTurnover - firstGenTurnover) / firstGenTurnover * 100,
    elderSimilarityIncrease: (secondElderSim - firstElderSim) / firstElderSim * 100,
    ageVarianceIncrease: (secondAgeVar - firstAgeVar) / firstAgeVar * 100,
    timeVsAvgAgeCorr,
    timeVsGenTurnoverCorr,
  });
}

// 総合分析
console.log('=== 総合分析 ===\n');

// 有効な結果のみをフィルタ（NaNを除外）
const validResults = results.filter(r => 
  !isNaN(r.avgAgeIncrease) && 
  !isNaN(r.maxAgeIncrease) && 
  !isNaN(r.generationTurnoverDecrease) &&
  !isNaN(r.elderSimilarityIncrease) &&
  !isNaN(r.ageVarianceIncrease)
);

console.log(`有効なseed数: ${validResults.length}/${results.length}\n`);

if (validResults.length > 0) {
  const avgAgeIncreaseAvg = validResults.reduce((s, r) => s + r.avgAgeIncrease, 0) / validResults.length;
  const maxAgeIncreaseAvg = validResults.reduce((s, r) => s + r.maxAgeIncrease, 0) / validResults.length;
  const genTurnoverDecreaseAvg = validResults.reduce((s, r) => s + r.generationTurnoverDecrease, 0) / validResults.length;
  const elderSimIncreaseAvg = validResults.reduce((s, r) => s + r.elderSimilarityIncrease, 0) / validResults.length;
  const ageVarIncreaseAvg = validResults.reduce((s, r) => s + r.ageVarianceIncrease, 0) / validResults.length;
  const timeVsAvgAgeCorrAvg = validResults.reduce((s, r) => s + r.timeVsAvgAgeCorr, 0) / validResults.length;
  const timeVsGenTurnoverCorrAvg = validResults.reduce((s, r) => s + r.timeVsGenTurnoverCorr, 0) / validResults.length;
  
  console.log('| 指標 | 平均変化 | 解釈 |');
  console.log('|------|---------|------|');
  console.log(`| 平均年齢増加 | ${avgAgeIncreaseAvg.toFixed(1)}% | ${avgAgeIncreaseAvg > 20 ? '長寿化が進行' : '変化なし'} |`);
  console.log(`| 最大年齢増加 | ${maxAgeIncreaseAvg.toFixed(1)}% | ${maxAgeIncreaseAvg > 50 ? '長老が出現' : '変化なし'} |`);
  console.log(`| 世代交代率変化 | ${genTurnoverDecreaseAvg.toFixed(1)}% | ${genTurnoverDecreaseAvg < -20 ? '世代交代が減少' : '変化なし'} |`);
  console.log(`| 長老遺伝子類似度変化 | ${elderSimIncreaseAvg.toFixed(1)}% | ${elderSimIncreaseAvg > 5 ? '長老の遺伝子が広がる' : '変化なし'} |`);
  console.log(`| 年齢分散変化 | ${ageVarIncreaseAvg.toFixed(1)}% | ${ageVarIncreaseAvg > 50 ? '年齢格差が拡大' : '変化なし'} |`);
  
  console.log(`\n時系列相関（平均）:`);
  console.log(`  時間 vs 平均年齢: ${timeVsAvgAgeCorrAvg.toFixed(3)} (${timeVsAvgAgeCorrAvg > 0.3 ? '正の相関' : timeVsAvgAgeCorrAvg < -0.3 ? '負の相関' : '弱い相関'})`);
  console.log(`  時間 vs 世代交代率: ${timeVsGenTurnoverCorrAvg.toFixed(3)} (${timeVsGenTurnoverCorrAvg > 0.3 ? '正の相関' : timeVsGenTurnoverCorrAvg < -0.3 ? '負の相関' : '弱い相関'})`);
  
  // H63の判定
  console.log('\n=== H63の判定 ===\n');
  
  const elderDominanceIndicators = [
    avgAgeIncreaseAvg > 20,  // 平均年齢が20%以上増加
    maxAgeIncreaseAvg > 50,  // 最大年齢が50%以上増加
    genTurnoverDecreaseAvg < -20,  // 世代交代率が20%以上減少
    elderSimIncreaseAvg > 5,  // 長老の遺伝子類似度が5%以上増加
    timeVsAvgAgeCorrAvg > 0.3,  // 時間と平均年齢に正の相関
  ];
  
  const supportCount = elderDominanceIndicators.filter(x => x).length;
  
  console.log(`支持する指標: ${supportCount}/5`);
  console.log(`  - 平均年齢増加 > 20%: ${avgAgeIncreaseAvg > 20 ? '✓' : '✗'} (${avgAgeIncreaseAvg.toFixed(1)}%)`);
  console.log(`  - 最大年齢増加 > 50%: ${maxAgeIncreaseAvg > 50 ? '✓' : '✗'} (${maxAgeIncreaseAvg.toFixed(1)}%)`);
  console.log(`  - 世代交代率減少 > 20%: ${genTurnoverDecreaseAvg < -20 ? '✓' : '✗'} (${genTurnoverDecreaseAvg.toFixed(1)}%)`);
  console.log(`  - 長老遺伝子類似度増加 > 5%: ${elderSimIncreaseAvg > 5 ? '✓' : '✗'} (${elderSimIncreaseAvg.toFixed(1)}%)`);
  console.log(`  - 時間-平均年齢相関 > 0.3: ${timeVsAvgAgeCorrAvg > 0.3 ? '✓' : '✗'} (${timeVsAvgAgeCorrAvg.toFixed(3)})`);
  
  if (supportCount >= 4) {
    console.log('\n結論: H63を**支持**。超長期では長老が集団を支配する傾向がある。');
  } else if (supportCount >= 2) {
    console.log('\n結論: H63を**部分的に支持**。長老の影響は見られるが、「支配」とまでは言えない。');
  } else {
    console.log('\n結論: H63を**棄却**。長老が集団を支配する傾向は観察されない。');
  }
}
