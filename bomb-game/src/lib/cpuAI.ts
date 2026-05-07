import type { Player, GameState, PlacedDisc, DiscType } from '../types/game'

function thinkDelay(): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, 400 + Math.random() * 100)
  )
}

// ─── cpuDecidePlace ───────────────────────────────────────────────────────────

export async function cpuDecidePlace(
  cpu: Player,
  _gameState: GameState,
  difficulty: string
): Promise<DiscType> {
  await thinkDelay()

  // 選択肢がない場合は強制
  if (cpu.bomb_count === 0) return 'flower'
  if (cpu.flower_count === 0) return 'bomb'

  if (difficulty === 'easy') {
    return Math.random() < 0.4 ? 'bomb' : 'flower'
  }

  if (difficulty === 'normal') {
    // 残りカードが少ないほど爆弾を置く圧が高まる
    const totalCards = cpu.flower_count + cpu.bomb_count
    const bombRate = totalCards <= 1 ? 0.5 : 0.25
    return Math.random() < bombRate ? 'bomb' : 'flower'
  }

  // hard: 花が2枚以上あればチャレンジを狙いたいので花を優先
  // 序盤に低確率で爆弾を仕込んでブラフ
  const totalCards = cpu.flower_count + cpu.bomb_count
  const wantsToBid = cpu.flower_count >= 2
  if (wantsToBid && Math.random() < 0.75) return 'flower'
  if (totalCards >= 3 && Math.random() < 0.2) return 'bomb'
  return 'flower'
}

// ─── cpuDecideBidOrFold ───────────────────────────────────────────────────────

export async function cpuDecideBidOrFold(
  cpu: Player,
  gameState: GameState,
  _players: Player[],
  discs: PlacedDisc[],
  difficulty: string
): Promise<{ action: 'bid' | 'fold'; amount?: number }> {
  await thinkDelay()

  const round = gameState.round_number
  const currentBid = gameState.highest_bid
  const roundDiscs = discs.filter((d) => d.round_number === round)
  const totalDiscs = roundDiscs.length

  // これ以上入札できない場合は必ずフォールド
  if (currentBid >= totalDiscs) return { action: 'fold' }

  if (difficulty === 'easy') {
    if (Math.random() < 0.6) return { action: 'fold' }
    const amount = currentBid + 1 + Math.floor(Math.random() * 2)
    if (amount > totalDiscs) return { action: 'fold' }
    return { action: 'bid', amount }
  }

  const ownDiscs = roundDiscs.filter((d) => d.player_id === cpu.id)
  const ownFlowers = ownDiscs.filter((d) => d.disc_type === 'flower').length
  const ownHasBomb = ownDiscs.some((d) => d.disc_type === 'bomb')
  // 自分のスタックの安全枚数（爆弾を置いていれば花の枚数のみ）
  const ownSafeCount = ownHasBomb ? ownFlowers : ownDiscs.length

  if (difficulty === 'normal') {
    const otherDiscsCount = totalDiscs - ownDiscs.length
    // 他プレイヤーの約40%が花と楽観的に見積もる
    const bidTarget = ownSafeCount + Math.floor(otherDiscsCount * 0.4)

    if (bidTarget <= currentBid || Math.random() < 0.35) return { action: 'fold' }

    const amount = currentBid + 1
    if (amount > totalDiscs) return { action: 'fold' }
    return { action: 'bid', amount }
  }

  // hard: 他プレイヤーの花率を60%と見積もり、最大自信入札数を計算
  const otherDiscsCount = totalDiscs - ownDiscs.length
  const estimatedSafeOthers = Math.floor(otherDiscsCount * 0.6)
  const maxConfidentBid = ownSafeCount + estimatedSafeOthers

  if (maxConfidentBid <= currentBid) return { action: 'fold' }

  const amount = Math.min(
    currentBid + 1 + Math.floor(Math.random() * 2),
    maxConfidentBid,
    totalDiscs
  )
  return { action: 'bid', amount }
}

// ─── cpuDecideFlipTarget ──────────────────────────────────────────────────────

export async function cpuDecideFlipTarget(
  cpu: Player,
  _players: Player[],
  discs: PlacedDisc[],
  alreadyFlipped: string[],
  difficulty: string
): Promise<string> {
  await thinkDelay()

  const flippedSet = new Set(alreadyFlipped)
  const unflipped = discs.filter((d) => !flippedSet.has(d.id) && !d.is_flipped)

  // ルール上、自分のスタックを先にすべてめくる義務がある
  const ownUnflipped = unflipped
    .filter((d) => d.player_id === cpu.id)
    .sort((a, b) => b.position - a.position) // position大 = スタック上部

  if (ownUnflipped.length > 0) return ownUnflipped[0].id

  // 他プレイヤーのスタックから選択
  const othersUnflipped = unflipped.filter((d) => d.player_id !== cpu.id)

  if (othersUnflipped.length === 0) return ''

  if (difficulty === 'easy') {
    return othersUnflipped[Math.floor(Math.random() * othersUnflipped.length)].id
  }

  // normal / hard: 枚数の少ないスタックの上部を優先
  const byPlayer = new Map<string, PlacedDisc[]>()
  for (const disc of othersUnflipped) {
    if (!byPlayer.has(disc.player_id)) byPlayer.set(disc.player_id, [])
    byPlayer.get(disc.player_id)!.push(disc)
  }

  const sorted = [...byPlayer.entries()].sort((a, b) => a[1].length - b[1].length)
  const targetStack = sorted[0][1].sort((a, b) => b.position - a.position)
  return targetStack[0].id
}
