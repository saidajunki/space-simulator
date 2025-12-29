/**
 * 情報伝達機能の検証スクリプト
 * 
 * 検証項目:
 * 1. 初期stateが生成されているか
 * 2. 情報交換が発生しているか
 * 3. 情報継承が発生しているか
 * 4. 情報取得が発生しているか
 * 5. 知識ボーナスが機能しているか
 */

import { Universe } from '../src/core/universe.js';
import { SimulationStats } from '../src/core/observation.js';

interface VerificationResult {
  seed: number;
  initialStateFillRate: number;
  finalStateFillRate: number;
  exchangeCount: number;
  inheritanceCount: number;
  acquisitionCount: number;
  diversity: number;
  avgSimilarity: number;
  bonusAppliedCount: number;
  repairCount: number;
  entityCount: number;
}

function runVerification(seed: number, ticks: number): VerificationResult {
  const universe = new Universe({
    seed,
    worldGen: {
      nodeCount: 50,
      initialEntityCount: 30,
    },
    knowledgeBonusEnabled: true,
    resourceRegenerationRate: 0.024,  // 活発レジーム
  });

  // 初期state充填率を確認
  const initialEntities = universe.getAllEntities();
  let initialTotalFillRate = 0;
  for (const entity of initialEntities) {
    const fillRate = entity.state.getData().length / entity.state.capacity;
    initialTotalFillRate += fillRate;
  }
  const initialStateFillRate = initialEntities.length > 0 
    ? initialTotalFillRate / initialEntities.length 
    : 0;

  // シミュレーション実行
  let totalExchangeCount = 0;
  let totalInheritanceCount = 0;
  let totalAcquisitionCount = 0;
  let totalBonusAppliedCount = 0;
  let totalRepairCount = 0;
  let lastStats: SimulationStats | null = null;

  for (let i = 0; i < ticks; i++) {
    universe.step();
    const stats = universe.getStats();
    lastStats = stats;
    
    if (stats.informationTransfer) {
      totalExchangeCount += stats.informationTransfer.exchangeCount;
      totalInheritanceCount += stats.informationTransfer.inheritanceCount;
      totalAcquisitionCount += stats.informationTransfer.acquisitionCount;
    }
    if (stats.knowledge) {
      totalBonusAppliedCount += stats.knowledge.bonusAppliedCount;
      totalRepairCount += stats.knowledge.repairCountThisTick;
    }
  }

  // 最終state充填率を確認
  const finalEntities = universe.getAllEntities();
  let finalTotalFillRate = 0;
  for (const entity of finalEntities) {
    const fillRate = entity.state.getData().length / entity.state.capacity;
    finalTotalFillRate += fillRate;
  }
  const finalStateFillRate = finalEntities.length > 0 
    ? finalTotalFillRate / finalEntities.length 
    : 0;

  return {
    seed,
    initialStateFillRate,
    finalStateFillRate,
    exchangeCount: totalExchangeCount,
    inheritanceCount: totalInheritanceCount,
    acquisitionCount: totalAcquisitionCount,
    diversity: lastStats?.informationTransfer?.diversity ?? 0,
    avgSimilarity: lastStats?.knowledge?.avgSimilarity ?? 0,
    bonusAppliedCount: totalBonusAppliedCount,
    repairCount: totalRepairCount,
    entityCount: finalEntities.length,
  };
}

// 複数シードで検証
console.log('=== 情報伝達機能の検証 ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 500;
const results: VerificationResult[] = [];

for (const seed of seeds) {
  console.log(`Seed ${seed} を実行中...`);
  const result = runVerification(seed, ticks);
  results.push(result);
}

console.log('\n=== 検証結果 ===\n');

// 結果表示
console.log('| Seed | 初期Fill | 最終Fill | 交換 | 継承 | 取得 | 多様性 | 平均類似度 | ボーナス | 修復 | 個体数 |');
console.log('|------|----------|----------|------|------|------|--------|------------|----------|------|--------|');

for (const r of results) {
  console.log(
    `| ${r.seed} | ${(r.initialStateFillRate * 100).toFixed(1)}% | ${(r.finalStateFillRate * 100).toFixed(1)}% | ` +
    `${r.exchangeCount} | ${r.inheritanceCount} | ${r.acquisitionCount} | ${r.diversity} | ` +
    `${r.avgSimilarity.toFixed(3)} | ${r.bonusAppliedCount} | ${r.repairCount} | ${r.entityCount} |`
  );
}

// 集計
const avgInitialFill = results.reduce((sum, r) => sum + r.initialStateFillRate, 0) / results.length;
const avgFinalFill = results.reduce((sum, r) => sum + r.finalStateFillRate, 0) / results.length;
const totalExchange = results.reduce((sum, r) => sum + r.exchangeCount, 0);
const totalInheritance = results.reduce((sum, r) => sum + r.inheritanceCount, 0);
const totalAcquisition = results.reduce((sum, r) => sum + r.acquisitionCount, 0);
const avgDiversity = results.reduce((sum, r) => sum + r.diversity, 0) / results.length;
const avgSimilarity = results.reduce((sum, r) => sum + r.avgSimilarity, 0) / results.length;
const totalBonus = results.reduce((sum, r) => sum + r.bonusAppliedCount, 0);
const totalRepair = results.reduce((sum, r) => sum + r.repairCount, 0);

console.log('\n=== 集計 ===\n');
console.log(`平均初期state充填率: ${(avgInitialFill * 100).toFixed(1)}%`);
console.log(`平均最終state充填率: ${(avgFinalFill * 100).toFixed(1)}%`);
console.log(`総情報交換回数: ${totalExchange}`);
console.log(`総情報継承回数: ${totalInheritance}`);
console.log(`総情報取得回数: ${totalAcquisition}`);
console.log(`平均情報多様性: ${avgDiversity.toFixed(1)}`);
console.log(`平均類似度: ${avgSimilarity.toFixed(3)}`);
console.log(`総ボーナス適用回数: ${totalBonus}`);
console.log(`総修復回数: ${totalRepair}`);

// 検証判定
console.log('\n=== 検証判定 ===\n');

const checks = [
  { name: '初期stateが生成されている', pass: avgInitialFill > 0.4 },
  { name: '情報交換が発生している', pass: totalExchange > 0 },
  { name: '情報継承が発生している', pass: totalInheritance > 0 },
  { name: '情報取得が発生している', pass: totalAcquisition > 0 },
  { name: '情報多様性がある', pass: avgDiversity > 1 },
  { name: '知識ボーナスが適用されている', pass: totalBonus > 0 || avgSimilarity > 0 },
];

for (const check of checks) {
  console.log(`${check.pass ? '✓' : '✗'} ${check.name}`);
}

const allPassed = checks.every(c => c.pass);
console.log(`\n総合結果: ${allPassed ? '✓ 全て合格' : '✗ 一部失敗'}`);
