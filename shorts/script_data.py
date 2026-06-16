"""Scripted BOMB match: 3 players bluffing & taunting.

Each beat = one spoken line synced to one rendered frame.
Voices are differentiated by open-jtalk pitch/rate (see build.py).
"""
from render import PLAYER_COLORS

# speaker -> display name + subtitle chip color
SPEAKERS = {
    "narrator": ("ナレ", (90, 94, 120)),
    "rin": ("リン", PLAYER_COLORS["red"]),
    "sou": ("ソウ", PLAYER_COLORS["blue"]),
    "kai": ("カイ", PLAYER_COLORS["green"]),
}


def card(kind, flipped=False):
    return {"kind": kind, "flipped": flipped}


def board(rin, sou, kai, **kw):
    """Build a game-state board from per-player (stack, bid, points, ...)."""
    def mk(name, color, spec):
        return {
            "name": name, "color": color,
            "stack": spec.get("stack", []),
            "bid": spec.get("bid"),
            "folded": spec.get("folded", False),
            "points": spec.get("points", 0),
            "eliminated": spec.get("eliminated", False),
        }
    st = {
        "players": [
            mk("リン", "red", rin),
            mk("ソウ", "blue", sou),
            mk("カイ", "green", kai),
        ],
        "round": 1,
    }
    st.update(kw)
    return st


# Convenience stacks
BACK1 = [card("back")]
BACK2 = [card("back"), card("back")]


# The full timeline. Each item:
#   kind: 'title'|'rules'|'game'|'outro'
#   speaker, text  -> TTS + subtitle
#   state          -> for 'game' beats (board dict, phase/speaking/emote etc.)
BEATS = [
    # ---- INTRO ----
    dict(kind="title", speaker="narrator",
         text="爆弾を踏ませろ！心理戦ボードゲーム、ボム！",
         title="爆弾か、りんごか。", sub="嘘で相手に爆弾を踏ませろ"),

    # ---- 2-SEC RULES ----
    dict(kind="rules", speaker="narrator",
         text="カードを伏せて宣言。多くめくると言った人が実行、爆弾を踏んだら負け！",
         items=["「何枚めくれる」と宣言し合い",
                "一番強気な人がめくる役に。",
                "爆弾を踏んだら手札を失う！"]),

    # ---- PLACE PHASE ----
    dict(kind="game", speaker="sou", text="さあ始めるか。俺はりんご二枚、安全に積むぜ。",
         state=board(
             {"stack": BACK1}, {"stack": BACK2, "bid": None}, {"stack": BACK1},
             phase="カードを伏せる", speaking="ソウ")),

    dict(kind="game", speaker="rin", text="ふーん？私は一枚だけ。中身は…ナイショだよ。",
         state=board(
             {"stack": BACK1}, {"stack": BACK2}, {"stack": BACK1},
             phase="カードを伏せる", speaking="リン")),

    dict(kind="game", speaker="kai", text="リン一枚だけって、ぜったい爆弾じゃん。読めたわ。",
         state=board(
             {"stack": BACK1}, {"stack": BACK2}, {"stack": BACK1},
             phase="カードを伏せる", speaking="カイ")),

    # rin sends a fake apple emote (she's actually holding a bomb)
    dict(kind="game", speaker="rin", text="えー、りんごだってば。ほら、安全アピール！",
         state=board(
             {"stack": BACK1}, {"stack": BACK2}, {"stack": BACK1},
             phase="カードを伏せる", speaking="リン", emote=("リン", "apple"))),

    # ---- BID PHASE ----
    dict(kind="game", speaker="sou", text="場は四枚。まずは…俺が三枚いけると宣言する。",
         state=board(
             {"stack": BACK1}, {"stack": BACK2, "bid": 3}, {"stack": BACK1},
             phase="宣言フェーズ", speaking="ソウ", declare=3)),

    dict(kind="game", speaker="kai", text="三枚？甘い甘い、俺は四枚全部めくってやるよ！",
         state=board(
             {"stack": BACK1}, {"stack": BACK2, "bid": 3}, {"stack": BACK1, "bid": 4},
             phase="宣言フェーズ", speaking="カイ", declare=4)),

    dict(kind="game", speaker="rin", text="カイくん威勢いいねぇ。私はパス。せいぜい頑張って？",
         state=board(
             {"stack": BACK1, "folded": True}, {"stack": BACK2, "bid": 3},
             {"stack": BACK1, "bid": 4},
             phase="宣言フェーズ", speaking="リン", emote=("リン", "apple"))),

    # sou folds — baiting kai into executing
    dict(kind="game", speaker="sou", text="ふっ…俺もパスだ。カイ、お前がめくれ。",
         state=board(
             {"stack": BACK1, "folded": True}, {"stack": BACK2, "folded": True},
             {"stack": BACK1, "bid": 4},
             phase="宣言フェーズ", speaking="ソウ")),

    dict(kind="game", speaker="kai", text="は、二人ともビビった?余裕で四枚いただくわ。",
         state=board(
             {"stack": BACK1, "folded": True}, {"stack": BACK2, "folded": True},
             {"stack": BACK1, "bid": 4},
             phase="めくり開始！", speaking="カイ")),

    # ---- FLIP PHASE ----
    # kai flips own apple (1)
    dict(kind="game", speaker="kai", text="まず自分の…りんご!一枚目セーフ。",
         state=board(
             {"stack": BACK1, "folded": True}, {"stack": BACK2, "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="めくり 1 / 4", speaking="カイ")),

    # kai flips sou's two apples (2,3)
    dict(kind="game", speaker="kai", text="ソウのも…りんご、りんご!三枚目、楽勝だっての。",
         state=board(
             {"stack": BACK1, "folded": True},
             {"stack": [card("apple", True), card("apple", True)], "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="めくり 3 / 4", speaking="カイ")),

    dict(kind="game", speaker="sou", text="さあ、最後はリンのカードだなぁ?どうなるかな。",
         state=board(
             {"stack": BACK1, "folded": True},
             {"stack": [card("apple", True), card("apple", True)], "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="ラスト 1 枚！", speaking="ソウ", emote=("ソウ", "bomb"))),

    dict(kind="game", speaker="kai", text="リンのはりんごだろ?さっき安全って…いくぞ!",
         state=board(
             {"stack": BACK1, "folded": True},
             {"stack": [card("apple", True), card("apple", True)], "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="ラスト 1 枚！", speaking="カイ")),

    # BOMB!
    dict(kind="game", speaker="narrator", text="ドカーン!リンの一枚は…爆弾だった!",
         state=board(
             {"stack": [card("bomb", True)], "folded": True},
             {"stack": [card("apple", True), card("apple", True)], "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="爆発！", speaking="リン",
             flip_lit={"リン": 0})),

    dict(kind="game", speaker="rin", text="あはは!りんごって言ったの、あれぜんぶ嘘でーす!",
         state=board(
             {"stack": [card("bomb", True)], "folded": True},
             {"stack": [card("apple", True), card("apple", True)], "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="リンの作戦勝ち", speaking="リン", emote=("リン", "bomb"),
             flip_lit={"リン": 0})),

    dict(kind="game", speaker="kai", text="うわー、まんまと釣られた…手札一枚失ったし…",
         state=board(
             {"stack": [card("bomb", True)], "folded": True},
             {"stack": [card("apple", True), card("apple", True)], "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="カイ 爆死…", speaking="カイ", flip_lit={"リン": 0})),

    dict(kind="game", speaker="sou", text="計画通り。煽ってくる奴ほど、よく釣れるんだよ。",
         state=board(
             {"stack": [card("bomb", True)], "folded": True},
             {"stack": [card("apple", True), card("apple", True)], "folded": True},
             {"stack": [card("apple", True)], "bid": 4},
             phase="リンの作戦勝ち", speaking="ソウ", emote=("ソウ", "apple"),
             flip_lit={"リン": 0})),

    # ---- OUTRO / AD ----
    dict(kind="outro", speaker="narrator",
         text="このボム、ボードゲーム広場で今すぐ無料で遊べる!友達と騙し合おう!"),
]
