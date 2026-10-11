import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { UpdatePrompt } from './components/UpdatePrompt'

class SafeRender extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: unknown) { console.error('SafeRender caught:', error) }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

const container = document.getElementById('root')!

const tree = (
  <StrictMode>
    <SafeRender>
      <UpdatePrompt />
    </SafeRender>
    <App />
  </StrictMode>
)

// scripts/prerender.mjs が #root の中身を静的HTMLとして書き出しているので、
// 中身が今のURL用なら createRoot ではなく hydrateRoot で引き継ぐ。
//
// createRoot だと React が #root の子要素を全部捨てて作り直すため、
// ゲームページでは静的HTML側の <iframe src="/play/xxx/"> が一度読み込まれた
// あとに破棄され、新しい iframe でもう一度読み込まれていた。
// 実測で /play/<id>/ と /play/lib/{peerjs.min,p2p}.js の3件が毎回2回ずつ
// リクエストされており、ゲームページ1回の表示で自サイトへのリクエストが
// 10件→7件になる。
//
// ただし Service Worker の navigateFallback は、2回目以降の訪問で
// /games/xxx にキャッシュ済みの index.html（トップページ）を返すことがある。
// そのHTMLを hydrate しようとすると当然合わないので、
// data-prerendered が今のパスと一致するときだけ hydrate する。
const prerendered = container.dataset.prerendered
const here = window.location.pathname
const canHydrate =
  prerendered === here ||
  (prerendered === '/' && (here === '' || here === '/index.html'))

if (canHydrate) {
  hydrateRoot(container, tree)
} else {
  createRoot(container).render(tree)
}
