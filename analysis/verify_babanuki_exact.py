"""小さいデッキでババ抜きを厳密計算し、モンテカルロと一致するか確かめる。

注意: ババ抜きの局面は循環しうる（ジョーカーとペアの片割れを2人で回し続ける）。
そのため単純な再帰展開は停止しない。ここでは「確率の塊を1手ずつ前進させ、
決着した分を吸収していく」方式を使う。循環しても確率は必ず減衰するので、
残りが十分小さくなった時点で打ち切れば任意精度で厳密値が得られる。
"""
import random
from collections import Counter, defaultdict
from itertools import permutations

from babanuki import discard_pairs

MINI = [0, 0, 1, 1, 2, 2, 13]     # 3ランク×2枚 + ジョーカー = 7枚


def key(hands, turn, n):
    return (tuple(tuple(sorted(h)) for h in hands), turn % n)


def exact(n, deck, eps=1e-13):
    dist = defaultdict(float)
    deals = list(permutations(deck))
    w = 1.0 / len(deals)
    for order in deals:
        hands = [[] for _ in range(n)]
        for i, c in enumerate(order):
            hands[i % n].append(c)
        dist[key([discard_pairs(h) for h in hands], 0, n)] += w

    lose = [0.0] * n
    steps = 0
    while dist:
        steps += 1
        nxt = defaultdict(float)
        for (hands, turn), p in dist.items():
            hands = [list(h) for h in hands]
            alive = [i for i in range(n) if hands[i]]
            if len(alive) <= 1:
                lose[alive[0] if alive else 0] += p
                continue
            cur = turn
            if not hands[cur]:
                nxt[key(hands, cur + 1, n)] += p
                continue
            src = next(((cur + s) % n for s in range(1, n) if hands[(cur + s) % n]), None)
            if src is None:
                lose[cur] += p
                continue
            k = len(hands[src])
            for pos in range(k):
                nh = [list(h) for h in hands]
                nh[cur].append(nh[src].pop(pos))
                nh[cur] = discard_pairs(nh[cur])
                nxt[key(nh, cur + 1, n)] += p / k
        dist = {s: p for s, p in nxt.items() if p > eps}
    return lose, steps


def mini_play(n, rng, deck):
    d = list(deck)
    rng.shuffle(d)
    hands = [[] for _ in range(n)]
    for i, c in enumerate(d):
        hands[i % n].append(c)
    hands = [discard_pairs(h) for h in hands]
    turn = 0
    while True:
        alive = [i for i in range(n) if hands[i]]
        if len(alive) <= 1:
            return alive[0] if alive else 0
        cur = turn % n
        if not hands[cur]:
            turn += 1
            continue
        src = next(((cur + s) % n for s in range(1, n) if hands[(cur + s) % n]), None)
        if src is None:
            return cur
        hands[cur].append(hands[src].pop(rng.randrange(len(hands[src]))))
        hands[cur] = discard_pairs(hands[cur])
        turn += 1


for n in (2, 3):
    ex, steps = exact(n, MINI)
    rng = random.Random(7)
    N = 400000
    mc = Counter(mini_play(n, rng, MINI) for _ in range(N))
    print(f'■ {n}人 / 7枚デッキ（{steps}手先まで展開して収束、合計 {sum(ex):.10f}）')
    for i in range(n):
        a, b = ex[i] * 100, mc[i] / N * 100
        print(f'   席{i+1}: 厳密 {a:6.3f}%   モンテカルロ {b:6.3f}%   '
              f'{"OK" if abs(a - b) < 0.4 else "★ずれ"}')
