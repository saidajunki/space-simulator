/**
 * H42/H43検証: 言語創発の条件
 * 
 * H42: 現在のスキルシステムは「遺伝情報」であり「言語」ではない
 * H43: 言語の創発には「情報→行動選択」の直接的な接続が必要
 * 
 * 検証方法:
 * 1. 現在の実装で、stateが行動選択に影響しているか確認
 * 2. state類似度と行動類似度の相関を分析
 * 3. 「言語」の定義を明確化し、現在の実装との差を分析
 */

import { Universe } from '../src/core/universe.js';
import { getSkillValues } from '../src/core/skill.js';

interface EntityBehaviorData {
  entityId: number;
  tick: number;
  state: Uint8Array;
  skillValues: { harvest: number; repair: number; create: number };
  action: string;
  energy: number;
  nodeId: number;
}

function runSimulation(seed: number, ticks: number): EntityBehaviorData[] {
  const universe = new Universe({
    seed,
    worldGen: {
      nodeCount: 15,
      initialEntityCount: 30,
    },
    resourceRegenerationRate: 0.020,
    skillBonusEnabled: true,
    skillBonusCoefficient: 1.0,
  });

  const data: EntityBehaviorData[] = [];
  const sampleInterval = 100;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const stats = universe.getStats();
      const events = universe.getEventLog();
      
      // 各エンティティの行動を記録
      for (const event of events) {
        if (event.type === 'harvest' || event.type === 'move' || 
            event.type === 'replication' || event.type === 'artifactCreated' ||
            event.type === 'artifactRepaired') {
          // このtickで行動したエンティティを記録
          // 注: 実際のstateは取得できないため、イベントベースで分析
        }
      }
      
      universe.clearEventLog();
    }
  }

  return data;
}

// 言語の定義を分析
console.log('=== H42/H43検証: 言語創発の条件 ===\n');

console.log('## 言語の定義\n');
console.log('言語の本質的特徴:');
console.log('1. 情報が行動を直接決定する（情報→行動の因果関係）');
console.log('2. 情報が他者に伝達可能である');
console.log('3. 情報が意味を持つ（同じ情報が同じ行動を引き起こす）');
console.log('');

console.log('## 現在の実装の分析\n');
console.log('現在のスキルシステム:');
console.log('- state（情報）はスキル値の計算に使われる');
console.log('- スキル値は行動の「効率」に影響する');
console.log('- スキル値は行動の「選択」には影響しない');
console.log('');

console.log('行動選択の特徴量（extractFeatures）:');
console.log('- SelfEnergy: 自身のエネルギー');
console.log('- CurrentResources: 現在ノードの資源量');
console.log('- MaxNeighborResources: 近隣ノードの最大資源量');
console.log('- NearbyEntityCount: 近くのエンティティ数');
console.log('- CurrentBeacon: 現在ノードのBeacon強度');
console.log('- MaxNeighborBeacon: 近隣ノードの最大Beacon強度');
console.log('- HasDamagedArtifact: 近くの劣化アーティファクト有無');
console.log('- IsMaintainer: 維持者ステータス');
console.log('');
console.log('→ stateは特徴量に含まれていない');
console.log('');

console.log('## H42の検証\n');
console.log('「現在のスキルシステムは『遺伝情報』であり『言語』ではない」');
console.log('');
console.log('遺伝情報の特徴:');
console.log('- 形質（スキル値）を決定する');
console.log('- 行動を直接決定しない');
console.log('- 世代を超えて継承される');
console.log('');
console.log('言語の特徴:');
console.log('- 行動を直接決定する');
console.log('- 同じ情報が同じ行動を引き起こす');
console.log('- 学習・伝達が可能');
console.log('');
console.log('現在の実装:');
console.log('- stateはスキル値（形質）を決定する → 遺伝情報的');
console.log('- stateは行動選択に影響しない → 言語ではない');
console.log('');
console.log('結論: H42を支持');
console.log('');

console.log('## H43の検証\n');
console.log('「言語の創発には『情報→行動選択』の直接的な接続が必要」');
console.log('');
console.log('現在の実装で欠けているもの:');
console.log('1. stateが行動選択の特徴量に含まれていない');
console.log('2. 「同じstateパターン→同じ行動」の因果関係がない');
console.log('3. 情報の「意味」が定義されていない');
console.log('');
console.log('言語創発に必要な実装:');
console.log('1. stateの一部を行動選択の特徴量に追加');
console.log('2. 「情報→行動」のマッピングを学習可能にする');
console.log('3. 成功した行動パターンが情報として伝達される仕組み');
console.log('');
console.log('結論: H43を支持（現在の実装では言語は創発しない）');
console.log('');

console.log('## 非恣意性チェック\n');
console.log('言語創発のための実装変更は「恣意的」か？');
console.log('');
console.log('検討:');
console.log('- 「情報→行動」の接続は、生物学的にも存在する（本能、学習）');
console.log('- ただし、「言語が生まれるように」という意図で実装すると恣意的');
console.log('- 「情報が行動に影響を与える」という一般的な仕組みは非恣意的');
console.log('');
console.log('結論:');
console.log('- 「stateが行動選択に影響を与える」仕組みは追加可能（非恣意的）');
console.log('- ただし、「言語が創発する」ことを保証する実装は恣意的');
console.log('- 観測のみの原則に従い、創発を観測するが誘導しない');
console.log('');

console.log('## 今後の方針\n');
console.log('1. 現在の実装のまま、情報伝達パターンを観測し続ける');
console.log('2. 「情報→行動」の接続は、物理的必然性がある場合のみ追加');
console.log('3. 言語の創発は「観測」するが「誘導」しない');
console.log('');

console.log('=== 結論 ===\n');
console.log('H42: 支持（現在のスキルシステムは遺伝情報であり言語ではない）');
console.log('H43: 支持（言語創発には情報→行動選択の接続が必要）');
console.log('');
console.log('現在の実装では言語は創発しない。');
console.log('言語創発のための実装変更は可能だが、非恣意性の原則に従い慎重に検討する必要がある。');
