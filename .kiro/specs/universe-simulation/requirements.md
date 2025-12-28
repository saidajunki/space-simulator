# Requirements Document

## Introduction

最小公理アプローチによる宇宙シミュレーションシステム。恣意的な設計を避け、物理的制約のみを公理として設定し、そこから何が創発するかを観測することを目的とする。

**設計思想の核心**:
- 公理は少なく、変えない（公理予算）
- 局所性を破らない（知覚は近傍のみ、遅延あり）
- 有限性を必ず置く（エネルギー、時間、資源、注意、記憶、インフラ耐久）
- 偶然と経路依存を尊重（必然ではなく偶然の積み重ね）
- 観測はするが、誘導しない（メトリクスは目的関数ではなくログ）

「記憶」「学習」「言語」「人間」などの具体的概念は設計せず、物理的制約から自然に発生することを期待する。

## Glossary

- **Universe**: シミュレーション全体を包含する空間と時間の集合
- **Space**: エンティティが存在する座標系（Graph World推奨）
- **Node**: 空間内の地域（属性: 温度、地形、資源、災害率など）
- **Edge**: ノード間の移動/通信ルート（属性: 距離、遅延、容量、危険度など）
- **Time**: 離散的なステップで進行する状態変化の軸
- **Entity**: 空間内に存在し、状態を持ち、行動できる基本単位
- **Energy**: エンティティが保持し、行動に消費する有限のリソース
- **State**: エンティティの内部状態（位置、エネルギー、その他の可変データ）
- **Action**: エンティティが実行できる行動（移動、相互作用、変換など）
- **Interaction**: 2つ以上のエンティティ間の相互作用
- **Artifact**: 環境に刻まれた情報（保存コスト・劣化・破壊あり）
- **Observation**: シミュレーション結果の観測・記録（ログのみ、誘導なし）
- **Guardrail**: シミュレーションが目的から逸脱した際の外的介入

## Requirements

### Requirement 1: 空間の定義（Graph World）

**User Story:** As a シミュレーション観測者, I want to エンティティが存在できる空間を定義する, so that 位置と距離の概念が成立する.

#### Acceptance Criteria

1. WHEN Universeが初期化される THEN THE Space SHALL ノードとエッジからなるグラフ構造を持つ
2. THE Node SHALL 属性（温度、地形タイプ、資源量、災害率など）を持つ
3. THE Edge SHALL 属性（距離、移動時間、輸送容量、危険度など）を持つ
4. THE Space SHALL 任意の2ノード間の最短経路と距離を計算できる
5. WHEN Spaceが生成される THEN THE Space SHALL 有限のノード数を持つ

### Requirement 2: 時間の定義

**User Story:** As a シミュレーション観測者, I want to 離散的な時間ステップを定義する, so that 状態変化を順序付けできる.

#### Acceptance Criteria

1. WHEN シミュレーションが実行される THEN THE Time SHALL 離散的なステップ（tick）で進行する
2. WHEN 1ステップが経過する THEN THE Universe SHALL 全エンティティの状態を更新する
3. THE Time SHALL 現在のステップ数を記録する
4. WHEN ステップが進む THEN THE Universe SHALL そのステップでの全イベントを記録する
5. THE Time SHALL 再現性のためseed管理を行う

### Requirement 3: エネルギー保存則

**User Story:** As a シミュレーション観測者, I want to エネルギー保存則を適用する, so that 行動にコストが発生し、無限の行動ができない.

#### Acceptance Criteria

1. WHEN Entityが生成される THEN THE Entity SHALL 初期エネルギーを持つ
2. WHEN Entityが行動する THEN THE Entity SHALL エネルギーを消費する
3. IF Entityのエネルギーがゼロになる THEN THE Entity SHALL 行動不能または消滅する
4. WHEN Entityが他のEntityまたは環境と相互作用する THEN THE Energy SHALL 移動または変換されるが総量は保存される
5. THE Universe SHALL 総エネルギー量を追跡する

### Requirement 4: 距離コストと遅延

**User Story:** As a シミュレーション観測者, I want to 距離に比例したコストと遅延を適用する, so that 局所性が意味を持つ.

#### Acceptance Criteria

1. WHEN Entityが移動する THEN THE Entity SHALL 移動距離に比例したエネルギーと時間を消費する
2. WHEN Entityが他のEntityと相互作用する THEN THE Interaction SHALL 距離に応じた遅延を受ける
3. IF 2つのEntityが離れている THEN THE Interaction SHALL より多くのエネルギーまたは時間を要する
4. WHEN 情報が伝達される THEN THE 情報 SHALL 距離に応じた遅延を持つ
5. WHEN 物資が輸送される THEN THE 物資 SHALL エッジ上を「移動中」状態で滞留し、到着まで使用できない

### Requirement 5: 局所性と知覚制限

**User Story:** As a シミュレーション観測者, I want to エンティティの知覚を局所に限定する, so that 遠方の情報に直接アクセスできない.

#### Acceptance Criteria

1. WHEN Entityが知覚する THEN THE Entity SHALL 同一ノードまたは隣接ノードの情報のみ取得できる
2. WHEN Entityが知覚する THEN THE 知覚 SHALL ノイズを含む可能性がある
3. IF Entityが遠方の情報を得ようとする THEN THE Entity SHALL 情報が到達するまで待つ必要がある
4. THE Entity SHALL 知覚範囲外の事象を意思決定に利用できない

### Requirement 6: エントロピーと劣化

**User Story:** As a シミュレーション観測者, I want to エントロピー増大の傾向を適用する, so that 秩序の維持にコストがかかる.

#### Acceptance Criteria

1. WHILE 時間が経過する THEN THE Entity SHALL 状態が自然に劣化する傾向を持つ
2. WHEN Entityが秩序を維持しようとする THEN THE Entity SHALL エネルギーを消費する
3. IF Entityがエネルギーを消費しない THEN THE Entity SHALL 状態がランダム化に向かう
4. WHILE 時間が経過する THEN THE Artifact SHALL 劣化・腐敗・摩耗する
5. WHILE 時間が経過する THEN THE インフラ（Edge属性など） SHALL 維持コストなしでは劣化する
6. THE エントロピー増大率 SHALL パラメータとして設定できる

### Requirement 7: 有限性と希少性

**User Story:** As a シミュレーション観測者, I want to 全てのリソースを有限にする, so that 競争と協力が意味を持つ.

#### Acceptance Criteria

1. THE Node SHALL 有限の資源量を持つ
2. WHEN 資源が消費される THEN THE 資源 SHALL 減少する
3. IF 資源が枯渇する THEN THE Node SHALL その資源を産出しなくなる
4. THE Entity SHALL 有限の注意（attention）を持ち、全てを同時に処理できない
5. THE Entity SHALL 有限の内部状態容量を持つ
6. THE Edge SHALL 有限の輸送容量を持つ

### Requirement 8: エンティティの基本構造

**User Story:** As a シミュレーション観測者, I want to 汎用的なエンティティを定義する, so that 様々な存在が創発できる.

#### Acceptance Criteria

1. WHEN Entityが生成される THEN THE Entity SHALL 一意のIDを持つ
2. THE Entity SHALL 位置（所属ノード）を持つ
3. THE Entity SHALL エネルギー量を持つ
4. THE Entity SHALL 内部状態（有限容量の可変データ構造）を持つ
5. WHEN Entityが生成される THEN THE Entity SHALL 行動ルール（状態と環境から行動を決定する関数）を持つ
6. THE Entity SHALL 知覚範囲（局所）を持つ

### Requirement 9: エンティティの行動

**User Story:** As a シミュレーション観測者, I want to エンティティが行動できる, so that 状態変化と相互作用が発生する.

#### Acceptance Criteria

1. WHEN 1ステップが経過する THEN THE Entity SHALL 行動を選択できる
2. THE Entity SHALL 移動（ノード間の移動）を行動として選択できる
3. THE Entity SHALL 相互作用（他のEntityへの働きかけ）を行動として選択できる
4. THE Entity SHALL 変換（自身の状態変更）を行動として選択できる
5. THE Entity SHALL 複製（新しいEntityの生成）を行動として選択できる
6. THE Entity SHALL 環境への刻印（Artifact生成）を行動として選択できる
7. WHEN 行動が選択される THEN THE Entity SHALL 行動ルールと現在の状態に基づいて決定する

### Requirement 10: 相互作用

**User Story:** As a シミュレーション観測者, I want to エンティティ間の相互作用を定義する, so that 協力・競争・情報交換が可能になる.

#### Acceptance Criteria

1. WHEN 2つのEntityが同一ノードにいる THEN THE Entity SHALL 相互作用を開始できる
2. WHEN 相互作用が発生する THEN THE Interaction SHALL 両Entityの状態を変化させる可能性がある
3. WHEN 相互作用が発生する THEN THE Interaction SHALL エネルギーの移動を伴う可能性がある
4. WHEN 相互作用が発生する THEN THE Interaction SHALL 内部状態の一部を交換する可能性がある
5. THE 相互作用の結果 SHALL 両Entityの行動ルールと状態に依存する
6. WHEN 相互作用が発生する THEN THE Interaction SHALL 誤解・ノイズを含む可能性がある

### Requirement 11: 複製と継承

**User Story:** As a シミュレーション観測者, I want to エンティティが複製できる, so that 世代交代と進化が可能になる.

#### Acceptance Criteria

1. WHEN Entityが複製を行う THEN THE Entity SHALL エネルギーを消費する
2. WHEN 複製が成功する THEN THE 新Entity SHALL 親Entityの行動ルールを継承する
3. WHEN 行動ルールが継承される THEN THE 行動ルール SHALL 一定確率で変異する
4. WHEN 複製が成功する THEN THE 新Entity SHALL 初期エネルギーを親から受け取る
5. WHEN 複製が成功する THEN THE 新Entity SHALL 内部状態を空（または最小）で開始する
6. IF 2つのEntityが協力して複製する THEN THE 新Entity SHALL 両親の行動ルールを組み合わせて継承できる

### Requirement 12: アーティファクト（環境への刻印）

**User Story:** As a シミュレーション観測者, I want to エンティティが環境に情報を刻める, so that 知識の外部化と継承が可能になる.

#### Acceptance Criteria

1. WHEN Entityがアーティファクトを生成する THEN THE Entity SHALL エネルギーを消費する
2. WHEN Artifactが生成される THEN THE Artifact SHALL 所属ノードに配置される
3. THE Artifact SHALL 情報（データ）を保持できる
4. WHILE 時間が経過する THEN THE Artifact SHALL 劣化・破壊のリスクがある
5. THE Artifact SHALL 維持コストなしでは劣化する
6. WHEN Entityがアーティファクトを読む THEN THE Entity SHALL 情報を取得できる（ノイズあり）

### Requirement 13: ノイズと偶然

**User Story:** As a シミュレーション観測者, I want to ノイズと偶然を導入する, so that 完璧な合理性が崩れ、経路依存が生まれる.

#### Acceptance Criteria

1. WHEN Entityが知覚する THEN THE 知覚 SHALL 一定確率でノイズを含む
2. WHEN Entityが行動する THEN THE 行動 SHALL 一定確率で意図と異なる結果になる
3. WHEN 情報が伝達される THEN THE 情報 SHALL 一定確率で歪む
4. WHEN 複製が行われる THEN THE 行動ルール SHALL 一定確率で変異する
5. WHEN 環境が更新される THEN THE Node属性 SHALL 一定確率で変動する（気象ゆらぎ、災害など）
6. THE 乱数 SHALL seed管理により再現可能である

### Requirement 14: 観測と記録（ログのみ）

**User Story:** As a シミュレーション観測者, I want to シミュレーションの状態を観測・記録する, so that 創発した現象を分析できる.

#### Acceptance Criteria

1. WHEN ステップが進む THEN THE Observation SHALL 全Entityの状態を記録できる
2. THE Observation SHALL Entity数、総エネルギー、空間分布を集計できる
3. THE Observation SHALL 創発したパターン（クラスタ、周期性など）を検出できる
4. WHEN シミュレーションが終了する THEN THE Universe SHALL 全観測データをエクスポートする
5. WHILE シミュレーション実行中 THEN THE Observation SHALL リアルタイムで統計を可視化できる
6. THE Observation SHALL 世界を動かす目的関数として使用されない（ログ解析のみ）

### Requirement 15: シミュレーション制御

**User Story:** As a シミュレーション観測者, I want to シミュレーションを制御する, so that 様々な初期条件で実験できる.

#### Acceptance Criteria

1. WHEN シミュレーションが開始される THEN THE Universe SHALL 初期パラメータを設定できる
2. THE 初期パラメータ SHALL ノード数、エッジ構造、初期Entity数、初期エネルギー分布、距離コスト関数、エントロピー率、ノイズ率を含む
3. WHEN ユーザーが一時停止を要求する THEN THE Universe SHALL シミュレーションを一時停止する
4. WHEN ユーザーが再開を要求する THEN THE Universe SHALL シミュレーションを再開する
5. WHEN ユーザーが速度変更を要求する THEN THE Universe SHALL シミュレーション速度を調整する
6. THE Universe SHALL 任意のステップの状態をスナップショットとして保存・復元できる
7. THE Universe SHALL 乱数seedを指定して再現実行できる

### Requirement 16: ガードレール介入

**User Story:** As a シミュレーション観測者, I want to シミュレーションが目的から逸脱した際に介入できる, so that 観測目的を維持できる.

#### Acceptance Criteria

1. WHEN シミュレーションが特定の条件を満たす THEN THE Guardrail SHALL 介入を提案できる
2. THE Guardrail SHALL 介入の種類（パラメータ調整、エネルギー注入、Entity追加など）を選択できる
3. WHEN 介入が実行される THEN THE Universe SHALL 介入内容と理由を記録する
4. THE Guardrail SHALL 介入なしで観測を継続する選択肢を常に提供する
5. THE 介入条件 SHALL ユーザーが定義できる
6. THE 介入 SHALL 公理予算ルールに従い、最小限に留める

---

## 公理一覧（設計するもの）

1. 空間（Graph World: ノードとエッジ）
2. 時間（離散ステップ、seed管理）
3. エネルギー保存則
4. 距離コストと遅延
5. 局所性と知覚制限
6. エントロピーと劣化
7. 有限性と希少性
8. エンティティの基本構造
9. エンティティの行動
10. 相互作用
11. 複製と継承
12. アーティファクト
13. ノイズと偶然
14. 観測と記録（ログのみ）
15. シミュレーション制御
16. ガードレール介入

## 創発を待つもの（設計しない）

- 記憶、学習、言語、技術、社会構造、文化、経済、宗教、政治
- 「人間」「地球」「太陽」などの具体的概念
- インターネット、国家、貨幣などの制度
- 合理的だから存在するという前提
