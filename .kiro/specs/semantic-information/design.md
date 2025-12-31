# Design Document: Semantic Information

## Overview

エンティティの内部状態（`state`）の特定パターンが行動効率に影響を与える仕組みを実装する。

これは既存の公理（公理8: エンティティの基本構造、公理9: エンティティの行動）の接続を強化するものであり、新しい公理を追加しない。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Universe                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │   Entity    │    │   Action    │    │  Skill System   │ │
│  │  ┌───────┐  │    │  Execution  │    │                 │ │
│  │  │ state │──┼────┼─────────────┼────┤ extractSkills() │ │
│  │  └───────┘  │    │             │    │ applyBonus()    │ │
│  └─────────────┘    └─────────────┘    └─────────────────┘ │
│                                               │             │
│                                               ▼             │
│                                        ┌─────────────┐     │
│                                        │ Observation │     │
│                                        │  (metrics)  │     │
│                                        └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. SkillExtractor

stateからスキルベクトルを抽出するユーティリティ関数。

```typescript
/** スキルインデックス */
export enum SkillIndex {
  Harvest = 0,
  Repair = 1,
  Create = 2,
  Move = 3,
  Interact = 4,
  Replicate = 5,
  Perception = 6,
  Reserved = 7,
}

/** スキルの数 */
export const SKILL_COUNT = 8;

/**
 * stateからスキルベクトルを抽出
 * @param state エンティティの内部状態
 * @returns スキルベクトル（各要素は0.0〜1.0）
 */
function extractSkills(state: Uint8Array): Float32Array;
```

**アルゴリズム**:
1. stateの最初の8バイトを取得
2. 8バイト未満の場合は0でパディング
3. 各バイトを255で割って正規化

### 2. SkillBonus

スキル値からボーナスを計算。

```typescript
/**
 * スキル値からボーナスを計算
 * @param skillValue スキル値（0.0〜1.0）
 * @returns ボーナス倍率（1.0〜1.5）
 */
function calculateSkillBonus(skillValue: number): number {
  return 1.0 + skillValue * 0.5;
}
```

### 3. UniverseConfig拡張

```typescript
interface UniverseConfig {
  // ... existing fields ...
  
  /** スキルボーナスを有効にするか（A/Bテスト用） */
  skillBonusEnabled: boolean;
}
```

### 4. 行動実行への統合

各行動実行メソッドにスキルボーナスを適用:

```typescript
// Harvest
private executeHarvest(entity: Entity, ...): void {
  const skills = extractSkills(entity.state.getData());
  const bonus = this.config.skillBonusEnabled 
    ? calculateSkillBonus(skills[SkillIndex.Harvest])
    : 1.0;
  const harvestAmount = baseAmount * bonus;
  // ...
}

// Repair
private executeRepairArtifact(entity: Entity, ...): void {
  const skills = extractSkills(entity.state.getData());
  const bonus = this.config.skillBonusEnabled 
    ? calculateSkillBonus(skills[SkillIndex.Repair])
    : 1.0;
  const repairAmount = baseAmount * bonus;
  // ...
}

// Create
private executeCreateArtifact(entity: Entity, ...): void {
  const skills = extractSkills(entity.state.getData());
  const bonus = this.config.skillBonusEnabled 
    ? calculateSkillBonus(skills[SkillIndex.Create])
    : 1.0;
  const energyCost = baseCost / bonus; // ボーナスが高いほどコスト減
  // ...
}
```

## Data Models

### SimulationStats拡張

```typescript
interface SimulationStats {
  // ... existing fields ...
  
  /** スキル関連メトリクス */
  skills: {
    /** 平均スキルベクトル */
    avgSkills: number[];
    /** スキル多様性（各スキルの分散） */
    skillVariance: number[];
    /** スキルボーナス適用回数（行動タイプ別） */
    bonusApplications: Record<string, number>;
  };
}
```

## Correctness Properties

### Property 1: Skill Vector Range Invariant

*For any* entity state (including empty state), the extracted skill vector SHALL have exactly 8 elements, each in range [0.0, 1.0].

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Skill Bonus Range

*For any* skill value in [0.0, 1.0], the calculated bonus SHALL be in range [1.0, 1.5].

**Validates: Requirements 3.1, 3.2**

### Property 3: Empty State Handling

*For any* entity with empty state, extractSkills SHALL return a zero vector [0, 0, 0, 0, 0, 0, 0, 0].

**Validates: Requirements 1.3**

## Error Handling

- 空のstate: ゼロベクトルを返す（エラーではない）
- 設定が無効の場合: ボーナス1.0を返す（機能無効化）

## Testing Strategy

### Unit Tests

1. `extractSkills`関数のテスト
   - 8バイト以上のstate → 最初の8バイトを使用
   - 8バイト未満のstate → ゼロパディング
   - 空のstate → ゼロベクトル

2. `calculateSkillBonus`関数のテスト
   - skill = 0.0 → 1.0
   - skill = 0.5 → 1.25
   - skill = 1.0 → 1.5

### Integration Tests

1. Harvest時にスキルボーナスが適用されることを確認
2. Repair時にスキルボーナスが適用されることを確認
3. `skillBonusEnabled: false`でボーナスが無効になることを確認
