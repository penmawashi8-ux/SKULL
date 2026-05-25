import { useEffect } from 'react'

export function useCanonical(path: string) {
  useEffect(() => {
    const url = `https://boardgamecat.com${path}`
    let tag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!tag) {
      tag = document.createElement('link')
      tag.rel = 'canonical'
      document.head.appendChild(tag)
    }
    tag.href = url
    return () => { tag!.href = '' }
  }, [path])
}
