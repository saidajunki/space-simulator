/**
 * H2検証: 遺伝的多様性は時間とともに減少する
 * 
 * 検証方法:
 * - 長期シミュレーションで遺伝子（behaviorRule）の多様性を追跡
 * - 時間経過に伴う多様性の変化を分析
 * - 遺伝子間の距離（ユークリッド距離）を計算
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';
import { GENE_COUNT, ACTION_WEIGHT_COUNT } from '../src/core/behavior-rule.js';

interface DiversityData {
  tick: number;
  entityCount: number;
  avgGeneDistance: number;
  avgWeightDistance: number;
  geneVariance: number[];  // 各遺伝子の分散
  uniqueGenePatterns: number;  // ユニークな遺伝子パターン数
}

function calculateGeneDistance(genes1: Float32Array, genes2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < genes1.length; i++) {
    const diff = (genes1[i] ?? 0) - (genes2[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function calculateWeightDistance(weights1: Float32Array, weights2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < weights1.length; i++) {
    const diff = (weights1[i] ?? 0) - (weights2[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function calculateGeneVariance(entities: { genes: Float32Array }[]): number[] {
  if (entities.length === 0) return new Array(GENE_COUNT).fill(0);
  
  const variances: number[] = [];
  
  for (let g = 0; g < GENE_COUNT; g++) {
    const values = entities.map(e => e.genes[g] ?? 0);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    variances.push(variance);
  }
  
  return variances;
}

function countUniqueGenePatterns(entities: { genes: Float32Array }[]): number {
  const patterns = new Set<string>();
  
  for (const entity of entities) {
    // 遺伝子を量子化してパターンとして扱う（0.1刻み）
    const pattern = Array.from(entity.genes)
      .map(v => Math.round((v ?? 0) * 10))
      .join(',');
    patterns.add(pattern);
  }
  
  return patterns.size;
}

function runSimulation(seed: number, ticks: number): DiversityData[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 20,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: 0.020,
  };

  const universe = new Universe(config);
  const data: DiversityData[] = [];
  const sampleInterval = 500;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const entities = universe.getAllEntities();
      
      if (entities.length >= 2) {
        // 遺伝子情報を収集
        const geneData = entities.map(e => ({
          genes: e.behaviorRule.genes,
          weights: e.behaviorRule.actionWeights,
        }));
        
        // 平均遺伝子距離を計算（全ペアの平均）
        let totalGeneDistance = 0;
        let totalWeightDistance = 0;
        let pairCount = 0;
        
        for (let i = 0; i < geneData.length; i++) {
          for (let j = i + 1; j < geneData.length; j++) {
            totalGeneDistance += calculateGeneDistance(geneData[i]!.genes, geneData[j]!.genes);
            totalWeightDistance += calculateWeightDistance(geneData[i]!.weights, geneData[j]!.weights);
            pairCount++;
          }
        }
        
        const avgGeneDistance = pairCount > 0 ? totalGeneDistance / pairCount : 0;
        const avgWeightDistance = pairCount > 0 ? totalWeightDistance / pairCount : 0;
        
        // 遺伝子の分散を計算
        const geneVariance = calculateGeneVariance(geneData);
        
        // ユニークな遺伝子パターン数
        const uniqueGenePatterns = countUniqueGenePatterns(geneData);
        
        data.push({
          tick: t + 1,
          entityCount: entities.length,
          avgGeneDistance,
          avgWeightDistance,
          geneVariance,
          uniqueGenePatterns,
        });
      } else if (entities.length === 1) {
        data.push({
          tick: t + 1,
          entityCount: 1,
          avgGeneDistance: 0,
          avgWeightDistance: 0,
          geneVariance: new Array(GENE_COUNT).fill(0),
          uniqueGenePatterns: 1,
        });
      }
    }
    
    universe.clearEventLog();
  }

  return data;
}

// メイン実行
console.log('=== H2検証: 遺伝的多様性は時間とともに減少する ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 20000;

const allResults: { seed: number; data: DiversityData[] }[] = [];

for (const seed of seeds) {
  console.log(`=== Seed ${seed} ===\n`);
  const data = runSimulation(seed, ticks);
  allResults.push({ seed, data });
  
  if (data.length < 2) {
    console.log('データ不足（絶滅）\n');
    continue;
  }
  
  // 初期と最終の比較
  const initial = data[0]!;
  const final = data[data.length - 1]!;
  
  console.log(`初期 (tick ${initial.tick}):`);
  console.log(`  人口: ${initial.entityCount}`);
  console.log(`  平均遺伝子距離: ${initial.avgGeneDistance.toFixed(4)}`);
  console.log(`  平均重み距離: ${initial.avgWeightDistance.toFixed(4)}`);
  console.log(`  ユニークパターン数: ${initial.uniqueGenePatterns}`);
  
  console.log(`最終 (tick ${final.tick}):`);
  console.log(`  人口: ${final.entityCount}`);
  console.log(`  平均遺伝子距離: ${final.avgGeneDistance.toFixed(4)}`);
  console.log(`  平均重み距離: ${final.avgWeightDistance.toFixed(4)}`);
  console.log(`  ユニークパターン数: ${final.uniqueGenePatterns}`);
  
  const geneDistanceChange = ((final.avgGeneDistance - initial.avgGeneDistance) / initial.avgGeneDistance * 100);
  const weightDistanceChange = ((final.avgWeightDistance - initial.avgWeightDistance) / initial.avgWeightDistance * 100);
  const patternChange = ((final.uniqueGenePatterns - initial.uniqueGenePatterns) / initial.uniqueGenePatterns * 100);
  
  console.log(`変化:`);
  console.log(`  遺伝子距離: ${geneDistanceChange >= 0 ? '+' : ''}${geneDistanceChange.toFixed(1)}%`);
  console.log(`  重み距離: ${weightDistanceChange >= 0 ? '+' : ''}${weightDistanceChange.toFixed(1)}%`);
  console.log(`  パターン数: ${patternChange >= 0 ? '+' : ''}${patternChange.toFixed(1)}%\n`);
  
  // 時系列の傾向
  const midpoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);
  
  const avgFirstGene = firstHalf.reduce((s, d) => s + d.avgGeneDistance, 0) / firstHalf.length;
  const avgSecondGene = secondHalf.reduce((s, d) => s + d.avgGeneDistance, 0) / secondHalf.length;
  
  console.log(`前半平均遺伝子距離: ${avgFirstGene.toFixed(4)}`);
  console.log(`後半平均遺伝子距離: ${avgSecondGene.toFixed(4)}`);
  
  if (avgSecondGene < avgFirstGene * 0.9) {
    console.log('→ 遺伝的多様性が減少傾向（H2を支持）\n');
  } else if (avgSecondGene > avgFirstGene * 1.1) {
    console.log('→ 遺伝的多様性が増加傾向（H2を棄却）\n');
  } else {
    console.log('→ 遺伝的多様性は安定（H2は不明確）\n');
  }
}

// 全体の傾向を分析
console.log('=== 全体の傾向分析 ===\n');

let decreaseCount = 0;
let increaseCount = 0;
let stableCount = 0;

for (const { seed, data } of allResults) {
  if (data.length < 2) continue;
  
  const initial = data[0]!;
  const final = data[data.length - 1]!;
  
  const change = (final.avgGeneDistance - initial.avgGeneDistance) / initial.avgGeneDistance;
  
  if (change < -0.1) {
    decreaseCount++;
    console.log(`Seed ${seed}: 減少 (${(change * 100).toFixed(1)}%)`);
  } else if (change > 0.1) {
    increaseCount++;
    console.log(`Seed ${seed}: 増加 (${(change * 100).toFixed(1)}%)`);
  } else {
    stableCount++;
    console.log(`Seed ${seed}: 安定 (${(change * 100).toFixed(1)}%)`);
  }
}

console.log(`\n減少: ${decreaseCount}/${allResults.length}`);
console.log(`増加: ${increaseCount}/${allResults.length}`);
console.log(`安定: ${stableCount}/${allResults.length}`);

console.log('\n=== 結論 ===\n');

if (decreaseCount > increaseCount + stableCount) {
  console.log('H2を支持: 遺伝的多様性は時間とともに減少する傾向がある');
  console.log('→ 適応度の高い遺伝子が優勢になり、多様性が失われている');
} else if (increaseCount > decreaseCount + stableCount) {
  console.log('H2を棄却: 遺伝的多様性は時間とともに増加する傾向がある');
  console.log('→ 突然変異により多様性が維持・増加している');
} else if (stableCount >= decreaseCount && stableCount >= increaseCount) {
  console.log('H2は不明確: 遺伝的多様性は安定している');
  console.log('→ 選択圧と突然変異が均衡している可能性');
} else {
  console.log('H2は部分的に支持: 結果はseedに依存する');
  console.log('→ 環境条件や初期状態により多様性の変化パターンが異なる');
}

console.log('\n現世界との対応:');
console.log('- 遺伝的浮動: 小集団では偶然により多様性が変化');
console.log('- 選択圧: 適応度の高い遺伝子が広がる');
console.log('- 突然変異: 新しい変異が多様性を維持');
