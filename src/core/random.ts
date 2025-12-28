/**
 * RandomGenerator - 再現可能な乱数生成
 * Requirements: 2.5, 13.6
 * 
 * xorshift128+アルゴリズムを使用（高速で品質が良い）
 */

/**
 * RandomGenerator - seed管理による再現可能な乱数生成
 */
export class RandomGenerator {
  private state: [bigint, bigint];
  private readonly initialSeed: number;

  /**
   * コンストラクタ
   * @param seed 乱数seed
   */
  constructor(seed: number) {
    this.initialSeed = seed;
    // seedから初期状態を生成（splitmix64で初期化）
    this.state = this.initializeState(seed);
  }

  /**
   * seedから初期状態を生成（splitmix64）
   */
  private initializeState(seed: number): [bigint, bigint] {
    let s = BigInt(seed);
    
    const splitmix64 = (): bigint => {
      s = (s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
      let z = s;
      z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
      z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
      return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
    };

    return [splitmix64(), splitmix64()];
  }

  /**
   * 次の乱数を生成（xorshift128+）
   */
  private next(): bigint {
    let [s0, s1] = this.state;
    const result = (s0 + s1) & 0xffffffffffffffffn;
    
    s1 ^= s0;
    s0 = ((s0 << 55n) | (s0 >> 9n)) ^ s1 ^ (s1 << 14n);
    s1 = (s1 << 36n) | (s1 >> 28n);
    
    this.state = [s0 & 0xffffffffffffffffn, s1 & 0xffffffffffffffffn];
    return result;
  }

  /**
   * 0以上1未満の乱数を生成
   */
  random(): number {
    const value = this.next();
    // 53ビットの精度でdoubleに変換
    const shifted = value >> 11n;
    const divisor = 2 ** 53;
    return Number(shifted) / divisor;
  }

  /**
   * min以上max以下の整数乱数を生成
   */
  randomInt(min: number, max: number): number {
    const range = max - min + 1;
    return Math.floor(this.random() * range) + min;
  }

  /**
   * 配列からランダムに1つ選択
   */
  randomChoice<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    const index = this.randomInt(0, items.length - 1);
    return items[index]!;
  }

  /**
   * 確率pでtrueを返す
   */
  randomWithProbability(p: number): boolean {
    return this.random() < p;
  }

  /**
   * 正規分布に従う乱数を生成（Box-Muller法）
   */
  randomNormal(mean: number = 0, stddev: number = 1): number {
    const u1 = this.random();
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stddev + mean;
  }

  /**
   * 配列をシャッフル（Fisher-Yates）
   */
  shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  /**
   * 値に変異を適用
   * @param value 元の値
   * @param rate 変異率 (0-1)
   * @param magnitude 変異の大きさ
   */
  mutateNumber(value: number, rate: number, magnitude: number = 0.1): number {
    if (this.randomWithProbability(rate)) {
      return value + this.randomNormal(0, magnitude);
    }
    return value;
  }

  /**
   * バイト配列に変異を適用
   */
  mutateBytes(data: Uint8Array, rate: number): Uint8Array {
    const result = new Uint8Array(data);
    for (let i = 0; i < result.length; i++) {
      if (this.randomWithProbability(rate)) {
        result[i] = this.randomInt(0, 255);
      }
    }
    return result;
  }

  /**
   * 初期seedを取得
   */
  getSeed(): number {
    return this.initialSeed;
  }

  /**
   * 状態をシリアライズ
   */
  serialize(): { seed: number; state: [string, string] } {
    return {
      seed: this.initialSeed,
      state: [this.state[0].toString(), this.state[1].toString()],
    };
  }

  /**
   * 状態をデシリアライズ
   */
  static deserialize(data: { seed: number; state: [string, string] }): RandomGenerator {
    const rng = new RandomGenerator(data.seed);
    rng.state = [BigInt(data.state[0]), BigInt(data.state[1])];
    return rng;
  }
}
