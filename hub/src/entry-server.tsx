/* eslint-disable react-refresh/only-export-components -- サーバー専用エントリのためFast refresh対象外 */
// ビルド時プリレンダリング用のサーバーエントリ。
// scripts/prerender.mjs から呼ばれ、各ルートを静的HTMLとして出力する。
// UpdatePrompt（virtual:pwa-register 依存）は main.tsx 側にあるため、
// このモジュールの依存グラフには含まれない。
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'

export { GAME_CONTENT } from './gameContent'

export function render(path: string): string {
  return renderToString(
    <StrictMode>
      <App path={path} />
    </StrictMode>,
  )
}
