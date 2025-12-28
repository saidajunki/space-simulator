# Requirements Document

## Introduction

AIエージェントによる宇宙シミュレーションシステム。宇宙という土台の上に地球があり、その中で人々が生まれ、遺伝子を継承し、対話を通じてサービスや環境を創造し、結婚・繁殖を行う。遺伝的アルゴリズムをベースにしながら、個体の進化だけでなく、世界全体がどのような方向に進むのかを観測することを目的とする。

## Glossary

- **Universe**: シミュレーション全体を包含する最上位の環境
- **World**: 宇宙内に存在する惑星（地球など）
- **Agent**: 世界内で活動する個体（人間）
- **Gene**: エージェントの特性を決定する遺伝情報
- **Interaction**: エージェント間の対話・協力・競争
- **Service**: エージェントが創造する価値提供の仕組み
- **Environment**: エージェントの活動によって変化する世界の状態
- **Generation**: 世代、時間の経過による世代交代
- **Observation**: シミュレーション結果の観測・記録

## Requirements

### Requirement 1: 宇宙と世界の構築

**User Story:** As a シミュレーション観測者, I want to 宇宙と世界の基盤を構築する, so that エージェントが活動できる環境が整う.

#### Acceptance Criteria

1. WHEN シミュレーションが初期化される THEN THE Universe SHALL 少なくとも1つのWorldを含む状態で生成される
2. WHEN Worldが生成される THEN THE World SHALL 環境パラメータ（資源量、気候、地形など）を持つ
3. WHILE シミュレーションが実行中 THEN THE World SHALL 時間経過に応じて環境状態を更新する
4. WHEN 環境状態が変化する THEN THE Universe SHALL その変化を記録する

### Requirement 2: エージェントの生成と遺伝

**User Story:** As a シミュレーション観測者, I want to エージェントが遺伝子を持ち親から継承する, so that 世代を超えた進化を観測できる.

#### Acceptance Criteria

1. WHEN 初期エージェントが生成される THEN THE Agent SHALL ランダムな遺伝子セットを持つ
2. WHEN 2つのエージェントが繁殖する THEN THE 子Agent SHALL 両親の遺伝子を組み合わせて継承する
3. WHEN 遺伝子が継承される THEN THE Gene SHALL 一定確率で突然変異を起こす
4. THE Gene SHALL エージェントの能力値（知性、社交性、創造性、体力など）を決定する
5. WHEN エージェントが生成される THEN THE Agent SHALL 一意のIDと生成時刻を持つ

### Requirement 3: エージェント間の対話

**User Story:** As a シミュレーション観測者, I want to エージェント同士が対話・協力・競争する, so that 社会的な相互作用を観測できる.

#### Acceptance Criteria

1. WHEN 2つのエージェントが近接する THEN THE Agent SHALL 対話を開始できる
2. WHEN 対話が発生する THEN THE Interaction SHALL 両エージェントの遺伝子と状態に基づいて結果を決定する
3. WHEN 対話が成功する THEN THE Agent SHALL 関係性スコアを更新する
4. WHEN 関係性スコアが閾値を超える THEN THE Agent SHALL 協力関係または結婚関係を形成できる
5. IF 対話が失敗する THEN THE Agent SHALL 関係性スコアを減少させる

### Requirement 4: サービスと環境の創造

**User Story:** As a シミュレーション観測者, I want to エージェントがサービスや環境を創造する, so that 文明の発展を観測できる.

#### Acceptance Criteria

1. WHEN エージェントの創造性が閾値を超える THEN THE Agent SHALL 新しいServiceを生成できる
2. WHEN Serviceが生成される THEN THE Service SHALL 創造者の遺伝子特性を反映する
3. WHEN 複数のエージェントが協力する THEN THE Agent SHALL より高度なServiceを共同で生成できる
4. WHEN Serviceが利用される THEN THE Environment SHALL その影響を受けて変化する
5. WHILE Serviceが存在する THEN THE Service SHALL 利用頻度に応じて進化または衰退する

### Requirement 5: 結婚と繁殖

**User Story:** As a シミュレーション観測者, I want to エージェントが結婚し子孫を残す, so that 世代交代と遺伝的進化を観測できる.

#### Acceptance Criteria

1. WHEN 2つのエージェントが結婚関係にある THEN THE Agent SHALL 子エージェントを生成できる
2. WHEN 子エージェントが生成される THEN THE 子Agent SHALL 両親の遺伝子を継承する
3. WHEN エージェントが一定年齢に達する THEN THE Agent SHALL 死亡し世界から除去される
4. WHILE エージェントが生存中 THEN THE Agent SHALL 年齢に応じて能力値が変化する
5. IF 世界の人口が上限を超える THEN THE World SHALL 資源競争を激化させる

### Requirement 6: 世界の進化観測

**User Story:** As a シミュレーション観測者, I want to 世界全体の進化方向を観測する, so that 文明がどのような方向に進むかを理解できる.

#### Acceptance Criteria

1. WHEN 世代が進む THEN THE Observation SHALL 人口統計、遺伝子分布、サービス数を記録する
2. WHEN 観測が行われる THEN THE Observation SHALL 世界の「方向性指標」を計算する
3. THE 方向性指標 SHALL 技術発展度、社会協調度、多様性指数を含む
4. WHEN シミュレーションが終了する THEN THE Universe SHALL 全観測データをエクスポートする
5. WHILE シミュレーション実行中 THEN THE Observation SHALL リアルタイムで統計を可視化できる

### Requirement 7: シミュレーション制御

**User Story:** As a シミュレーション観測者, I want to シミュレーションを制御する, so that 様々な条件で実験できる.

#### Acceptance Criteria

1. WHEN シミュレーションが開始される THEN THE Universe SHALL 初期パラメータを設定できる
2. THE 初期パラメータ SHALL 初期人口、突然変異率、環境条件を含む
3. WHEN ユーザーが一時停止を要求する THEN THE Universe SHALL シミュレーションを一時停止する
4. WHEN ユーザーが再開を要求する THEN THE Universe SHALL シミュレーションを再開する
5. WHEN ユーザーが速度変更を要求する THEN THE Universe SHALL シミュレーション速度を調整する
