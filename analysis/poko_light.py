"""ポコっとライト（Lights Out 系パズル）の完全解析。

3つの影響範囲（プラス型・バツ型・行列型）について、盤面サイズごとに
  - 解ける盤面の割合
  - 最短手数の分布・平均・最大（＝パズルの直径）
を厳密に求める。

理屈:
  タップは可換で、同じマスを2回押すと元に戻る。よって「どのマスを
  奇数回押すか」だけが意味を持ち、盤面の変化は GF(2) 上の線形写像
  A: S(タップ集合) -> d(消灯パターン) になる。
  ある盤面 d が解けるのは d が A の像に入るときだけで、そのときの
  最短手数は解の剰余類 {S0 + v | v ∈ ker A} の中の最小ハミング重み。
"""
import sys
from collections import Counter

from gf2 import rref, solve

VARIANTS = {
    'plus':   'プラス型（上下左右＋自分）',
    'cross':  'バツ型（斜め4方向＋自分）',
    'rowcol': '行列型（同じ行・列すべて）',
}


def build_cols(n, variant):
    """各マスをタップしたときに反転するマスのビットマスクを作る。"""
    cols = []
    for r in range(n):
        for c in range(n):
            m = 1 << (r * n + c)
            if variant == 'plus':
                deltas = ((-1, 0), (1, 0), (0, -1), (0, 1))
            elif variant == 'cross':
                deltas = ((-1, -1), (-1, 1), (1, -1), (1, 1))
            else:
                deltas = ()
            for dr, dc in deltas:
                rr, cc = r + dr, c + dc
                if 0 <= rr < n and 0 <= cc < n:
                    m ^= 1 << (rr * n + cc)
            if variant == 'rowcol':
                for cc in range(n):
                    if cc != c:
                        m ^= 1 << (r * n + cc)
                for rr in range(n):
                    if rr != r:
                        m ^= 1 << (rr * n + c)
            cols.append(m)
    return cols


def analyse(n, variant, exhaustive_limit=24):
    nbits = n * n
    cols = build_cols(n, variant)
    rank, pivot_cols, kernel = rref(cols, nbits)
    nullity = nbits - rank

    result = {
        'n': n, 'variant': variant, 'cells': nbits,
        'rank': rank, 'nullity': nullity,
        'solvable_ratio': 2.0 ** (-nullity),
        'solvable_states': 2 ** rank,
        'total_states': 2 ** nbits,
    }

    if nullity == 0:
        # 核が自明 => A は全単射。解は常に一意なので、最短手数の分布は
        # タップ集合そのものの分布、すなわち二項分布に一致する。
        from math import comb
        dist = {w: comb(nbits, w) for w in range(nbits + 1)}
        result['dist'] = dist
        result['method'] = 'exact-bijection'
    elif rank <= exhaustive_limit:
        # 像の基底（pivot_cols の列）の全組み合わせを回して剰余類の最小重みを取る
        dist = Counter()
        basis_imgs = [cols[i] for i in pivot_cols]
        basis_taps = [1 << i for i in pivot_cols]
        imgs = [0] * (2 ** rank)
        taps = [0] * (2 ** rank)
        for i in range(rank):
            half = 1 << i
            bi, bt = basis_imgs[i], basis_taps[i]
            for j in range(half):
                imgs[half + j] = imgs[j] ^ bi
                taps[half + j] = taps[j] ^ bt
        # 核は基底ベクトルだけでなく、その全線形結合（2^nullity 個）が要素。
        # 剰余類の最小重みを取るには全要素と比較する必要がある。
        quiet = [0]
        for kv in kernel:
            quiet += [q ^ kv for q in quiet]
        for s0 in taps:
            best = min(bin(s0 ^ v).count('1') for v in quiet)
            dist[best] += 1
        result['dist'] = dict(dist)
        result['method'] = 'exact-enumeration'
    else:
        result['dist'] = None
        result['method'] = 'too-large'

    if result['dist']:
        d = result['dist']
        tot = sum(d.values())
        result['mean'] = sum(w * c for w, c in d.items()) / tot
        result['max'] = max(w for w, c in d.items() if c)
    return result


if __name__ == '__main__':
    sizes = [3, 4, 5, 6]
    for variant, label in VARIANTS.items():
        print(f'\n===== {label} =====')
        for n in sizes:
            r = analyse(n, variant)
            ratio = r['solvable_ratio']
            line = (f"{n}x{n}: マス{r['cells']:>2} 階数{r['rank']:>2} 核次元{r['nullity']:>2} "
                    f"解ける割合 1/{int(1/ratio)} ({ratio*100:.4f}%)")
            if r['dist']:
                line += f"  平均最短{r['mean']:.3f}手 最大{r['max']}手 [{r['method']}]"
            else:
                line += "  (分布は計算量過大)"
            print(line)
            sys.stdout.flush()
