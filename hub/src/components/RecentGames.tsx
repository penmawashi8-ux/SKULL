// トップページの「最近遊んだゲーム」。
//
// 前に開いたゲームをブラウザに覚えておいて、次に来たとき一覧を
// 探し直さずに続きへ入れるようにする。記録が無ければ何も出さないので、
// 初めての訪問者には今までどおりの画面になる。
//
// localStorage はプリレンダリング時には存在せず、ブラウザでも環境により
// 読めないことがある。サーバー側で描いたHTMLに含めるとハイドレーションが
// 合わなくなるので、useSyncExternalStore でクライアント専用の値として読む
// （プリレンダリング時は常に空、ハイドレーション後に実際の値へ切り替わる）。

import { useSyncExternalStore } from 'react'
import { games } from '../games'
import {
  getRecentGames, getRecentGamesOnServer, subscribeRecentGames,
} from '../recentGames'

export default function RecentGames() {
  const ids = useSyncExternalStore(
    subscribeRecentGames,
    getRecentGames,
    getRecentGamesOnServer,
  )

  const recent = ids
    .map(id => games.find(g => g.id === id && g.status === 'available'))
    .filter((g): g is (typeof games)[number] => Boolean(g))

  if (recent.length === 0) return null

  return (
    <section className="px-4 pb-2 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        <span
          className="font-sans-jp text-[10px] tracking-[0.18em]"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          最近遊んだゲーム
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {recent.map(game => (
          <a
            key={game.id}
            href={`/games/${game.id}`}
            className="font-sans-jp flex-shrink-0 text-[12px] font-bold px-4 py-2 rounded-full"
            style={{
              background: `${game.accentColor}1f`,
              border: `1.5px solid ${game.accentColor}55`,
              color: game.accentColor,
              textDecoration: 'none',
            }}
          >
            {game.name}
          </a>
        ))}
      </div>
    </section>
  )
}
