"""babanuki.py の席順結果を、独立に書いた素朴な実装と突き合わせる。

手札を「ランクごとの枚数」ではなくカードのリストとして扱い、
ペア処理・手番管理も別のロジックで書き直している。
"""
import random
from collections import Counter

from babanuki import play as fast_play


def naive_play(n, rng):
    deck = [r for r in range(13) for _ in range(4)] + [13]
    rng.shuffle(deck)
    hands = [deck[i::1][j] for i, j in []] or [[] for _ in range(n)]
    for i, c in enumerate(deck):
        hands[i % n].append(c)

    def strip(h):
        # ペアを1組ずつ取り除く（見つからなくなるまで繰り返す）
        while True:
            for a in range(len(h)):
                for b in range(a + 1, len(h)):
                    if h[a] == h[b] and h[a] != 13:
                        del h[b]
                        del h[a]
                        break
                else:
                    continue
                break
            else:
                return h

    hands = [strip(h) for h in hands]
    alive = lambda: [i for i in range(n) if hands[i]]
    if len(alive()) <= 1:
        a = alive()
        return a[0] if a else 0

    cur = 0
    while True:
        if not hands[cur]:
            cur = (cur + 1) % n
            continue
        src = None
        for step in range(1, n):
            if hands[(cur + step) % n]:
                src = (cur + step) % n
                break
        if src is None:
            return cur
        pos = rng.randrange(len(hands[src]))
        hands[cur].append(hands[src].pop(pos))
        strip(hands[cur])
        a = alive()
        if len(a) == 1:
            return a[0]
        cur = (cur + 1) % n


TRIALS = 40000
for n in (3, 5, 6):
    r1 = Counter()
    rng = random.Random(999 + n)
    for _ in range(TRIALS):
        r1[naive_play(n, rng)] += 1
    r2 = Counter()
    rng2 = random.Random(4242 + n)
    for _ in range(TRIALS):
        r2[fast_play(n, rng2)[0]] += 1
    print(f'■ {n}人 ({TRIALS:,}回ずつ)')
    for i in range(n):
        a, b = r1[i] / TRIALS * 100, r2[i] / TRIALS * 100
        flag = 'OK' if abs(a - b) < 1.0 else '★ずれ'
        print(f'   席{i+1}: 素朴実装 {a:5.2f}%   本実装 {b:5.2f}%   {flag}')
