import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SafeRender>
      <UpdatePrompt />
    </SafeRender>
    <App />
  </StrictMode>,
)
