"""ババ抜きの構造的な有利不利をモンテカルロで調べる。

心理戦（読み合い・演技）を完全に取り除き、「引く位置は毎回ランダム」と
仮定する。こうすると残るのは配られ方と手番順だけで決まる構造的な差になる。

ルール（ボドゲ広場の実装・記事の記載に合わせる）:
  - トランプ52枚＋ジョーカー1枚の計53枚を配りきる（枚数差は許容）
  - 配られた時点で手札内のペアはすべて捨てる
  - 手番の人は次の席の人から1枚引く（引く方向は固定）
  - 引いてペアができたら捨てる
  - 手札がなくなった人から上がり、最後にジョーカーを持って残った人が負け
"""
import random
import sys
from collections import Counter


def deal(n, rng):
    deck = [r for r in range(13) for _ in range(4)] + [13]   # 13 = ジョーカー
    rng.shuffle(deck)
    hands = [[] for _ in range(n)]
    for i, c in enumerate(deck):
        hands[i % n].append(c)
    return hands


def discard_pairs(hand):
    cnt = Counter(hand)
    out = []
    for r, c in cnt.items():
        if r == 13:
            out += [13] * c
        else:
            out += [r] * (c % 2)      # ペアはすべて捨てる
    return out


def play(n, rng):
    hands = [discard_pairs(h) for h in deal(n, rng)]
    joker_start = next(i for i, h in enumerate(hands) if 13 in h)
    start_sizes = [len(h) for h in hands]

    active = [i for i in range(n) if hands[i]]
    if len(active) <= 1:
        return (active[0] if active else joker_start), joker_start, start_sizes, 0

    turn = 0
    draws = 0
    while True:
        cur = turn % n
        if not hands[cur]:
            turn += 1
            continue
        # 次に手札を持っている席から1枚引く
        src = None
        for step in range(1, n):
            cand = (cur + step) % n
            if hands[cand]:
                src = cand
                break
        if src is None:
            return cur, joker_start, start_sizes, draws   # 自分だけ残った＝負け
        card = hands[src].pop(rng.randrange(len(hands[src])))
        draws += 1
        hands[cur].append(card)
        hands[cur] = discard_pairs(hands[cur])
        remaining = [i for i in range(n) if hands[i]]
        if len(remaining) == 1:
            return remaining[0], joker_start, start_sizes, draws
        turn += 1


def run(n, trials, seed=20260830):
    rng = random.Random(seed + n)
    lose_by_seat = [0] * n
    lose_when_had_joker = 0
    had_joker = [0] * n
    lose_by_startsize = Counter()
    count_by_startsize = Counter()
    total_draws = 0
    for _ in range(trials):
        loser, jstart, sizes, draws = play(n, rng)
        lose_by_seat[loser] += 1
        had_joker[jstart] += 1
        if loser == jstart:
            lose_when_had_joker += 1
        for i, s in enumerate(sizes):
            count_by_startsize[s] += 1
        lose_by_startsize[sizes[loser]] += 1
        total_draws += draws
    return {
        'n': n, 'trials': trials,
        'seat': [c / trials for c in lose_by_seat],
        'joker_keep': lose_when_had_joker / trials,
        'baseline': 1 / n,
        'draws': total_draws / trials,
        'by_size': {s: lose_by_startsize[s] / count_by_startsize[s] * n
                    for s in sorted(count_by_startsize)},
    }


if __name__ == '__main__':
    trials = int(sys.argv[1]) if len(sys.argv) > 1 else 200000
    print(f'試行回数: 各人数 {trials:,} 回\n')
    for n in range(2, 7):
        r = run(n, trials)
        print(f'■ {n}人プレイ（配られる枚数 {53//n}〜{53//n + (1 if 53%n else 0)}枚、平均{r["draws"]:.1f}回引いて終了）')
        print(f'   均等なら各席 {100/n:.2f}%')
        for i, p in enumerate(r['seat']):
            diff = (p - 1/n) * 100
            print(f'   席{i+1}（最初の手番から{i}番目）: 敗率 {p*100:.2f}%  ({diff:+.2f}pt)')
        print(f'   最初にジョーカーを配られた人が負ける確率: {r["joker_keep"]*100:.2f}%'
              f'（無関係なら{100/n:.2f}%）')
        print()
