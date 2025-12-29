# Requirements Document

## Introduction

シミュレーションの状態を視覚的に表示するWebベースのビューアを構築する。Pixi.js（WebGL）を使用して高速な2D描画を実現し、ノード・エンティティ・アーティファクトの分布と変化をリアルタイムで観察可能にする。

## Glossary

- **Viewer**: シミュレーション可視化Webアプリケーション
- **WorldCanvas**: Pixi.jsで描画されるメインキャンバス
- **Node_Visual**: ノードの視覚表現（円形）
- **Entity_Visual**: エンティティの視覚表現（小さな点）
- **Artifact_Visual**: アーティファクトの視覚表現（星形）
- **Edge_Visual**: エッジの視覚表現（線）
- **Stats_Panel**: 統計情報を表示するUIパネル
- **Timeline_Control**: tick再生を制御するスライダー

## Requirements

### Requirement 1: ワールドマップ表示

**User Story:** As a user, I want to see the simulation world as a network graph, so that I can understand the spatial structure.

#### Acceptance Criteria

1. WHEN the Viewer loads, THE WorldCanvas SHALL display all nodes as circles arranged in a force-directed layout
2. WHEN a node has resources, THE Node_Visual SHALL show resource level through color gradient (green=high, red=low)
3. WHEN edges exist between nodes, THE Edge_Visual SHALL draw lines connecting the nodes
4. THE Viewer SHALL support pan and zoom interactions on the WorldCanvas

### Requirement 2: エンティティ表示

**User Story:** As a user, I want to see entities on the map, so that I can observe their distribution and movement.

#### Acceptance Criteria

1. WHEN entities exist on a node, THE Entity_Visual SHALL display them as small colored circles on that node
2. WHEN an entity has a type, THE Entity_Visual SHALL use a distinct color based on the type (type 0=blue, 1=red, 2=green, etc.)
3. WHEN an entity's energy changes, THE Entity_Visual SHALL adjust its opacity (high energy=opaque, low=transparent)
4. WHEN an entity is a maintainer, THE Entity_Visual SHALL display a subtle glow effect

### Requirement 3: アーティファクト表示

**User Story:** As a user, I want to see artifacts on the map, so that I can observe their distribution and prestige.

#### Acceptance Criteria

1. WHEN artifacts exist on a node, THE Artifact_Visual SHALL display them as star shapes on that node
2. WHEN an artifact has prestige, THE Artifact_Visual SHALL scale its size proportionally (higher prestige=larger)
3. WHEN an artifact has high beacon strength, THE Artifact_Visual SHALL emit a visible glow

### Requirement 4: 統計パネル

**User Story:** As a user, I want to see simulation statistics, so that I can understand the overall state.

#### Acceptance Criteria

1. THE Stats_Panel SHALL display current tick number
2. THE Stats_Panel SHALL display entity count and total energy
3. THE Stats_Panel SHALL display artifact count and total prestige
4. THE Stats_Panel SHALL display energy breakdown (entity/free/waste heat)

### Requirement 5: シミュレーション制御

**User Story:** As a user, I want to control the simulation playback, so that I can observe at my own pace.

#### Acceptance Criteria

1. THE Timeline_Control SHALL provide play/pause buttons
2. THE Timeline_Control SHALL provide a speed slider (0.5x to 4x)
3. THE Timeline_Control SHALL provide step forward/backward buttons
4. WHEN simulation is running, THE Viewer SHALL update the display each tick

### Requirement 6: シミュレーション設定

**User Story:** As a user, I want to configure simulation parameters, so that I can run different scenarios.

#### Acceptance Criteria

1. THE Viewer SHALL provide input fields for seed, max ticks, node count, entity count
2. WHEN the user clicks start, THE Viewer SHALL initialize a new simulation with the specified parameters
3. THE Viewer SHALL display the current seed for reproducibility
