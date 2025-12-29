# Design Document: Information-Action Connection

## Overview

アーティファクトに保存された情報（`data`）とエンティティの内部状態（`state`）の一致度が、修復効率に影響を与える仕組みを実装する。

これは既存の公理（公理8: エンティティの基本構造、公理12: アーティファクト）の接続を強化するものであり、新しい公理を追加しない。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Universe                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │   Entity    │    │  Artifact   │    │  Repair System  │ │
│  │  ┌───────┐  │    │  ┌───────┐  │    │                 │ │
│  │  │ state │──┼────┼──│ data  │──┼────┤ calculateSim()  │ │
│  │  └───────┘  │    │  └───────┘  │    │ applyBonus()    │ │
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

### 1. SimilarityCalculator

一致度計算を担当するユーティリティ関数。

```typescript
/**
 * 2つのバイト列の一致度を計算
 * @param a 第1のバイト列
 * @param b 第2のバイト列
 * @returns 一致度 (0.0〜1.0)
 */
function calculateSimilarity(a: Uint8Array, b: Uint8Array): number;
```

**アルゴリズム**:
1. どちらかが空の場合は0.0を返す
2. 短い方の長さまで比較し、一致するバイト数をカウント
3. 長さの差をペナルティとして適用
4. 最終スコア = (一致数 / 最大長) * (1 - 長さペナルティ)

### 2. KnowledgeBonus

一致度から修復効率ボーナスを計算。

```typescript
/**
 * 一致度から修復効率ボーナスを計算
 * @param similarity 一致度 (0.0〜1.0)
 * @returns 効率倍率 (1.0〜2.0)
 */
function calculateKnowledgeBonus(similarity: number): number;
```

**計算式**:
- similarity ≤ 0.5: return 1.0 (ボーナスなし)
- similarity > 0.5: return 1.0 + (similarity - 0.5) * 2.0
  - similarity = 0.5 → 1.0
  - similarity = 0.75 → 1.5
  - similarity = 1.0 → 2.0

### 3. UniverseConfig拡張

```typescript
interface UniverseConfig {
  // ... existing fields ...
  
  /** 知識ボーナスを有効にするか（A/Bテスト用） */
  knowledgeBonusEnabled: boolean;
}
```

### 4. 修復処理の変更

`executeRepairArtifact`メソッドを修正:

```typescript
private executeRepairArtifact(entity: Entity, artifactId: ArtifactId, cost: number, tick: number): void {
  const artifact = this.artifactManager.get(artifactId);
  if (!artifact || artifact.nodeId !== entity.nodeId) return;

  // 一致度計算
  const similarity = calculateSimilarity(entity.state.getData(), artifact.data);
  
  // 知識ボーナス計算
  const bonus = this.config.knowledgeBonusEnabled 
    ? calculateKnowledgeBonus(similarity) 
    : 1.0;
  
  // ボーナスを適用した修復量
  const baseRepairGain = Math.min(1 - artifact.durability, cost / REPAIR_ENERGY_PER_DURABILITY);
  const repairGain = baseRepairGain * bonus;
  
  // ... rest of repair logic ...
  
  // ログに一致度とボーナスを記録
  this.logEvent({
    type: 'artifactRepaired',
    entityId: entity.id,
    artifactId,
    energyConsumed: cost,
    durabilityBefore,
    durabilityAfter: repairResult.after,
    similarity,
    knowledgeBonus: bonus,
    tick,
  });
}
```

## Data Models

### SimulationEvent拡張

```typescript
interface ArtifactRepairedEvent {
  type: 'artifactRepaired';
  entityId: EntityId;
  artifactId: ArtifactId;
  energyConsumed: number;
  durabilityBefore: number;
  durabilityAfter: number;
  similarity: number;      // 追加
  knowledgeBonus: number;  // 追加
  tick: number;
}
```

### SimulationStats拡張

```typescript
interface SimulationStats {
  // ... existing fields ...
  
  /** 知識関連メトリクス */
  knowledge: {
    /** 平均一致度 */
    avgSimilarity: number;
    /** 修復回数 */
    repairCount: number;
    /** ボーナス適用回数（similarity > 0.5） */
    bonusAppliedCount: number;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Similarity Score Range Invariant

*For any* two byte arrays (including empty arrays), the calculated similarity score SHALL always be in the range [0.0, 1.0].

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Knowledge Bonus Calculation

*For any* similarity score in [0.0, 1.0], the knowledge bonus SHALL be:
- 1.0 when similarity ≤ 0.5
- Linearly interpolated from 1.0 to 2.0 when similarity > 0.5

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 3: Similarity Symmetry

*For any* two byte arrays a and b, calculateSimilarity(a, b) SHALL equal calculateSimilarity(b, a).

**Validates: Requirements 1.1** (implicit symmetry requirement)

### Property 4: Perfect Match

*For any* non-empty byte array a, calculateSimilarity(a, a) SHALL equal 1.0.

**Validates: Requirements 1.1**

## Error Handling

- 空のバイト列: 一致度0.0を返す（エラーではない）
- nullまたはundefined: 空配列として扱う
- 設定が無効の場合: ボーナス1.0を返す（機能無効化）

## Testing Strategy

### Unit Tests

1. `calculateSimilarity`関数のテスト
   - 同一配列 → 1.0
   - 完全不一致 → 0.0に近い値
   - 空配列 → 0.0
   - 異なる長さの配列

2. `calculateKnowledgeBonus`関数のテスト
   - similarity = 0.0 → 1.0
   - similarity = 0.5 → 1.0
   - similarity = 0.75 → 1.5
   - similarity = 1.0 → 2.0

### Property-Based Tests

Property-based testing (PBT) validates software correctness by testing universal properties across many generated inputs.

**Testing Framework**: vitest + fast-check

**Configuration**: Minimum 100 iterations per property test

1. **Property 1**: Range invariant
   - Generate random byte arrays
   - Verify output is always in [0.0, 1.0]

2. **Property 2**: Bonus calculation
   - Generate random similarity values in [0.0, 1.0]
   - Verify bonus formula is correct

3. **Property 3**: Symmetry
   - Generate two random byte arrays
   - Verify similarity(a, b) === similarity(b, a)

4. **Property 4**: Perfect match
   - Generate random non-empty byte array
   - Verify similarity(a, a) === 1.0

### Integration Tests

1. 修復時に一致度が計算されることを確認
2. ボーナスが修復量に反映されることを確認
3. ログに一致度とボーナスが記録されることを確認
4. `knowledgeBonusEnabled: false`でボーナスが無効になることを確認
