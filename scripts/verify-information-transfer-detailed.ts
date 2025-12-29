/**
 * 情報伝達機能の詳細検証スクリプト
 * 
 * 検証項目:
 * 1. 長期シミュレーションでの情報蓄積パターン
 * 2. 知識ボーナスの効果（類似度の時間変化）
 * 3. 情報多様性の変化
 * 4. Q2（技術の蓄積）への影響
 */

import { Universe } from '../src/core/universe.js';

interface TimeSeriesPoint {
  tick: number;
  entityCount: number;
  artifactCount: number;
  avgStateFillRate: number;
  diversity: number;
  avgSimilarity: number;
  bonusAppliedCount: number;
  exchangeCount: number;
  inheritanceCount: number;
  acquisitionCount: number;
  repairCount: number;
}

interface SimulationResult {
  seed: number;
  timeSeries: TimeSeriesPoint[];
  finalStats: {
    entityCount: number;
    artifactCount: number;
    avgStateFillRate: number;
    diversity: number;
    totalExchange: number;
    totalInheritance: number;
    totalAcquisition: number;
    totalBonusApplied: number;
    totalRepair: number;
    avgSimilarity: number;
  };
}

function runDetailedSimulation(seed: number, ticks: number, sampleInterval: number): SimulationResult {
  const universe = new Universe({
    seed,
    worldGen: {
      nodeCount: 50,
      initialEntityCount: 30,
    },
    knowledgeBonusEnabled: true,
    resourceRegenerationRate: 0.024,  // 活発レジーム
  });

  const timeSeries: TimeSeriesPoint[] = [];
  let totalExchange = 0;
  let totalInheritance = 0;
  let totalAcquisition = 0;
  let totalBonusApplied = 0;
  let totalRepair = 0;
  let lastAvgSimilarity = 0;

  for (let i = 0; i < ticks; i++) {
    universe.step();
    const stats = universe.getStats();
    
    // 累積カウント
    if (stats.informationTransfer) {
      totalExchange += stats.informationTransfer.exchangeCount;
      totalInheritance += stats.informationTransfer.inheritanceCount;
      totalAcquisition += stats.informationTransfer.acquisitionCount;
    }
    if (stats.knowledge) {
      totalBonusApplied += stats.knowledge.bonusAppliedCount;
      totalRepair += stats.knowledge.repairCountThisTick;
      if (stats.knowledge.avgSimilarity > 0) {
        lastAvgSimilarity = stats.knowledge.avgSimilarity;
      }
    }

    // サンプリング
    if ((i + 1) % sampleInterval === 0) {
      timeSeries.push({
        tick: i + 1,
        entityCount: stats.entityCount,
        artifactCount: stats.artifactCount,
        avgStateFillRate: stats.informationTransfer?.avgStateFillRate ?? 0,
        diversity: stats.informationTransfer?.diversity ?? 0,
        avgSimilarity: stats.knowledge?.avgSimilarity ?? 0,
        bonusAppliedCount: stats.knowledge?.bonusAppliedCount ?? 0,
        exchangeCount: stats.informationTransfer?.exchangeCount ?? 0,
        inheritanceCount: stats.informationTransfer?.inheritanceCount ?? 0,
        acquisitionCount: stats.informationTransfer?.acquisitionCount ?? 0,
        repairCount: stats.knowledge?.repairCountThisTick ?? 0,
      });
    }
  }

  // 最終state充填率を計算
  const finalEntities = universe.getAllEntities();
  let finalTotalFillRate = 0;
  for (const entity of finalEntities) {
    const fillRate = entity.state.getData().length / entity.state.capacity;
    finalTotalFillRate += fillRate;
  }
  const avgStateFillRate = finalEntities.length > 0 
    ? finalTotalFillRate / finalEntities.length 
    : 0;

  return {
    seed,
    timeSeries,
    finalStats: {
      entityCount: finalEntities.length,
      artifactCount: universe.getStats().artifactCount,
      avgStateFillRate,
      diversity: universe.getStats().informationTransfer?.diversity ?? 0,
      totalExchange,
      totalInheritance,
      totalAcquisition,
      totalBonusApplied,
      totalRepair,
      avgSimilarity: lastAvgSimilarity,
    },
  };
}

// メイン実行
console.log('=== 情報伝達機能の詳細検証 ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 2000;  // 長期シミュレーション
const sampleInterval = 100;

const results: SimulationResult[] = [];

for (const seed of seeds) {
  console.log(`Seed ${seed} を実行中 (${ticks} ticks)...`);
  const result = runDetailedSimulation(seed, ticks, sampleInterval);
  results.push(result);
}

console.log('\n=== 最終統計 ===\n');

console.log('| Seed | 個体数 | Artifact | Fill率 | 多様性 | 交換 | 継承 | 取得 | ボーナス | 修復 | 類似度 |');
console.log('|------|--------|----------|--------|--------|------|------|------|----------|------|--------|');

for (const r of results) {
  const s = r.finalStats;
  console.log(
    `| ${r.seed} | ${s.entityCount} | ${s.artifactCount} | ${(s.avgStateFillRate * 100).toFixed(0)}% | ` +
    `${s.diversity} | ${s.totalExchange} | ${s.totalInheritance} | ${s.totalAcquisition} | ` +
    `${s.totalBonusApplied} | ${s.totalRepair} | ${s.avgSimilarity.toFixed(3)} |`
  );
}

// 時系列分析
console.log('\n=== 時系列分析（Seed 42）===\n');

const seed42 = results.find(r => r.seed === 42);
if (seed42) {
  console.log('| Tick | 個体 | Artifact | Fill率 | 多様性 | 交換 | 継承 | 取得 | 類似度 |');
  console.log('|------|------|----------|--------|--------|------|------|------|--------|');
  
  for (const point of seed42.timeSeries) {
    console.log(
      `| ${point.tick} | ${point.entityCount} | ${point.artifactCount} | ` +
      `${(point.avgStateFillRate * 100).toFixed(0)}% | ${point.diversity} | ` +
      `${point.exchangeCount} | ${point.inheritanceCount} | ${point.acquisitionCount} | ` +
      `${point.avgSimilarity.toFixed(3)} |`
    );
  }
}

// 集計分析
console.log('\n=== 集計分析 ===\n');

const avgEntityCount = results.reduce((sum, r) => sum + r.finalStats.entityCount, 0) / results.length;
const avgArtifactCount = results.reduce((sum, r) => sum + r.finalStats.artifactCount, 0) / results.length;
const avgFillRate = results.reduce((sum, r) => sum + r.finalStats.avgStateFillRate, 0) / results.length;
const avgDiversity = results.reduce((sum, r) => sum + r.finalStats.diversity, 0) / results.length;
const totalExchangeAll = results.reduce((sum, r) => sum + r.finalStats.totalExchange, 0);
const totalInheritanceAll = results.reduce((sum, r) => sum + r.finalStats.totalInheritance, 0);
const totalAcquisitionAll = results.reduce((sum, r) => sum + r.finalStats.totalAcquisition, 0);
const totalBonusAll = results.reduce((sum, r) => sum + r.finalStats.totalBonusApplied, 0);
const totalRepairAll = results.reduce((sum, r) => sum + r.finalStats.totalRepair, 0);

console.log(`平均個体数: ${avgEntityCount.toFixed(1)}`);
console.log(`平均Artifact数: ${avgArtifactCount.toFixed(1)}`);
console.log(`平均state充填率: ${(avgFillRate * 100).toFixed(1)}%`);
console.log(`平均情報多様性: ${avgDiversity.toFixed(1)}`);
console.log(`総情報交換回数: ${totalExchangeAll}`);
console.log(`総情報継承回数: ${totalInheritanceAll}`);
console.log(`総情報取得回数: ${totalAcquisitionAll}`);
console.log(`総ボーナス適用回数: ${totalBonusAll}`);
console.log(`総修復回数: ${totalRepairAll}`);
console.log(`ボーナス適用率: ${totalRepairAll > 0 ? (totalBonusAll / totalRepairAll * 100).toFixed(1) : 0}%`);

// 考察
console.log('\n=== 考察 ===\n');

// state充填率の変化
const initialFillRate = 0.5;  // 初期設定
const fillRateChange = avgFillRate - initialFillRate;
console.log(`state充填率の変化: ${initialFillRate * 100}% → ${(avgFillRate * 100).toFixed(1)}% (${fillRateChange > 0 ? '+' : ''}${(fillRateChange * 100).toFixed(1)}%)`);

if (fillRateChange > 0.1) {
  console.log('  → 情報取得により、エンティティのstate容量が増加している');
} else if (fillRateChange < -0.1) {
  console.log('  → 情報が失われている（世代交代による希釈？）');
} else {
  console.log('  → 情報量は概ね維持されている');
}

// 知識ボーナスの効果
const bonusRate = totalRepairAll > 0 ? totalBonusAll / totalRepairAll : 0;
console.log(`\n知識ボーナス適用率: ${(bonusRate * 100).toFixed(1)}%`);

if (bonusRate > 0.1) {
  console.log('  → 知識ボーナスが有効に機能している');
  console.log('  → エンティティのstateとアーティファクトのdataに類似性が生まれている');
} else if (bonusRate > 0) {
  console.log('  → 知識ボーナスは稀に適用されている');
  console.log('  → 類似性の発生は偶然に依存している可能性');
} else {
  console.log('  → 知識ボーナスは適用されていない');
  console.log('  → stateとdataの類似性が生まれていない');
}

// Q2への回答
console.log('\n=== Q2（技術の蓄積）への回答 ===\n');

if (totalAcquisitionAll > 0 && avgFillRate > initialFillRate) {
  console.log('情報伝達機能により、以下が観察された:');
  console.log(`  1. 情報取得: ${totalAcquisitionAll}回（アーティファクトからエンティティへ）`);
  console.log(`  2. 情報継承: ${totalInheritanceAll}回（親から子へ）`);
  console.log(`  3. 情報交換: ${totalExchangeAll}回（エンティティ間）`);
  console.log('');
  console.log('これは「技術の蓄積」の萌芽と言える:');
  console.log('  - アーティファクトに保存された情報が、修復を通じてエンティティに伝達される');
  console.log('  - エンティティの情報は、複製を通じて次世代に継承される');
  console.log('  - ただし、現時点では情報の「意味」は定義されていない');
} else {
  console.log('情報伝達は発生しているが、「技術の蓄積」と呼べるパターンは観察されなかった。');
}

console.log('\n=== 検証完了 ===');
