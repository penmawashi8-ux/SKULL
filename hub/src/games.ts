// サイト全体で使うゲーム一覧のデータ。
// App.tsx（トップページ）だけでなく、一覧ページ・各ページ共通のフッター
// ナビからも参照するため、独立したモジュールに置いている。

export const BOMB_GAME_URL = 'https://bomb.boardgamecat.com'

export type GameStatus = 'available' | 'coming-soon'
export type Genre = 'all' | 'trump' | 'bluff' | 'solo' | 'other'

export interface Game {
  id: string
  name: string
  nameEn: string
  symbol: string
  description: string
  status: GameStatus
  url?: string
  accentColor: string
  cardBg: string
  players: string
  duration: string
  tags: string[]
}

export const GENRES: { id: Genre; label: string }[] = [
  { id: 'all',   label: 'すべて' },
  { id: 'bluff', label: 'ブラフ' },
  { id: 'trump', label: 'トランプ' },
  { id: 'solo',  label: '1人用' },
  { id: 'other', label: 'その他' },
]

export const GENRE_COLORS: Record<Genre, string> = {
  all:   '#ffd43b',
  bluff: '#c084fc',
  trump: '#60a5fa',
  solo:  '#fde68a',
  other: '#34d399',
}

export function matchGenre(game: Game, genre: Genre): boolean {
  if (genre === 'all') return true
  if (genre === 'bluff') return game.tags.includes('ブラフ')
  if (genre === 'trump') return game.tags.includes('トランプ')
  if (genre === 'solo') return game.tags.includes('1人用')
  return !game.tags.includes('ブラフ') && !game.tags.includes('トランプ') && !game.tags.includes('1人用')
}

export const games: Game[] = [
  {
    id: 'bomb',
    name: 'BOMB',
    nameEn: 'BOMB',
    symbol: 'BM',
    description: '爆弾かリンゴか——ブラフと心理戦が熱いパーティゲーム。仲間を騙して爆発を回避せよ！',
    status: 'available',
    url: BOMB_GAME_URL,
    accentColor: '#f87171',
    cardBg: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)',
    players: '1〜6人（CPU可）',
    duration: '約20分',
    tags: ['ブラフ', '心理戦', 'パーティ'],
  },
  {
    id: 'pig-tail',
    name: 'ぶたのしっぽ',
    nameEn: "PIG'S TAIL",
    symbol: 'PT',
    description: 'カードをめくって中央に積んでいく。マークが一致したら山を全部もらい、手札を一番少なく抑えた人が勝ち。',
    status: 'available',
    url: 'https://buta.boardgamecat.com',
    accentColor: '#f9a8d4',
    cardBg: 'linear-gradient(135deg, #831843 0%, #be185d 100%)',
    players: '1〜6人',
    duration: '約10〜20分',
    tags: ['トランプ', 'パーティ'],
  },
  {
    id: 'keiba',
    name: 'バーチャル競馬',
    nameEn: 'VIRTUAL KEIBA',
    symbol: 'VK',
    description: '馬を選んで予想して観戦！バーチャル競馬で白熱のゴール勝負を楽しもう。実際の賭けや金銭のやりとりは一切なく、純粋にゲームとして楽しめます。',
    status: 'available',
    url: 'https://gamekeiba.boardgamecat.com',
    accentColor: '#6ee7b7',
    cardBg: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
    players: '1人〜',
    duration: '約5〜10分',
    tags: ['競馬', '予想', 'バーチャル'],
  },
  {
    id: 'page-one',
    name: 'ページワン',
    nameEn: 'PAGE ONE',
    symbol: 'PO',
    description: '手札のマークが合えばカードを出せる。最後の1枚になったら「ページワン！」と宣言。手札をなくした人が勝ちのトランプゲーム。',
    status: 'available',
    url: 'https://pageone.boardgamecat.com',
    accentColor: '#93c5fd',
    cardBg: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    players: '1〜4人',
    duration: '約15〜30分',
    tags: ['トランプ', '特殊カード', 'パーティ'],
  },
  {
    id: 'coup',
    name: '謀略',
    nameEn: 'BORYAKU',
    symbol: 'BK',
    description: '嘘をついても、バレなければ勝ち。持っていないキャラクターも堂々と宣言し、ライバルを蹴落とせ！最後に生き残った者が勝者。',
    status: 'available',
    url: 'https://bouryaku.boardgamecat.com',
    accentColor: '#86efac',
    cardBg: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
    players: '1〜6人（CPU可）',
    duration: '約15〜30分',
    tags: ['ブラフ', '心理戦', '推理'],
  },
  {
    id: 'shinkei',
    name: '神経衰弱',
    nameEn: 'CONCENTRATION',
    symbol: 'SS',
    description: '同じ数字のカードをめくってペアを集める定番の記憶ゲーム。ローカルルール「泥棒セブン」で7のペアを取れば相手のペアを奪える！招待URLでオンライン対戦にも対応。',
    status: 'available',
    url: '/play/shinkei/',
    accentColor: '#67e8f9',
    cardBg: 'linear-gradient(135deg, #164e63 0%, #0891b2 100%)',
    players: '1〜2人',
    duration: '約5〜10分',
    tags: ['トランプ', '記憶力', '1人用', 'オンライン対戦'],
  },
  {
    id: 'reversi',
    name: 'リバーシ',
    nameEn: 'REVERSI',
    symbol: 'RV',
    description: '相手の石をはさんでひっくり返す定番ボードゲーム。ローカルルール「おかわりマス」で星マスに置けばもう1手打てる！招待URLでオンライン対戦にも対応。',
    status: 'available',
    url: '/play/reversi/',
    accentColor: '#a3e635',
    cardBg: 'linear-gradient(135deg, #1a2e05 0%, #4d7c0f 100%)',
    players: '1〜2人',
    duration: '約10〜15分',
    tags: ['ボードゲーム', '戦略', '1人用', 'オンライン対戦'],
  },
  {
    id: 'gomoku',
    name: '五目並べ',
    nameEn: 'GOMOKU',
    symbol: 'GM',
    description: '先に5つ並べたら勝ちの定番ボードゲーム。ローカルルール「クラッシュマス」で相手の石を吹き飛ばせ！野良マッチ・部屋コードでオンライン対戦対応。',
    status: 'available',
    url: '/play/gomoku/',
    accentColor: '#fbbf24',
    cardBg: 'linear-gradient(135deg, #452a03 0%, #b45309 100%)',
    players: '1〜2人',
    duration: '約5〜15分',
    tags: ['ボードゲーム', '戦略', '1人用', 'オンライン対戦'],
  },
  {
    id: 'marubatsu',
    name: 'まるばつ',
    nameEn: 'TIC-TAC-TOE',
    symbol: 'MB',
    description: '3つ並べたら勝ちの超定番。ローカルルール「消えるまるばつ」なら4個目で最古のマークが消えて、引き分け無しの熱い読み合いに！オンライン対戦対応。',
    status: 'available',
    url: '/play/marubatsu/',
    accentColor: '#f472b6',
    cardBg: 'linear-gradient(135deg, #500724 0%, #be185d 100%)',
    players: '1〜2人',
    duration: '約1〜5分',
    tags: ['定番', '1人用', 'オンライン対戦'],
  },
  {
    id: 'daifugo',
    name: '大富豪',
    nameEn: 'DAIFUGO',
    symbol: 'DF',
    description: '手札をいちばん早く出し切れ！革命・8切り・11バック・都落ち・連戦モードなど21種のローカルルールを選択制で搭載し、さらに自分だけのルールも作れる定番トランプ。最大4人のオンライン対戦対応。',
    status: 'available',
    url: '/play/daifugo/',
    accentColor: '#fb7185',
    cardBg: 'linear-gradient(135deg, #4c0519 0%, #e11d48 100%)',
    players: '1〜4人',
    duration: '約10〜20分',
    tags: ['トランプ', '定番', '1人用', 'オンライン対戦'],
  },
  {
    id: 'babanuki',
    name: 'ババ抜き',
    nameEn: 'OLD MAID',
    symbol: 'BN',
    description: 'となりの手札から1枚引いてペアを捨てる超定番。ローカルルール「にせジョーカー」はどちらが本物か最後までわからない！最大4人のオンライン対戦対応。',
    status: 'available',
    url: '/play/babanuki/',
    accentColor: '#c084fc',
    cardBg: 'linear-gradient(135deg, #3b0764 0%, #9333ea 100%)',
    players: '1〜4人',
    duration: '約5〜10分',
    tags: ['トランプ', '定番', '1人用', 'オンライン対戦'],
  },
  {
    id: 'sevens',
    name: '7並べ',
    nameEn: 'SEVENS',
    symbol: 'SV',
    description: '7から順にカードをつなげて置いていく定番トランプ。パスは3回まで。A-K連結・ジョーカー・オリジナルの「ブレイクスルー」を選択制で搭載。最大4人のオンライン対戦対応。',
    status: 'available',
    url: '/play/sevens/',
    accentColor: '#38bdf8',
    cardBg: 'linear-gradient(135deg, #082f49 0%, #0284c7 100%)',
    players: '1〜4人',
    duration: '約5〜15分',
    tags: ['トランプ', '定番', '1人用', 'オンライン対戦'],
  },
  {
    id: 'sugoroku',
    name: 'すごろく',
    nameEn: 'SUGOROKU',
    symbol: 'SG',
    description: 'サイコロを振ってゴールを目指す定番すごろく。最大4人のオンライン対戦対応！ローカルルール「ドッスン」で相手をふっとばせ。',
    status: 'available',
    url: '/play/sugoroku/',
    accentColor: '#34d399',
    cardBg: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
    players: '1〜4人',
    duration: '約5〜15分',
    tags: ['すごろく', 'パーティ', '1人用', 'オンライン対戦'],
  },
  {
    id: 'poko-light',
    name: 'ポコっとライト',
    nameEn: 'POKO LIGHT',
    symbol: 'PL',
    description: '全部のライトを点けたらクリア！完全1人用パズルゲーム。',
    status: 'available',
    url: 'https://poko.boardgamecat.com',
    accentColor: '#fde68a',
    cardBg: 'linear-gradient(135deg, #3d2900 0%, #b45309 100%)',
    players: '1人',
    duration: '数分〜',
    tags: ['パズル', '1人用'],
  },
  // 「？？？ 鋭意制作中」のプレースホルダーは中身が無く、
  // 制作中ページとみなされるため掲載しない。公開できる新作が
  // 出来た時点で status: 'coming-soon' の実エントリを追加すること。
]
