優先度A（検証データの信頼性）

イベント欠落：LocalRunnerが各tickでslice(-100)分しか取り込まず、イベント多発tickのログが欠けうる（runner.ts (line 135)）
レジーム探索の誤集計：RegimeExplorerが最終tickのreplicationCount等（=そのtickの件数）しか足し込めておらず、分類根拠が弱い（regime-explorer.ts (line 189)、regime-explorer.ts (line 202)）
結果JSONのMap消失：SimulationStatsにMapが含まれ、JSON.stringifyで空に潰れる（observation.ts (line 37)、cli.ts (line 189)）
統計の「このtick」と「累積」が混在：Universe.getStats()がtick内イベントを返す設計なので、探索/比較系は累積化の仕組みが別途必要（universe.ts (line 1277)）
優先度A（再現性・実験制御）

スナップショット再現性が未完：rngStateがseed固定の簡易実装で、途中復元→同一軌跡が再現できない（runner.ts (line 253)、random.ts (line 129)）
設定が配線されていない：UniverseConfig.informationTransferが相互作用/修復には効くが、生成/継承側が別設定のままになりやすい（world-generator.ts (line 282)、universe.ts (line 735)、replication.ts (line 52)）
モジュール別パラメータが露出不足：maintenance/actionCosts/interactionNoise等が固定に近く、レジーム要因の切り分けが難しい（例：entropy.ts (line 15)、action.ts (line 104)、interaction.ts (line 48)）
優先度B（物理/会計の整合性）

エネルギーが負になり得て、死ぬ前に行動もできる：維持コスト/行動失敗で負値になり、死亡判定が最後（universe.ts (line 194)、entropy.ts (line 137)、universe.ts (line 666)）。Snapshot.validateとも矛盾（snapshot.ts (line 203)）
吸熱反応の扱い：反応後エネルギーが負になりうるのを0で丸め、保存則が崩れる（reaction.ts (line 138)）
Beacon定義の不一致：集約/可視化/平均計測で式が揃っていない（universe.ts (line 180)、universe.ts (line 1257)、universe.ts (line 1430)）
エッジ劣化でtravelTimeが累積乗算される（指数増加しやすい）（entropy.ts (line 103)）
優先度B〜C（モデル拡張の前提・未接続）

反応テーブルが“遭遇順”依存：TypeRegistryが共有RNGで遅延生成しており、法則が経路依存になりやすい（type-registry.ts (line 90)、type-registry.ts (line 106)）
タイプと質量の整合：複製でtype変異してもmassが親由来のままになり、baseMassとズレ得る（replication.ts (line 136)、replication.ts (line 227)）
使われていない概念が残る：disasterRate/edge danger/transform/readArtifact/visibleBeacons等（例：observation.ts (line 23)、perception.ts (line 63)）