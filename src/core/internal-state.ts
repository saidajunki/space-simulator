/**
 * InternalState - 有限容量の内部状態
 * Requirements: 7.5, 8.4
 */

/**
 * InternalState - エンティティの内部状態（有限容量）
 */
export class InternalState {
  /** 最大容量（バイト） */
  readonly capacity: number;
  /** データ */
  private data: Uint8Array;

  /**
   * コンストラクタ
   * @param capacity 最大容量（バイト）
   * @param initialData 初期データ
   */
  constructor(capacity: number, initialData?: Uint8Array) {
    this.capacity = capacity;
    if (initialData) {
      if (initialData.length > capacity) {
        throw new Error(`Initial data exceeds capacity: ${initialData.length} > ${capacity}`);
      }
      this.data = new Uint8Array(initialData);
    } else {
      this.data = new Uint8Array(0);
    }
  }

  /**
   * データを取得
   */
  getData(): Uint8Array {
    return new Uint8Array(this.data);
  }

  /**
   * データを設定（容量を超える場合は切り捨て）
   */
  setData(data: Uint8Array): void {
    if (data.length > this.capacity) {
      this.data = data.slice(0, this.capacity);
    } else {
      this.data = new Uint8Array(data);
    }
  }

  /**
   * データを追加（容量を超える場合は古いデータを削除）
   */
  append(data: Uint8Array): void {
    const newData = new Uint8Array(this.data.length + data.length);
    newData.set(this.data);
    newData.set(data, this.data.length);
    
    if (newData.length > this.capacity) {
      // 古いデータを削除
      this.data = newData.slice(newData.length - this.capacity);
    } else {
      this.data = newData;
    }
  }

  /**
   * 現在のサイズを取得
   */
  getSize(): number {
    return this.data.length;
  }

  /**
   * 空き容量を取得
   */
  getFreeSpace(): number {
    return this.capacity - this.data.length;
  }

  /**
   * クリア
   */
  clear(): void {
    this.data = new Uint8Array(0);
  }

  /**
   * コピーを作成
   */
  clone(): InternalState {
    return new InternalState(this.capacity, this.data);
  }

  /**
   * シリアライズ
   */
  serialize(): { capacity: number; data: number[] } {
    return {
      capacity: this.capacity,
      data: Array.from(this.data),
    };
  }

  /**
   * デシリアライズ
   */
  static deserialize(obj: { capacity: number; data: number[] }): InternalState {
    return new InternalState(obj.capacity, new Uint8Array(obj.data));
  }
}
