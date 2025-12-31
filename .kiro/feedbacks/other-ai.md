P0 Validity

検証スクリプトが Universe.getEventLog() を毎tick全走査してイベントを累積過大計上（verify-skill-ab-comparison.ts (line 42), verify-regime-classification.ts (line 119), universe.ts (line 1474)）→ stats.*Count 利用 or tick毎に clearEventLog()（universe.ts (line 1482)）
CLI/JSON出力で SimulationStats の Map フィールドが JSON.stringify で落ちる（observation.ts (line 37), cli.ts (line 200)）
スナップショットの rngState がseed固定の簡易実装で再現不能（runner.ts (line 263), random.ts (line 152)）
レジーム分類が「時間窓分類」(レポート/スクリプト)とコア実装で乖離（regime-explorer.ts (line 83), 2024-12-31-regime-classification.md (line 29), verify-regime-classification.ts (line 35)）
ビューアのノード配置が Math.random() 依存で同seedでも再現不能（useSimulation.ts (line 74)）
P1 Physics

反応エネルギーが負のとき Math.max(0, …) で保存則が破綻（reaction.ts (line 138)）
死亡時は質量→エネルギー放出するのに、複製/生成で質量分のエネルギー支払いがなく帳尻が合わない（energy.ts (line 143), replication.ts (line 129)）
freeEnergy がEnergy以外(Material/Water)まで合算し、指標が誤誘導になり得る（universe.ts (line 1526), energy.ts (line 125), types.ts (line 25)）
entropyRate が維持コスト等に効かず感度分析が歪む（universe.ts (line 165), entropy.ts (line 37)）
Edge劣化で travelTime を累乗的に増やし得る（entropy.ts (line 103)）
P2 Spec/Feature

Beacon強度の計算式が箇所で不整合（知覚用Map vs stats vs landscape）（universe.ts (line 180), universe.ts (line 1262), universe.ts (line 1451)）
Beacon誘引が「強度比例」ではなくargmax移動（universe.ts (line 584)）
Maintainerの「+1 hop」可視化はあるが意思決定側が visibleBeacons を使わず効果が出にくい（perception.ts (line 209), universe.ts (line 584)）
パートナー選好で nodePrestige が全候補に同倍率で効かず無意味（universe.ts (line 1137)）
informationTransfer 設定が分裂しており、トップレベル設定が世界生成/複製継承に反映されない（universe.ts (line 82), universe.ts (line 146), universe.ts (line 174), world-generator.ts (line 52), replication.ts (line 34)）
スキル8種のうちHarvest/Repair/Create以外が未接続（skill.ts (line 9), universe.ts (line 916)）
transform/readArtifact が定義だけ存在し実行経路がない（types.ts (line 35), universe.ts (line 680)）
disaster イベント型はあるが発生/影響モデルがない（observation.ts (line 23)）
P3 Performance/DevEx

Universe直叩き(ビューア/スクリプト)だと eventLog が無限成長し getStats() がO(イベント)化（universe.ts (line 1282), useSimulation.ts (line 153)）
getLandscape() と ArtifactManager.getByNode() が毎回全走査で重くなり得る（universe.ts (line 1435), universe.ts (line 1441), artifact.ts (line 138)）
tickEventCounts がtick数に比例して増える（universe.ts (line 130)）
テスト設定はあるがテストが無く、結論を保護する回帰テスト不足（vitest.config.ts (line 7)）
