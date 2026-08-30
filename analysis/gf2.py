"""GF(2) 上の線形代数ユーティリティ（ビットマスク表現）。

盤面もタップ集合も n*n ビットの整数として扱う。
行列は「各列（=各マスをタップしたときの影響範囲）」のリストで表す。
"""


def rref(cols, nbits):
    """列ベクトル集合から、行基本変形で階数・像の基底・核の基底を求める。

    戻り値: (rank, pivot_cols, kernel_basis)
      pivot_cols  … 像の基底を張る列インデックス
      kernel_basis… A·v = 0 を満たす v（タップ集合）のリスト
    """
    n = len(cols)
    # 拡大行列: 各列に「どの列を足し合わせたか」の履歴を持たせる
    vecs = [(cols[i], 1 << i) for i in range(n)]
    pivots = {}          # bit位置 -> vecs のインデックス
    pivot_cols = []
    kernel = []
    for i in range(n):
        v, hist = vecs[i]
        while v:
            b = v.bit_length() - 1
            if b not in pivots:
                pivots[b] = (v, hist)
                pivot_cols.append(i)
                break
            pv, ph = pivots[b]
            v ^= pv
            hist ^= ph
        else:
            # v が 0 になった = この列は既存の列の線形結合 → 核ベクトルが取れる
            kernel.append(hist)
    return len(pivots), pivot_cols, kernel


def solve(cols, nbits, target):
    """A·S = target を満たす S を1つ返す。解なしなら None。"""
    n = len(cols)
    vecs = [(cols[i], 1 << i) for i in range(n)]
    pivots = {}
    for v, hist in vecs:
        while v:
            b = v.bit_length() - 1
            if b not in pivots:
                pivots[b] = (v, hist)
                break
            pv, ph = pivots[b]
            v ^= pv
            hist ^= ph
    t, s = target, 0
    while t:
        b = t.bit_length() - 1
        if b not in pivots:
            return None
        pv, ph = pivots[b]
        t ^= pv
        s ^= ph
    return s
