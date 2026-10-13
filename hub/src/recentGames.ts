// 「最近遊んだゲーム」の記録。
//
// ブラウザの localStorage にゲームIDを残しておき、次に来たとき
// トップページから続きに入れるようにする。サーバーには何も送らず
// Cookieも使わないので、プライバシーポリシーの変更は要らない。
//
// プライベートウィンドウやストレージを無効にしている環境では
// localStorage の読み書きが例外を投げる。その場合は「記録なし」として
// 扱い、機能ごと黙って無効になるようにしている。
//
// React からは useSyncExternalStore で読む。
// - プリレンダリング時は localStorage が無いので getServerSnapshot が要る
// - getSnapshot は同じ内容なら同じ配列を返さないと再描画が止まらないため、
//   生の文字列が変わったときだけ作り直してキャッシュする

const KEY = 'bgc:recent-games'
const MAX = 6

/** サーバー側と「記録なし」で共有する固定の空配列。毎回同じ参照を返す。 */
const EMPTY: readonly string[] = []

let cachedRaw: string | null = null
let cachedList: readonly string[] = EMPTY
const listeners = new Set<() => void>()

function parse(raw: string | null): readonly string[] {
  if (!raw) return EMPTY
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY
    const ids = parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX)
    return ids.length ? ids : EMPTY
  } catch {
    return EMPTY
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function getRecentGames(): readonly string[] {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedList = parse(raw)
  }
  return cachedList
}

export function getRecentGamesOnServer(): readonly string[] {
  return EMPTY
}

/** 他のタブでの変更（storageイベント）と、このタブでの記録の両方を拾う。 */
export function subscribeRecentGames(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** 新しいものを先頭に。同じゲームは重複させず、先頭へ移動する。 */
export function recordRecentGame(id: string): void {
  try {
    const next = [id, ...getRecentGames().filter(x => x !== id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 保存できない環境では記録しないだけで、遊ぶのには支障がない
    return
  }
  for (const listener of listeners) listener()
}
