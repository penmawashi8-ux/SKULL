"""〇×ゲーム（三目並べ）の完全解析。

3^9 通りの盤面ではなく「実際に指されうる対局」をすべて展開して数える。
  - 全対局数と勝敗の内訳
  - 初手の位置（中央・角・辺）ごとの成績
  - 両者最善／片方ランダムのときの勝率
  - 何手目のミスが致命傷になるか（形勢を落とす手の割合）
"""
from functools import lru_cache

LINES = [(0,1,2),(3,4,5),(6,7,8),(0,3,6),(1,4,7),(2,5,8),(0,4,8),(2,4,6)]
CENTER, CORNERS, EDGES = {4}, {0,2,6,8}, {1,3,5,7}


def winner(b):
    for a, c, d in LINES:
        if b[a] and b[a] == b[c] == b[d]:
            return b[a]
    return None


def enumerate_games(b=(0,)*9, turn=1, depth=0, stats=None, first=None):
    """全対局を展開し、結果と長さを集計する。"""
    w = winner(b)
    if w or depth == 9:
        key = 'draw' if not w else ('first' if w == 1 else 'second')
        stats['total'] += 1
        stats[key] += 1
        stats['len'][depth] = stats['len'].get(depth, 0) + 1
        stats['open'][first][key] += 1
        stats['open'][first]['total'] += 1
        return
    for i in range(9):
        if not b[i]:
            nb = b[:i] + (turn,) + b[i+1:]
            f = first if depth else ('中央' if i in CENTER else '角' if i in CORNERS else '辺')
            enumerate_games(nb, 3 - turn, depth + 1, stats, f)


@lru_cache(maxsize=None)
def value(b, turn):
    """手番から見た最善結果を返す（1=勝ち, 0=引き分け, -1=負け）。"""
    w = winner(b)
    if w:
        return 1 if w == turn else -1
    if all(b):
        return 0
    best = -1
    for i in range(9):
        if not b[i]:
            best = max(best, -value(b[:i] + (turn,) + b[i+1:], 3 - turn))
    return best


@lru_cache(maxsize=None)
def prob_vs_random(b, turn, me):
    """me が最善、相手がランダムなときの (勝ち, 引き分け, 負け) 確率。"""
    w = winner(b)
    if w:
        return (1.0, 0.0, 0.0) if w == me else (0.0, 0.0, 1.0)
    if all(b):
        return (0.0, 1.0, 0.0)
    moves = [i for i in range(9) if not b[i]]
    results = [prob_vs_random(b[:i] + (turn,) + b[i+1:], 3 - turn, me) for i in moves]
    if turn == me:
        # 勝ち最大→引き分け最大の順で選ぶ
        return max(results, key=lambda r: (r[0], r[1]))
    n = len(results)
    return tuple(sum(r[k] for r in results) / n for k in range(3))


@lru_cache(maxsize=None)
def prob_both_random(b, turn):
    w = winner(b)
    if w:
        return (1.0, 0.0, 0.0) if w == 1 else (0.0, 0.0, 1.0)
    if all(b):
        return (0.0, 1.0, 0.0)
    moves = [i for i in range(9) if not b[i]]
    rs = [prob_both_random(b[:i] + (turn,) + b[i+1:], 3 - turn) for i in moves]
    return tuple(sum(r[k] for r in rs) / len(rs) for k in range(3))


def blunder_rates():
    """各手数で「形勢を落とす手」が選択肢の何%あるかを数える。"""
    seen = {}

    def walk(b, turn, depth):
        if winner(b) or all(b):
            return
        key = (b, turn)
        if key in seen:
            return
        seen[key] = True
        best = value(b, turn)
        moves = [i for i in range(9) if not b[i]]
        for i in moves:
            nb = b[:i] + (turn,) + b[i+1:]
            v = -value(nb, 3 - turn)
            tally[depth]['moves'] += 1
            if v < best:
                tally[depth]['bad'] += 1
                if best >= 0 and v < 0:
                    tally[depth]['fatal'] += 1   # 勝ち/引分から負けへ転落
            walk(nb, 3 - turn, depth + 1)

    tally = {d: {'moves': 0, 'bad': 0, 'fatal': 0} for d in range(9)}
    walk((0,)*9, 1, 0)
    return tally


if __name__ == '__main__':
    stats = {'total': 0, 'first': 0, 'second': 0, 'draw': 0, 'len': {},
             'open': {k: {'total': 0, 'first': 0, 'second': 0, 'draw': 0}
                      for k in ('中央', '角', '辺')}}
    enumerate_games(stats=stats)
    print('■ 全対局の内訳')
    t = stats['total']
    print(f"  総対局数 {t:,}")
    for k, label in (('first', '先手勝ち'), ('second', '後手勝ち'), ('draw', '引き分け')):
        print(f"  {label} {stats[k]:,} ({stats[k]/t*100:.2f}%)")
    print('  手数別:', {k: f'{v:,}' for k, v in sorted(stats['len'].items())})

    print('\n■ 初手の位置別（全対局ベース）')
    for k, s in stats['open'].items():
        n = s['total']
        print(f"  {k}: {n:,}局  先手勝ち{s['first']/n*100:.2f}%  "
              f"後手勝ち{s['second']/n*100:.2f}%  引分{s['draw']/n*100:.2f}%")

    print('\n■ 最善を尽くした場合')
    print('  初手からの評価値(1=先手勝ち,0=引分):', value((0,)*9, 1))
    for i, name in ((4, '中央'), (0, '角'), (1, '辺')):
        b = (0,)*9
        b = b[:i] + (1,) + b[i+1:]
        print(f'  初手{name}: 後手が最善なら結果 =',
              {1: '後手勝ち', 0: '引き分け', -1: '先手勝ち'}[value(b, 2)])

    print('\n■ 先手が最善・後手がランダムのときの先手成績')
    for i, name in ((4, '中央'), (0, '角'), (1, '辺')):
        b = (0,)*9
        b = b[:i] + (1,) + b[i+1:]
        w, d, l = prob_vs_random(b, 2, 1)
        print(f'  初手{name}: 勝ち{w*100:.2f}% 引分{d*100:.2f}% 負け{l*100:.2f}%')

    w, d, l = prob_both_random((0,)*9, 1)
    print(f'\n■ 両者ランダム: 先手勝ち{w*100:.2f}% 引分{d*100:.2f}% 後手勝ち{l*100:.2f}%')

    print('\n■ 手数ごとの「形勢を落とす手」の割合')
    for d, s in blunder_rates().items():
        if s['moves']:
            print(f"  {d+1}手目: 選択肢{s['moves']:,}中 悪手{s['bad']:,} "
                  f"({s['bad']/s['moves']*100:.1f}%)  うち致命傷{s['fatal']:,} "
                  f"({s['fatal']/s['moves']*100:.1f}%)")
