import { useState, useEffect, useRef } from 'react'

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

interface Card {
  suit: Suit
  rank: Rank
  id: string
}

type PenaltyLevel = 0 | 1 | 2 | 3 | 4

interface Player {
  id: string
  name: string
  hand: Card[]
  penalty: PenaltyLevel
  isHuman: boolean
  isEliminated: boolean
}

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const PENALTY_LETTERS = ['B', 'U', 'T', 'A']
const CPU_NAMES = ['ぶー太', 'こぶ太', 'ぶーこ']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function dealCards(numPlayers: number): Card[][] {
  const selectedRanks = shuffle([...RANKS]).slice(0, numPlayers)
  const deck = shuffle(
    selectedRanks.flatMap(rank => SUITS.map(suit => ({ suit, rank, id: `${rank}-${suit}` })))
  )
  return Array.from({ length: numPlayers }, (_, i) => deck.slice(i * 4, (i + 1) * 4))
}

function has4OfKind(hand: Card[]): boolean {
  const counts: Record<string, number> = {}
  for (const c of hand) counts[c.rank] = (counts[c.rank] || 0) + 1
  return Object.values(counts).some(n => n >= 4)
}

function cpuPickCard(hand: Card[]): Card {
  const counts: Record<string, number> = {}
  for (const c of hand) counts[c.rank] = (counts[c.rank] || 0) + 1
  const minCount = Math.min(...Object.values(counts))
  const weakRanks = (Object.keys(counts) as Rank[]).filter(r => counts[r] === minCount)
  const rank = weakRanks[Math.floor(Math.random() * weakRanks.length)]
  const candidates = hand.filter(c => c.rank === rank)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

const isRed = (suit: Suit) => suit === '♥' || suit === '♦'

function CardFace({
  card,
  selected,
  onClick,
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={[
        'relative w-14 h-20 rounded-lg border-2 bg-white flex flex-col p-1 font-bold transition-all duration-200 select-none',
        isRed(card.suit) ? 'text-red-600' : 'text-gray-900',
        selected
          ? 'border-yellow-400 shadow-lg shadow-yellow-400/60 -translate-y-4 scale-110 z-10'
          : onClick
            ? 'border-gray-300 hover:border-yellow-300 hover:-translate-y-2 cursor-pointer'
            : 'border-gray-300 cursor-default',
      ].join(' ')}
    >
      <div className="text-xs font-black leading-none">{card.rank}</div>
      <div className="text-base leading-none">{card.suit}</div>
    </button>
  )
}

function CardBack() {
  return (
    <div className="w-9 h-14 rounded-lg border-2 border-green-600 bg-gradient-to-br from-green-800 to-green-900 shadow" />
  )
}

function PenaltyBar({ penalty, name }: { penalty: PenaltyLevel; name: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-white/50 truncate max-w-[4.5rem]">{name}</span>
      <div className="flex gap-0.5">
        {PENALTY_LETTERS.map((letter, i) => (
          <span
            key={letter}
            className={[
              'text-[10px] font-black w-4 h-4 rounded flex items-center justify-center',
              i < penalty ? 'bg-red-500 text-white' : 'bg-white/10 text-white/20',
            ].join(' ')}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  )
}

type Screen = 'setup' | 'game' | 'gameover'
type Phase = 'selecting' | 'passing' | 'touching' | 'result'

export default function PigTailGame() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [numCpu, setNumCpu] = useState<1 | 2 | 3>(2)
  const [players, setPlayers] = useState<Player[]>([])
  const [phase, setPhase] = useState<Phase>('selecting')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [winner, setWinner] = useState('')
  const [touchDeadline, setTouchDeadline] = useState(0)
  const [humanTouched, setHumanTouched] = useState(false)
  const [touchList, setTouchList] = useState<{ name: string; ms: number }[]>([])
  const [resultMsg, setResultMsg] = useState('')

  const touchStartRef = useRef(0)
  const touchesRef = useRef<{ id: string; ms: number }[]>([])
  const humanTouchedRef = useRef(false)
  const humanTouchMsRef = useRef<number | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const [, setTick] = useState(0)
  useEffect(() => {
    if (phase !== 'touching') return
    const id = setInterval(() => setTick(t => t + 1), 100)
    return () => clearInterval(id)
  }, [phase])

  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  function startGame() {
    clearTimers()
    const hands = dealCards(numCpu + 1)
    const newPlayers: Player[] = [
      {
        id: 'human',
        name: 'あなた',
        hand: hands[0],
        penalty: 0,
        isHuman: true,
        isEliminated: false,
      },
      ...Array.from({ length: numCpu }, (_, i): Player => ({
        id: `cpu-${i}`,
        name: CPU_NAMES[i],
        hand: hands[i + 1],
        penalty: 0,
        isHuman: false,
        isEliminated: false,
      })),
    ]
    setPlayers(newPlayers)
    setScreen('game')
    setPhase('selecting')
    setSelectedId(null)
    setMessage('カードを1枚選んで左隣に渡そう！')
    setHumanTouched(false)
    setTouchList([])
    setResultMsg('')
  }

  function handlePass() {
    if (phase !== 'selecting' || !selectedId) return
    const human = players.find(p => p.id === 'human')
    if (!human) return
    const card = human.hand.find(c => c.id === selectedId)
    if (!card) return
    setPhase('passing')
    setSelectedId(null)
    setMessage('みんな同時にパスしています...')
    const snapshot = [...players]
    const t = setTimeout(() => executePasses(card, snapshot), 700)
    timersRef.current.push(t)
  }

  function executePasses(humanCard: Card, currentPlayers: Player[]) {
    const active = currentPlayers.filter(p => !p.isEliminated)
    const cpuPicks: Record<string, Card> = {}
    for (const p of active) {
      if (!p.isHuman) cpuPicks[p.id] = cpuPickCard(p.hand)
    }

    const ids = active.map(p => p.id)
    const received: Record<string, Card> = {}
    for (let i = 0; i < ids.length; i++) {
      const from = ids[i]
      const to = ids[(i + 1) % ids.length]
      const card = from === 'human' ? humanCard : cpuPicks[from]
      if (card) received[to] = card
    }

    const next = currentPlayers.map(p => {
      if (p.isEliminated) return p
      const gave = p.isHuman ? humanCard : cpuPicks[p.id]
      const got = received[p.id]
      const newHand = p.hand.filter(c => !gave || c.id !== gave.id)
      if (got) newHand.push(got)
      return { ...p, hand: newHand }
    })

    const trigger = next.find(p => !p.isEliminated && has4OfKind(p.hand))
    if (trigger) {
      startTouchPhase(next, trigger)
    } else {
      setPlayers(next)
      setPhase('selecting')
      setMessage('カードを1枚選んで左隣に渡そう！')
    }
  }

  function startTouchPhase(updatedPlayers: Player[], trigger: Player) {
    const now = Date.now()
    touchStartRef.current = now
    touchesRef.current = []
    humanTouchedRef.current = false
    humanTouchMsRef.current = null

    setPlayers(updatedPlayers)
    setTouchDeadline(now + 3000)
    setHumanTouched(false)
    setTouchList([])
    setPhase('touching')
    setMessage(
      trigger.isHuman
        ? '🐷 4枚そろった！すぐに TOUCH！'
        : `🐷 ${trigger.name}が4枚そろった！早く TOUCH！`,
    )

    const cpus = updatedPlayers.filter(p => !p.isHuman && !p.isEliminated)
    for (const cpu of cpus) {
      const isTriggerer = cpu.id === trigger.id
      const minMs = isTriggerer ? 80 : 500
      const maxMs = isTriggerer ? 400 : 2900
      const reactMs = minMs + Math.random() * (maxMs - minMs)
      const t = setTimeout(() => {
        const ms = Date.now() - now
        touchesRef.current = [...touchesRef.current, { id: cpu.id, ms }]
        setTouchList(prev => [...prev, { name: cpu.name, ms }])
      }, reactMs)
      timersRef.current.push(t)
    }

    const resolveT = setTimeout(() => resolveTouch(updatedPlayers), 3200)
    timersRef.current.push(resolveT)
  }

  function resolveTouch(snapshotPlayers: Player[]) {
    const all = [...touchesRef.current]
    if (humanTouchedRef.current && humanTouchMsRef.current !== null) {
      all.push({ id: 'human', ms: humanTouchMsRef.current })
    }

    const active = snapshotPlayers.filter(p => !p.isEliminated)
    const touchedIds = all.map(t => t.id)
    const untouched = active.filter(p => !touchedIds.includes(p.id))

    let loserId: string
    if (untouched.length > 0) {
      loserId = untouched[Math.floor(Math.random() * untouched.length)].id
    } else {
      const sorted = [...all].sort((a, b) => a.ms - b.ms)
      loserId = sorted[sorted.length - 1].id
    }

    const penalized = snapshotPlayers.map(p => {
      if (p.id !== loserId) return p
      const newPenalty = Math.min(4, p.penalty + 1) as PenaltyLevel
      return { ...p, penalty: newPenalty, isEliminated: newPenalty >= 4 }
    })

    setPlayers(penalized)

    const loser = penalized.find(p => p.id === loserId)!
    const stillActive = penalized.filter(p => !p.isEliminated)

    if (stillActive.length <= 1) {
      setWinner(stillActive[0]?.name ?? 'あなた')
      setScreen('gameover')
      return
    }

    const penaltyStr = PENALTY_LETTERS.slice(0, loser.penalty).join('')
    setResultMsg(
      loser.isEliminated
        ? `😢 ${loser.name} が「BUTA」で脱落！`
        : `😅 ${loser.name} が最後！ペナルティ: ${penaltyStr}`,
    )
    setPhase('result')

    const t = setTimeout(() => {
      const active2 = penalized.filter(p => !p.isEliminated)
      if (loser.isEliminated) {
        const hands = dealCards(active2.length)
        const redealt = penalized.map(p => {
          if (p.isEliminated) return p
          const idx = active2.findIndex(a => a.id === p.id)
          return idx >= 0 ? { ...p, hand: hands[idx] } : p
        })
        setPlayers(redealt)
      }
      setPhase('selecting')
      setSelectedId(null)
      setMessage('カードを1枚選んで左隣に渡そう！')
    }, 2000)
    timersRef.current.push(t)
  }

  function handleTouch() {
    if (phase !== 'touching' || humanTouchedRef.current) return
    const ms = Date.now() - touchStartRef.current
    humanTouchedRef.current = true
    humanTouchMsRef.current = ms
    setHumanTouched(true)
    setTouchList(prev => [...prev, { name: 'あなた', ms }])
  }

  const timeLeft = Math.max(0, touchDeadline - Date.now())
  const cpuPlayers = players.filter(p => !p.isHuman)
  const human = players.find(p => p.isHuman)

  if (screen === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-900 to-green-950 text-white flex flex-col">
        <header className="flex items-center px-4 py-3 border-b border-white/10">
          <button
            onClick={() => window.location.assign('/')}
            className="text-white/50 hover:text-white text-sm mr-3"
          >
            ← 戻る
          </button>
          <h1 className="font-black">🐷 ぶたのしっぽ</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          <div className="text-7xl select-none">🐷</div>
          <div className="text-center">
            <h2 className="text-3xl font-black mb-2">ぶたのしっぽ</h2>
            <p className="text-white/50 text-sm max-w-xs leading-relaxed">
              4枚そろったらすぐにタッチ！
              <br />
              最後にタッチした人が「BUTA」ペナルティ。
              <br />
              全部揃ったら脱落。最後の1人が勝ち！
            </p>
          </div>
          <div>
            <p className="text-center text-white/40 text-xs mb-3">CPU の人数</p>
            <div className="flex gap-3">
              {([1, 2, 3] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setNumCpu(n)}
                  className={[
                    'w-16 h-16 rounded-xl font-black text-lg transition-all',
                    numCpu === n
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/40 scale-110'
                      : 'bg-white/10 text-white/50 hover:bg-white/20',
                  ].join(' ')}
                >
                  {n}人
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={startGame}
            className="px-10 py-4 bg-pink-500 hover:bg-pink-400 text-white font-black text-lg rounded-2xl
              transition-all active:scale-95 shadow-xl shadow-pink-500/30"
          >
            スタート！
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'gameover') {
    const isHumanWin = winner === 'あなた'
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-900 to-green-950 text-white flex flex-col items-center justify-center gap-5">
        <div className="text-6xl select-none">{isHumanWin ? '🎉' : '🐷'}</div>
        <h2 className="text-3xl font-black">{isHumanWin ? 'あなたの勝ち！' : `${winner} の勝ち`}</h2>
        <p className="text-white/50">
          {isHumanWin ? 'ぶたのしっぽを回避できた！' : '次こそは勝とう！'}
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={startGame}
            className="px-7 py-3 bg-pink-500 hover:bg-pink-400 text-white font-black rounded-xl transition-all active:scale-95"
          >
            もう一回！
          </button>
          <button
            onClick={() => window.location.assign('/')}
            className="px-7 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
          >
            広場へ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-900 to-green-950 text-white flex flex-col">
      <header className="flex items-center px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button
          onClick={() => window.location.assign('/')}
          className="text-white/50 hover:text-white text-sm mr-3"
        >
          ← 戻る
        </button>
        <h1 className="font-black text-sm">🐷 ぶたのしっぽ</h1>
      </header>

      <div className="flex justify-center flex-wrap gap-6 px-4 py-4 flex-shrink-0">
        {cpuPlayers.map(cpu => (
          <div
            key={cpu.id}
            className={`flex flex-col items-center gap-2 transition-opacity ${cpu.isEliminated ? 'opacity-25' : ''}`}
          >
            <PenaltyBar penalty={cpu.penalty} name={cpu.name} />
            <div className="flex gap-1">
              {cpu.hand.map((_, i) => (
                <CardBack key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-white/70 text-sm text-center max-w-xs min-h-5">{message}</p>

        {phase === 'touching' && (
          <div className="flex flex-col items-center gap-4">
            <div
              className={`text-5xl font-black tabular-nums ${timeLeft < 1000 ? 'text-red-400' : 'text-yellow-300'}`}
            >
              {(timeLeft / 1000).toFixed(1)}
            </div>
            {!humanTouched ? (
              <button
                onClick={handleTouch}
                className="touch-btn w-36 h-36 rounded-full bg-red-500 hover:bg-red-400 active:scale-90
                  text-white font-black text-2xl border-4 border-red-300
                  shadow-2xl shadow-red-500/60 transition-transform cursor-pointer"
              >
                TOUCH!
              </button>
            ) : (
              <div
                className="w-36 h-36 rounded-full bg-emerald-500 flex items-center justify-center
                text-white font-black text-xl border-4 border-emerald-300 shadow-2xl"
              >
                ✓ タッチ！
              </div>
            )}
            {touchList.length > 0 && (
              <div className="text-xs text-white/40 text-center space-y-0.5">
                {[...touchList]
                  .sort((a, b) => a.ms - b.ms)
                  .map(t => (
                    <div key={t.name}>
                      {t.name}: {(t.ms / 1000).toFixed(2)}s
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {phase === 'result' && (
          <div className="text-center bg-black/30 rounded-2xl p-5 max-w-xs">
            <p className="text-lg font-black">{resultMsg}</p>
          </div>
        )}

        {phase === 'passing' && (
          <div className="text-5xl select-none spin-slow">🔄</div>
        )}
      </div>

      {human && (
        <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
          <div className="max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-3">
              <PenaltyBar penalty={human.penalty} name={human.name} />
              {phase === 'selecting' && (
                <span className="text-xs text-white/30">カードをタップして選択</span>
              )}
            </div>
            <div className="flex gap-2 justify-center mb-3 h-24 items-end">
              {human.hand.map(card => (
                <CardFace
                  key={card.id}
                  card={card}
                  selected={selectedId === card.id}
                  onClick={
                    phase === 'selecting'
                      ? () => setSelectedId(id => (id === card.id ? null : card.id))
                      : undefined
                  }
                />
              ))}
            </div>
            {phase === 'selecting' && (
              <button
                onClick={handlePass}
                disabled={!selectedId}
                className={[
                  'w-full py-3 rounded-xl font-black text-sm transition-all',
                  selectedId
                    ? 'bg-pink-500 hover:bg-pink-400 text-white active:scale-95 shadow-lg shadow-pink-500/30'
                    : 'bg-white/10 text-white/20 cursor-not-allowed',
                ].join(' ')}
              >
                {selectedId ? '選んだカードを渡す →' : 'カードを1枚選んでね'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
