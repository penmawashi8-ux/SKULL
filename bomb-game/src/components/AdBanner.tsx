import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

interface Props {
  // Replace with your AdSense ad slot ID from the AdSense dashboard
  slot?: string
}

export function AdBanner({ slot = 'XXXXXXXXXXXXXXXXXX' }: Props) {
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // AdSense not loaded (e.g. ad blocker or local dev)
    }
  }, [])

  return (
    <div className="w-full mt-4 overflow-hidden rounded-xl" style={{ minHeight: 100 }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
