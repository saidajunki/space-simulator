/**
 * H4検証: 長寿化は進化を遅くする
 * 
 * 検証方法:
 * - 平均年齢と遺伝子変化率の相関を分析
 * - 世代交代が少ないと遺伝的変異の機会が減少するか
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';
import { GENE_COUNT } from '../src/core/behavior-rule.js';

interface EvolutionData {
  tick: number;
  avgAge: number;
  births: number;
  deaths: number;
  generationTurnover: number;  // births / population
  geneChangeRate: number;  // 遺伝子変化率
  avgGeneDistance: number;
}

function calculateGeneDistance(genes1: Float32Array, genes2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < genes1.length; i++) {
    const diff = (genes1[i] ?? 0) - (genes2[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function runSimulation(seed: number, ticks: number): EvolutionData[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 20,
      initialEntityCount: 50,
    },
    resourceRegenerationRate: 0.020,
  };

  const universe = new Universe(config);
  const data: EvolutionData[] = [];
  const sampleInterval = 500;
  
  // 前回の遺伝子状態を保存
  let prevGenes: Map<string, Float32Array> = new Map();
  for (const entity of universe.getAllEntities()) {
    prevGenes.set(entity.id, new Float32Array(entity.behaviorRule.genes));
  }

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const entities = universe.getAllEntities();
      const events = universe.getEventLog();
      
      // 出生・死亡をカウント
      const births = events.filter(e => e.type === 'entityCreated').length;
      const deaths = events.filter(e => e.type === 'entityDied').length;
      
      if (entities.length >= 2) {
        // 平均年齢
        const avgAge = entities.reduce((s, e) => s + e.age, 0) / entities.length;
        
        // 世代交代率
        const generationTurnover = births / entities.length;
        
        // 遺伝子変化率（生存者の遺伝子がどれだけ変化したか）
        let totalChange = 0;
        let changeCount = 0;
        const currentGenes: Map<string, Float32Array> = new Map();
        
        for (const entity of entities) {
          currentGenes.set(entity.id, new Float32Array(entity.behaviorRule.genes));
          
          const prev = prevGenes.get(entity.id);
          if (prev) {
            const distance = calculateGeneDistance(prev, entity.behaviorRule.genes);
            totalChange += distance;
            changeCount++;
          }
        }
        
        const geneChangeRate = changeCount > 0 ? totalChange / changeCount : 0;
        
        // 平均遺伝子距離（集団内の多様性）
        let totalDistance = 0;
        let pairCount = 0;
        const geneList = Array.from(currentGenes.values());
        
        for (let i = 0; i < geneList.length; i++) {
          for (let j = i + 1; j < geneList.length; j++) {
            totalDistance += calculateGeneDistance(geneList[i]!, geneList[j]!);
            pairCount++;
          }
        }
        
        const avgGeneDistance = pairCount > 0 ? totalDistance / pairCount : 0;
        
        data.push({
          tick: t + 1,
          avgAge,
          births,
          deaths,
          generationTurnover,
          geneChangeRate,
          avgGeneDistance,
        });
        
        prevGenes = currentGenes;
      }
    }
    
    universe.clearEventLog();
  }

  return data;
}

// 相関係数を計算
function correlation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denom = Math.sqrt(denomX * denomY);
  return denom > 0 ? numerator / denom : 0;
}

// メイン実行
console.log('=== H4検証: 長寿化は進化を遅くする ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 20000;

const allResults: { seed: number; data: EvolutionData[] }[] = [];

for (const seed of seeds) {
  console.log(`=== Seed ${seed} ===\n`);
  const data = runSimulation(seed, ticks);
  allResults.push({ seed, data });
  
  if (data.length < 4) {
    console.log('データ不足\n');
    continue;
  }
  
  // 平均年齢と世代交代率の相関
  const ages = data.map(d => d.avgAge);
  const turnovers = data.map(d => d.generationTurnover);
  const geneChanges = data.map(d => d.geneChangeRate);
  const diversities = data.map(d => d.avgGeneDistance);
  
  const corrAgeTurnover = correlation(ages, turnovers);
  const corrAgeGeneChange = correlation(ages, geneChanges);
  const corrTurnoverDiversity = correlation(turnovers, diversities);
  
  console.log(`データポイント数: ${data.length}`);
  console.log(`平均年齢範囲: ${Math.min(...ages).toFixed(0)} - ${Math.max(...ages).toFixed(0)}`);
  console.log(`世代交代率範囲: ${Math.min(...turnovers).toFixed(3)} - ${Math.max(...turnovers).toFixed(3)}`);
  console.log();
  console.log(`相関係数:`);
  console.log(`  平均年齢 vs 世代交代率: ${corrAgeTurnover.toFixed(3)}`);
  console.log(`  平均年齢 vs 遺伝子変化率: ${corrAgeGeneChange.toFixed(3)}`);
  console.log(`  世代交代率 vs 遺伝的多様性: ${corrTurnoverDiversity.toFixed(3)}`);
  
  // 前半と後半の比較
  const midpoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);
  
  const avgAgeFirst = firstHalf.reduce((s, d) => s + d.avgAge, 0) / firstHalf.length;
  const avgAgeSecond = secondHalf.reduce((s, d) => s + d.avgAge, 0) / secondHalf.length;
  const avgTurnoverFirst = firstHalf.reduce((s, d) => s + d.generationTurnover, 0) / firstHalf.length;
  const avgTurnoverSecond = secondHalf.reduce((s, d) => s + d.generationTurnover, 0) / secondHalf.length;
  
  console.log();
  console.log(`前半 vs 後半:`);
  console.log(`  平均年齢: ${avgAgeFirst.toFixed(0)} → ${avgAgeSecond.toFixed(0)} (${((avgAgeSecond - avgAgeFirst) / avgAgeFirst * 100).toFixed(1)}%)`);
  console.log(`  世代交代率: ${avgTurnoverFirst.toFixed(3)} → ${avgTurnoverSecond.toFixed(3)} (${((avgTurnoverSecond - avgTurnoverFirst) / avgTurnoverFirst * 100).toFixed(1)}%)`);
  
  if (corrAgeTurnover < -0.3) {
    console.log('\n→ 長寿化と世代交代率に負の相関（H4を支持）');
  } else if (corrAgeTurnover > 0.3) {
    console.log('\n→ 長寿化と世代交代率に正の相関（H4を棄却）');
  } else {
    console.log('\n→ 長寿化と世代交代率に明確な相関なし');
  }
  console.log();
}

// 全体の傾向を分析
console.log('=== 全体の傾向分析 ===\n');

let supportCount = 0;
let rejectCount = 0;
let unclearCount = 0;

const allCorrelations: number[] = [];

for (const { seed, data } of allResults) {
  if (data.length < 4) continue;
  
  const ages = data.map(d => d.avgAge);
  const turnovers = data.map(d => d.generationTurnover);
  const corr = correlation(ages, turnovers);
  allCorrelations.push(corr);
  
  if (corr < -0.3) {
    supportCount++;
    console.log(`Seed ${seed}: 負の相関 (${corr.toFixed(3)}) → H4を支持`);
  } else if (corr > 0.3) {
    rejectCount++;
    console.log(`Seed ${seed}: 正の相関 (${corr.toFixed(3)}) → H4を棄却`);
  } else {
    unclearCount++;
    console.log(`Seed ${seed}: 弱い相関 (${corr.toFixed(3)}) → 不明確`);
  }
}

const avgCorr = allCorrelations.reduce((s, v) => s + v, 0) / allCorrelations.length;

console.log(`\n平均相関係数: ${avgCorr.toFixed(3)}`);
console.log(`支持: ${supportCount}/${allResults.length}`);
console.log(`棄却: ${rejectCount}/${allResults.length}`);
console.log(`不明確: ${unclearCount}/${allResults.length}`);

console.log('\n=== 結論 ===\n');

if (avgCorr < -0.3 || supportCount > rejectCount + unclearCount) {
  console.log('H4を支持: 長寿化は進化を遅くする');
  console.log('→ 平均年齢が高いほど世代交代率が低く、遺伝的変異の機会が減少');
} else if (avgCorr > 0.3 || rejectCount > supportCount + unclearCount) {
  console.log('H4を棄却: 長寿化は進化を遅くしない');
  console.log('→ 平均年齢と世代交代率に正の相関、または無相関');
} else {
  console.log('H4は不明確: 結果はseedに依存する');
  console.log('→ 環境条件により長寿化と進化速度の関係が異なる');
}

console.log('\n現世界との対応:');
console.log('- 長寿化と進化速度: 世代時間が長いほど進化が遅い');
console.log('- 象 vs ネズミ: 世代時間の違いが進化速度に影響');
console.log('- 人類の進化: 長寿化により自然選択の圧力が弱まる');
