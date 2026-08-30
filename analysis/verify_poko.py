"""poko_light.py の結果を、独立した総当たり計算と突き合わせて検証する。

線形代数を一切使わず「全タップ集合を試して各盤面の最小手数を記録」する
素朴な方法で分布を出し、解析側の結果と一致するか確認する。
"""
from collections import Counter

import numpy as np

from poko_light import VARIANTS, analyse, build_cols


def brute(n, variant):
    nbits = n * n
    cols = build_cols(n, variant)
    size = 1 << nbits
    states = np.zeros(size, dtype=np.int64)
    weights = np.zeros(size, dtype=np.int8)
    for i in range(nbits):
        half = 1 << i
        states[half:half * 2] = states[:half] ^ cols[i]
        weights[half:half * 2] = weights[:half] + 1
    best = np.full(size, 127, dtype=np.int8)
    order = np.argsort(-weights, kind='stable')      # 重い順に書くと最後に最小が残る
    best[states[order]] = weights[order]
    reached = best[best < 127]
    return Counter(int(w) for w in reached)


for variant in VARIANTS:
    for n in (3, 4, 5):
        if n == 5 and variant != 'plus':
            pass  # 5x5 は全変種を確認する
        got = brute(n, variant)
        want = {int(k): int(v) for k, v in analyse(n, variant)['dist'].items() if v}
        got = {k: v for k, v in got.items() if v}
        ok = got == want
        print(f'{variant:7} {n}x{n}: {"一致" if ok else "不一致"}  '
              f'解ける盤面数={sum(got.values())} 平均={sum(k*v for k,v in got.items())/sum(got.values()):.3f} '
              f'最大={max(got)}')
        if not ok:
            print('   brute:', dict(sorted(got.items())))
            print('   calc :', dict(sorted(want.items())))
