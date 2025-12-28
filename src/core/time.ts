/**
 * TimeManager - 離散時間ステップの管理
 * Requirements: 2.1, 2.3
 */

/**
 * TimeManager - 離散時間ステップの管理
 */
export class TimeManager {
  /** 現在のtick */
  private tick: number = 0;

  /**
   * コンストラクタ
   * @param initialTick 初期tick（デフォルト0）
   */
  constructor(initialTick: number = 0) {
    this.tick = initialTick;
  }

  /**
   * 時間を1ステップ進める
   */
  advance(): void {
    this.tick += 1;
  }

  /**
   * 現在のtickを取得
   */
  getTick(): number {
    return this.tick;
  }

  /**
   * tickを設定（スナップショット復元用）
   */
  setTick(tick: number): void {
    this.tick = tick;
  }

  /**
   * 状態をシリアライズ
   */
  serialize(): number {
    return this.tick;
  }

  /**
   * 状態をデシリアライズ
   */
  static deserialize(tick: number): TimeManager {
    return new TimeManager(tick);
  }
}
