/**
 * H64検証: 人口増加はArt/人を減少させる
 * 
 * 検証方法:
 * - 異なる初期人口でシミュレーションを実行
 * - 人口とArt/人の関係を分析
 * - アーティファクト生成能力の上限を探る
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface PopulationArtifactData {
  tick: number;
  population: number;
  artifactCount: number;
  artPerPop: number;
  artifactCreated: number;  // このtickで生成されたアーティファクト数
  artifactDecayed: number;  // このtickで消滅したアーティファクト数
}

function runSimulation(seed: number, initialPop: number, ticks: number): PopulationArtifactData[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 25,
      initialEntityCount: initialPop,
    },
    resourceRegenerationRate: 0.024,
  };

  const universe = new Universe(config);
  const data: PopulationArtifactData[] = [];
  const sampleInterval = 500;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const stats = universe.getStats();
      const events = universe.getEventLog();
      
      const artifactCreated = events.filter(e => e.type === 'artifactCreated').length;
      const artifactDecayed = events.filter(e => e.type === 'artifactDecayed').length;
      
      const artPerPop = stats.entityCount > 0 
        ? stats.artifactCount / stats.entityCount 
        : 0;
      
      data.push({
        tick: t + 1,
        population: stats.entityCount,
        artifactCount: stats.artifactCount,
        artPerPop,
        artifactCreated,
        artifactDecayed,
      });
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
console.log('=== H64検証: 人口増加はArt/人を減少させる ===\n');

const seeds = [42, 123, 456];
const initialPops = [20, 50, 100, 150];
const ticks = 20000;

const allResults: { seed: number; initialPop: number; data: PopulationArtifactData[] }[] = [];

for (const seed of seeds) {
  console.log(`=== Seed ${seed} ===\n`);
  
  for (const initialPop of initialPops) {
    const data = runSimulation(seed, initialPop, ticks);
    allResults.push({ seed, initialPop, data });
    
    if (data.length < 2) {
      console.log(`初期人口 ${initialPop}: データ不足\n`);
      continue;
    }
    
    // 平均値を計算
    const avgPop = data.reduce((s, d) => s + d.population, 0) / data.length;
    const avgArtPerPop = data.reduce((s, d) => s + d.artPerPop, 0) / data.length;
    const avgArtifactCreated = data.reduce((s, d) => s + d.artifactCreated, 0) / data.length;
    const avgArtifactDecayed = data.reduce((s, d) => s + d.artifactDecayed, 0) / data.length;
    
    // 人口とArt/人の相関
    const pops = data.map(d => d.population);
    const artPerPops = data.map(d => d.artPerPop);
    const corr = correlation(pops, artPerPops);
    
    console.log(`初期人口 ${initialPop}:`);
    console.log(`  平均人口: ${avgPop.toFixed(1)}`);
    console.log(`  平均Art/人: ${avgArtPerPop.toFixed(2)}`);
    console.log(`  平均生成/tick: ${avgArtifactCreated.toFixed(2)}`);
    console.log(`  平均消滅/tick: ${avgArtifactDecayed.toFixed(2)}`);
    console.log(`  人口-Art/人相関: ${corr.toFixed(3)}`);
    console.log();
  }
}

// 全体の傾向を分析
console.log('=== 全体の傾向分析 ===\n');

// 初期人口ごとの平均Art/人を集計
const popToArtPerPop: Map<number, number[]> = new Map();

for (const { initialPop, data } of allResults) {
  if (data.length === 0) continue;
  
  const avgArtPerPop = data.reduce((s, d) => s + d.artPerPop, 0) / data.length;
  
  if (!popToArtPerPop.has(initialPop)) {
    popToArtPerPop.set(initialPop, []);
  }
  popToArtPerPop.get(initialPop)!.push(avgArtPerPop);
}

console.log('初期人口 vs 平均Art/人:\n');
console.log('| 初期人口 | 平均Art/人 | 標準偏差 |');
console.log('|---------|-----------|---------|');

const sortedPops = Array.from(popToArtPerPop.keys()).sort((a, b) => a - b);
const avgArtPerPopByPop: number[] = [];

for (const pop of sortedPops) {
  const values = popToArtPerPop.get(pop)!;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
  avgArtPerPopByPop.push(avg);
  
  console.log(`| ${pop} | ${avg.toFixed(2)} | ${std.toFixed(2)} |`);
}

// 初期人口とArt/人の相関
const corrPopArtPerPop = correlation(sortedPops, avgArtPerPopByPop);
console.log(`\n初期人口とArt/人の相関: ${corrPopArtPerPop.toFixed(3)}`);

// 時系列での人口-Art/人相関を集計
const allCorrelations: number[] = [];
for (const { data } of allResults) {
  if (data.length < 2) continue;
  
  const pops = data.map(d => d.population);
  const artPerPops = data.map(d => d.artPerPop);
  const corr = correlation(pops, artPerPops);
  allCorrelations.push(corr);
}

const avgCorr = allCorrelations.reduce((s, v) => s + v, 0) / allCorrelations.length;
console.log(`時系列での人口-Art/人相関（平均）: ${avgCorr.toFixed(3)}`);

console.log('\n=== 結論 ===\n');

if (corrPopArtPerPop < -0.5 || avgCorr < -0.3) {
  console.log('H64を支持: 人口増加はArt/人を減少させる');
  console.log('→ 人口が多いほどArt/人が低い傾向');
  console.log('→ アーティファクト生成能力に上限がある');
} else if (corrPopArtPerPop > 0.5 || avgCorr > 0.3) {
  console.log('H64を棄却: 人口増加はArt/人を増加させる');
  console.log('→ 人口が多いほどArt/人が高い傾向');
  console.log('→ 規模の経済が働いている');
} else {
  console.log('H64は不明確: 人口とArt/人の関係は複雑');
  console.log('→ 初期人口による差は小さい');
  console.log('→ 他の要因が影響している可能性');
}

console.log('\n現世界との対応:');
console.log('- 人口と生産性: 人口増加が生産性に与える影響');
console.log('- 規模の経済 vs 規模の不経済: 組織の最適規模');
console.log('- 文明の成熟: 成熟した文明での生産性変化');
