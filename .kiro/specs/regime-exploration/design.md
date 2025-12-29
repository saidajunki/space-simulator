# Design Document: レジーム探索

## Overview

パラメータ空間を探索し、シミュレーションの定性的な挙動パターン（レジーム）を特定するシステム。
`resourceRegenerationRate`を主軸に、道具効果ON/OFFのA/B比較を行い、「活発レジーム」を発見する。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI (cli.ts)                           │
│  explore-regimes コマンド                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  RegimeExplorer                             │
│  - パラメータグリッド生成                                     │
│  - シミュレーション実行（LocalRunner使用）                    │
│  - レジーム分類                                              │
│  - 結果集約・出力                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  LocalRunner (既存)                         │
│  - 単一シミュレーション実行                                   │
│  - 統計収集                                                  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### RegimeExplorer

```typescript
interface ExplorationConfig {
  /** 探索するresourceRegenerationRateの値 */
  regenRates: number[];
  /** 各パラメータで実行するseed */
  seeds: number[];
  /** 最大tick数 */
  maxTicks: number;
  /** ノード数 */
  nodeCount: number;
  /** 初期エンティティ数 */
  entityCount: number;
  /** 道具効果A/B比較を行うか */
  toolEffectAB: boolean;
}

interface ExplorationResult {
  /** パラメータ */
  regenRate: number;
  seed: number;
  toolEffectEnabled: boolean;
  /** 結果 */
  exitReason: string;
  finalTick: number;
  entityCount: number;
  artifactCount: number;
  totalPrestige: number;
  avgArtifactAge: number;
  avgAge: number;
  replicationCount: number;
  interactionCount: number;
  spatialGini: number;
  /** 分類 */
  regime: '静止' | '少数安定' | '活発' | '増殖/絶滅';
}

interface ExplorationSummary {
  config: ExplorationConfig;
  results: ExplorationResult[];
  regimeCounts: Map<string, number>;
  timestamp: string;
  gitCommitHash?: string;
}

class RegimeExplorer {
  constructor(config: ExplorationConfig);
  
  /** 探索を実行 */
  explore(): ExplorationSummary;
  
  /** レジームを分類 */
  classifyRegime(result: Partial<ExplorationResult>): string;
  
  /** 結果をファイルに保存 */
  saveResults(summary: ExplorationSummary, outputDir: string): void;
  
  /** マークダウンレポートを生成 */
  generateReport(summary: ExplorationSummary): string;
}
```

### レジーム分類ロジック

```typescript
function classifyRegime(
  entityCount: number,
  replicationCount: number,
  exitReason: string,
  initialEntityCount: number
): string {
  // 絶滅
  if (exitReason === 'extinction') {
    return '増殖/絶滅';
  }
  
  // 増殖（初期より増加）
  if (entityCount > initialEntityCount) {
    return '増殖/絶滅';
  }
  
  // 静止（1-3体、複製なし）
  if (entityCount <= 3 && replicationCount === 0) {
    return '静止';
  }
  
  // 少数安定（3-10体、低頻度複製）
  if (entityCount <= 10 && replicationCount < 5) {
    return '少数安定';
  }
  
  // 活発（10-50体、中頻度複製）
  if (entityCount >= 10 && replicationCount >= 5) {
    return '活発';
  }
  
  return '少数安定';
}
```

## Data Models

### 探索パラメータグリッド

デフォルトの探索範囲：

| パラメータ | 値 |
|-----------|-----|
| regenRate | 0.004, 0.008, 0.016, 0.032, 0.064 |
| seeds | 1, 2, 3 |
| maxTicks | 1000 |
| nodeCount | 30 |
| entityCount | 50 |
| toolEffectAB | true |

合計: 5 × 3 × 2 = 30 シミュレーション

### 出力ファイル形式

```json
{
  "config": {
    "regenRates": [0.004, 0.008, 0.016, 0.032, 0.064],
    "seeds": [1, 2, 3],
    "maxTicks": 1000,
    "nodeCount": 30,
    "entityCount": 50,
    "toolEffectAB": true
  },
  "results": [
    {
      "regenRate": 0.008,
      "seed": 1,
      "toolEffectEnabled": true,
      "exitReason": "maxTicks",
      "finalTick": 1000,
      "entityCount": 11,
      "artifactCount": 15,
      "totalPrestige": 414,
      "avgArtifactAge": 385.9,
      "avgAge": 126.4,
      "replicationCount": 12,
      "interactionCount": 0,
      "spatialGini": 0.286,
      "regime": "活発"
    }
  ],
  "regimeCounts": {
    "静止": 5,
    "少数安定": 10,
    "活発": 12,
    "増殖/絶滅": 3
  },
  "timestamp": "2024-12-29T12:00:00Z",
  "gitCommitHash": "abc123"
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: レジーム分類の一貫性

*For any* simulation result, the regime classification SHALL be deterministic based on entityCount, replicationCount, and exitReason.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 2: 結果の完全性

*For any* exploration run, the number of results SHALL equal `regenRates.length × seeds.length × (toolEffectAB ? 2 : 1)`.

**Validates: Requirements 1.1, 3.2**

### Property 3: 道具効果の分離

*For any* A/B comparison pair (same regenRate, same seed), the only difference in config SHALL be toolEffectEnabled.

**Validates: Requirements 3.1, 3.2**

## Error Handling

- シミュレーションがエラーで終了した場合、exitReason='error'として記録し、探索を継続
- ファイル書き込みエラーは警告を出力し、コンソール出力は継続

## Testing Strategy

### Unit Tests

- レジーム分類ロジックの境界値テスト
- パラメータグリッド生成のテスト

### Integration Tests

- 小規模グリッド（2×2×2）での探索実行テスト
- 結果ファイルの形式検証

### Property-Based Tests

- Property 1: 同じ入力に対して常に同じレジーム分類
- Property 2: 結果数の整合性
