# Requirements Document

## Introduction

本機能は、宇宙シミュレーションにおけるエンティティに「物質の多様性」を導入する。現在のエンティティは「エネルギーを持つ点」でしかないが、現実世界では物質はタイプ（元素）、質量、構成によって区別される。これらの概念を最小公理として追加し、より物理的なシミュレーションを実現する。

### 公理予算の正当化

| 公理 | 必要性 | 恣意性チェック |
|------|--------|---------------|
| タイプの存在 | エネルギーだけでは物質の多様性を表現できない | タイプ数は初期パラメータ、名前は付けない |
| 質量の存在 | 物理的な慣性・移動コストの概念に必要 | 連続値ではなく整数で簡略化（計算効率） |
| 化学反応 | 物質の変換・創発に必要 | 反応ルールは seed 依存、事前定義しない |

## Glossary

- **Entity**: シミュレーション内の基本単位。エネルギー、タイプ、質量を持つ
- **Type**: エンティティの種類を表す整数値。元素番号に相当するが名前は付けない
- **Mass**: エンティティの質量。移動コストに影響する
- **Composition**: 複合エンティティの構成タイプリスト
- **Reaction**: 2つ以上のエンティティが結合・分解する化学反応
- **Reaction_Table**: タイプの組み合わせと反応結果を記録するテーブル（seed依存で生成）
- **Simulator**: シミュレーションを実行するシステム

## Requirements

### Requirement 1: エンティティへのタイプ追加

**User Story:** As a シミュレーション観測者, I want エンティティがタイプを持つ, so that 物質の多様性を表現できる

#### Acceptance Criteria

1. THE Entity SHALL have a type property represented as a non-negative integer
2. WHEN an Entity is created, THE Simulator SHALL assign a type based on initial conditions or inheritance
3. WHEN displaying Entity information, THE Simulator SHALL show the type as a number without a name
4. THE Simulator SHALL support a configurable maximum number of types as an initial parameter

### Requirement 2: エンティティへの質量追加

**User Story:** As a シミュレーション観測者, I want エンティティが質量を持つ, so that 物理的な慣性を表現できる

#### Acceptance Criteria

1. THE Entity SHALL have a mass property represented as a positive integer
2. WHEN an Entity moves, THE Simulator SHALL calculate movement cost proportional to mass
3. WHEN an Entity is created, THE Simulator SHALL assign mass based on type or inheritance
4. THE Simulator SHALL enforce that mass is always greater than zero

### Requirement 3: 複合エンティティの構成

**User Story:** As a シミュレーション観測者, I want エンティティが複数のタイプから構成される, so that 分子のような複合体を表現できる

#### Acceptance Criteria

1. THE Entity SHALL have a composition property as a list of type integers
2. WHEN an Entity is a simple type, THE composition SHALL contain only that single type
3. WHEN an Entity is a compound, THE composition SHALL contain all constituent types
4. THE Simulator SHALL calculate compound properties based on composition

### Requirement 4: 化学反応の発生

**User Story:** As a シミュレーション観測者, I want エンティティ同士が反応して新しいタイプを生成する, so that 物質の変換を観測できる

#### Acceptance Criteria

1. WHEN two Entities interact at the same node, THE Simulator SHALL check if a reaction can occur
2. WHEN a reaction occurs, THE Simulator SHALL consume the reactant Entities
3. WHEN a reaction occurs, THE Simulator SHALL create product Entities based on the Reaction_Table
4. IF a reaction combination is not in the Reaction_Table, THEN THE Simulator SHALL determine the result stochastically and record it
5. THE Simulator SHALL log all reactions for observation

### Requirement 5: 反応テーブルの生成と管理

**User Story:** As a シミュレーション観測者, I want 反応ルールがseed依存で決定される, so that 経路依存性を保ちつつ再現性がある

#### Acceptance Criteria

1. THE Reaction_Table SHALL be generated based on the simulation seed
2. WHEN a new type combination is encountered, THE Simulator SHALL generate a reaction rule stochastically
3. THE Simulator SHALL persist the Reaction_Table throughout the simulation
4. THE Simulator SHALL allow exporting the Reaction_Table for analysis
5. THE Reaction_Table SHALL NOT contain predefined reactions based on real-world chemistry

### Requirement 6: タイプ別の基本性質

**User Story:** As a シミュレーション観測者, I want タイプごとに基本性質が異なる, so that 多様な振る舞いを観測できる

#### Acceptance Criteria

1. THE Simulator SHALL assign each type a base energy efficiency (harvest multiplier)
2. THE Simulator SHALL assign each type a base mass
3. THE Simulator SHALL assign each type a reactivity level (reaction probability modifier)
4. WHEN generating type properties, THE Simulator SHALL use the seed for reproducibility
5. THE type properties SHALL NOT be named or mapped to real-world elements

### Requirement 7: 質量による移動コスト

**User Story:** As a シミュレーション観測者, I want 質量が大きいエンティティは移動コストが高い, so that 物理的な慣性を表現できる

#### Acceptance Criteria

1. WHEN an Entity moves, THE Simulator SHALL multiply the base movement cost by a mass factor
2. THE mass factor SHALL be calculated as (1 + mass / base_mass_unit)
3. IF an Entity does not have enough energy for movement, THEN THE Simulator SHALL prevent the movement
4. THE Simulator SHALL log movement costs for analysis

### Requirement 8: 複製時のタイプ継承

**User Story:** As a シミュレーション観測者, I want 複製時にタイプが継承される, so that 遺伝的な多様性を観測できる

#### Acceptance Criteria

1. WHEN an Entity replicates, THE child Entity SHALL inherit the parent's type with high probability
2. WHEN an Entity replicates, THE Simulator SHALL apply a small mutation probability to the type
3. IF mutation occurs, THE child type SHALL be a random type within the allowed range
4. THE Simulator SHALL log type inheritance and mutations for analysis

### Requirement 9: エネルギーと質量の関係

**User Story:** As a シミュレーション観測者, I want エネルギーと質量が関連する, so that E=mc²的な概念を抽象的に表現できる

#### Acceptance Criteria

1. WHEN an Entity is destroyed, THE Simulator SHALL release energy proportional to its mass
2. WHEN creating an Entity from energy, THE Simulator SHALL require energy proportional to the target mass
3. THE energy-mass conversion rate SHALL be a configurable parameter
4. THE Simulator SHALL enforce energy conservation during mass-energy conversions

### Requirement 10: 観測とログ

**User Story:** As a シミュレーション観測者, I want タイプ・質量・反応に関する統計を観測できる, so that 創発現象を分析できる

#### Acceptance Criteria

1. THE Simulator SHALL log the distribution of types at each snapshot
2. THE Simulator SHALL log the total mass in the system at each snapshot
3. THE Simulator SHALL log all reactions with reactants, products, and location
4. THE Simulator SHALL provide summary statistics for type diversity and reaction frequency
