import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useCanonical } from '../useCanonical'

// ── Types ────────────────────────────────────────────────────────────────────

interface BbsThread {
  id: string
  category: string
  title: string
  body: string
  author_name: string
  reply_count: number
  last_replied_at: string
  created_at: string
}

interface BbsPost {
  id: string
  thread_id: string
  body: string
  author_name: string
  created_at: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'general',      label: '全般',            color: '#ffd43b' },
  { id: 'bomb',         label: 'BOMB',             color: '#f87171' },
  { id: 'pig-tail',     label: 'ぶたのしっぽ',     color: '#f9a8d4' },
  { id: 'keiba',        label: 'バーチャル競馬',   color: '#6ee7b7' },
  { id: 'page-one',     label: 'ページワン',       color: '#93c5fd' },
  { id: 'coup',         label: '謀略',             color: '#86efac' },
  { id: 'racing-board', label: '疾走',             color: '#fdba74' },
  { id: 'g-board-app',  label: 'MECH SIEGE',       color: '#c4b5fd' },
  { id: 'poko-light',   label: 'ポコっとライト',   color: '#fde68a' },
]

const BG = 'radial-gradient(ellipse at top, #1e2244 0%, #1a1c30 55%, #161824 100%)'

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'たった今'
  if (m < 60)  return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}時間前`
  const d = Math.floor(h / 24)
  if (d < 8)   return `${d}日前`
  const dt = new Date(dateStr)
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`
}

function catInfo(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0]
}

function CategoryPill({ categoryId }: { categoryId: string }) {
  const cat = catInfo(categoryId)
  return (
    <span
      className="font-sans-jp inline-block text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{
        background: `${cat.color}22`,
        color: cat.color,
        border: `1px solid ${cat.color}44`,
      }}
    >
      {cat.label}
    </span>
  )
}

// ── New-thread sheet ──────────────────────────────────────────────────────────

interface NewThreadSheetProps {
  open: boolean
  initialCategory: string
  onClose: () => void
  onCreated: (id: string) => void
}

function NewThreadSheet({ open, initialCategory, onClose, onCreated }: NewThreadSheetProps) {
  const [fc, setFc] = useState(initialCategory)
  const [name, setName] = useState('名無し')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setFc(initialCategory) }, [open, initialCategory])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setBusy(true)
    const { data, error } = await supabase
      .from('bbs_threads')
      .insert({
        category:    fc,
        title:       title.trim().slice(0, 100),
        body:        body.trim().slice(0, 2000),
        author_name: (name.trim() || '名無し').slice(0, 20),
      })
      .select()
      .single()
    setBusy(false)
    if (!error && data) {
      setTitle('')
      setBody('')
      setName('名無し')
      onCreated(data.id)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.6)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #1e2248 0%, #181b38 100%)',
          border: '2px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          maxHeight: '88vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div className="overflow-y-auto px-5 pb-6">
          <div className="flex items-center justify-between py-3 mb-1">
            <p className="font-serif-jp font-bold text-[15px] text-white">スレッドを立てる</p>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
            >✕</button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {/* Category */}
            <div>
              <p className="font-sans-jp text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>カテゴリ</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFc(cat.id)}
                    className="font-sans-jp flex-shrink-0 text-[10px] font-bold px-3 py-1 rounded-full transition-all"
                    style={{
                      background: fc === cat.id ? cat.color : `${cat.color}22`,
                      color:      fc === cat.id ? '#1a1c30' : cat.color,
                      border:     `1px solid ${cat.color}44`,
                    }}
                  >{cat.label}</button>
                ))}
              </div>
            </div>

            <input
              type="text" placeholder="名前（省略で名無し）"
              value={name} onChange={e => setName(e.target.value)} maxLength={20}
              className="font-sans-jp w-full text-[12px] px-3 py-2.5 rounded-xl outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
            />

            <input
              type="text" placeholder="タイトル（必須）"
              value={title} onChange={e => setTitle(e.target.value)} maxLength={100} required
              className="font-sans-jp w-full text-[12px] px-3 py-2.5 rounded-xl outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
            />

            <textarea
              placeholder="本文（必須）"
              value={body} onChange={e => setBody(e.target.value)} maxLength={2000} required rows={5}
              className="font-sans-jp w-full text-[12px] px-3 py-2.5 rounded-xl outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button" onClick={onClose}
                className="font-sans-jp flex-1 py-3 rounded-xl text-[12px]"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
              >キャンセル</button>
              <button
                type="submit"
                disabled={busy || !title.trim() || !body.trim()}
                className="font-sans-jp flex-1 py-3 rounded-xl text-[12px] font-bold transition-all"
                style={{
                  background: catInfo(fc).color,
                  color: '#1a1c30',
                  opacity: (busy || !title.trim() || !body.trim()) ? 0.5 : 1,
                }}
              >{busy ? '投稿中…' : '投稿する'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ── Thread List ───────────────────────────────────────────────────────────────

function ThreadList() {
  useCanonical('/bbs')
  const [category, setCategory] = useState('general')
  const [threads, setThreads] = useState<BbsThread[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  function loadThreads(cat: string) {
    setLoading(true)
    supabase
      .from('bbs_threads')
      .select('*')
      .eq('category', cat)
      .order('last_replied_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setThreads(data ?? []); setLoading(false) })
  }

  useEffect(() => { loadThreads(category) }, [category])

  const color = catInfo(category).color

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(26,28,48,0.95)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '2px solid rgba(255,255,255,0.07)',
        }}
      >
        <button
          className="flex items-center gap-1.5 font-sans-jp text-[12px]"
          style={{ color: 'rgba(255,255,255,0.55)' }}
          onClick={() => window.location.assign('/')}
        >
          <span className="text-base">←</span> ホーム
        </button>
        <div className="text-center">
          <p className="font-cinzel text-[8px] font-bold tracking-[0.28em] uppercase" style={{ color: 'rgba(255,255,255,0.42)' }}>
            ✦ BOARD GAME FORUM ✦
          </p>
          <h1 className="font-serif-jp font-bold text-[15px] text-white tracking-[0.1em]">掲示板</h1>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          className="font-sans-jp text-[11px] font-bold px-3 py-1.5 rounded-full active:scale-95 transition-all"
          style={{ background: color, color: '#1a1c30', boxShadow: `0 4px 12px ${color}55` }}
        >＋ 投稿</button>
      </header>

      {/* Category tabs */}
      <div
        className="flex gap-2 overflow-x-auto px-4 py-3"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {CATEGORIES.map(cat => {
          const active = cat.id === category
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="font-sans-jp flex-shrink-0 text-[11px] font-bold px-4 py-1.5 transition-all duration-150 active:scale-95"
              style={{
                borderRadius: '999px',
                background: active ? cat.color : `${cat.color}22`,
                color:       active ? '#1a1c30' : cat.color,
                border:      `2px solid ${cat.color}55`,
                boxShadow:   active ? `0 4px 14px ${cat.color}55` : 'none',
                transform:   active ? 'translateY(-1px)' : 'none',
              }}
            >{cat.label}</button>
          )
        })}
      </div>

      {/* Thread list */}
      <main className="px-4 pb-10 max-w-xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <p className="font-sans-jp text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>読み込み中…</p>
          </div>
        ) : threads.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center mt-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-4xl mb-3" style={{ opacity: 0.25 }}>💬</p>
            <p className="font-sans-jp text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
              まだスレッドがありません<br />最初の投稿者になろう！
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {threads.map(t => (
              <button
                key={t.id}
                onClick={() => window.location.assign(`/bbs/${t.id}`)}
                className="w-full text-left rounded-2xl p-4 transition-all duration-150 active:scale-[0.99] active:brightness-90"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <CategoryPill categoryId={t.category} />
                  <span className="font-sans-jp text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {relativeTime(t.last_replied_at)}
                  </span>
                </div>
                <p className="font-serif-jp font-bold text-[14px] text-white leading-snug mb-1.5 line-clamp-2">
                  {t.title}
                </p>
                <p
                  className="font-sans-jp text-[11px] leading-relaxed mb-2 line-clamp-2"
                  style={{ color: 'rgba(255,255,255,0.42)' }}
                >
                  {t.body}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {t.author_name}
                  </span>
                  <span className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    💬 {t.reply_count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <NewThreadSheet
        open={sheetOpen}
        initialCategory={category}
        onClose={() => setSheetOpen(false)}
        onCreated={id => { setSheetOpen(false); window.location.assign(`/bbs/${id}`) }}
      />
    </div>
  )
}

// ── Thread View ───────────────────────────────────────────────────────────────

function ThreadView({ threadId }: { threadId: string }) {
  useCanonical(`/bbs/${threadId}`)
  const [thread, setThread] = useState<BbsThread | null>(null)
  const [posts, setPosts] = useState<BbsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState('')
  const [replyName, setReplyName] = useState('名無し')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('bbs_threads').select('*').eq('id', threadId).single(),
      supabase.from('bbs_posts').select('*').eq('thread_id', threadId).order('created_at'),
    ]).then(([{ data: t }, { data: p }]) => {
      setThread(t)
      setPosts(p ?? [])
      setLoading(false)
    })
  }, [threadId])

  async function submitReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyBody.trim()) return
    setBusy(true)
    const { error } = await supabase.from('bbs_posts').insert({
      thread_id:   threadId,
      body:        replyBody.trim().slice(0, 2000),
      author_name: (replyName.trim() || '名無し').slice(0, 20),
    })
    if (!error) {
      const { data } = await supabase
        .from('bbs_posts')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at')
      setPosts(data ?? [])
      setReplyBody('')
    }
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <p className="font-sans-jp text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>読み込み中…</p>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: BG }}>
        <p className="font-sans-jp text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>スレッドが見つかりません</p>
        <button
          className="font-sans-jp text-[12px] px-4 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          onClick={() => window.location.assign('/bbs')}
        >← 掲示板に戻る</button>
      </div>
    )
  }

  const color = catInfo(thread.category).color

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(26,28,48,0.95)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '2px solid rgba(255,255,255,0.07)',
        }}
      >
        <button
          className="flex items-center gap-1.5 font-sans-jp text-[12px]"
          style={{ color: 'rgba(255,255,255,0.55)' }}
          onClick={() => window.location.assign('/bbs')}
        >
          <span className="text-base">←</span> 掲示板
        </button>
        <CategoryPill categoryId={thread.category} />
        <div style={{ width: 64 }} />
      </header>

      <div className="px-4 pt-4 pb-10 max-w-xl mx-auto">
        {/* OP */}
        <div
          className="rounded-2xl p-4 mb-3"
          style={{
            background: `linear-gradient(135deg, ${color}18 0%, rgba(255,255,255,0.03) 100%)`,
            border: `1px solid ${color}33`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-cinzel text-[9px] font-bold" style={{ color }}>No.1</span>
            <span className="font-sans-jp text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {relativeTime(thread.created_at)}
            </span>
          </div>
          <h1 className="font-serif-jp font-bold text-[17px] text-white leading-snug mb-2">
            {thread.title}
          </h1>
          <p className="font-sans-jp text-[12px] leading-relaxed mb-3 whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.68)' }}>
            {thread.body}
          </p>
          <span className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
            {thread.author_name}
          </span>
        </div>

        {/* Replies */}
        {posts.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {posts.map((post, i) => (
              <div
                key={post.id}
                className="rounded-2xl p-3.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-cinzel text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    No.{i + 2}
                  </span>
                  <span className="font-sans-jp text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {relativeTime(post.created_at)}
                  </span>
                </div>
                <p className="font-sans-jp text-[12px] leading-relaxed mb-2 whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.62)' }}>
                  {post.body}
                </p>
                <span className="font-sans-jp text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {post.author_name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Reply divider */}
        <div className="flex items-center gap-3 my-4">
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
          <span className="font-cinzel text-[9px] tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.22)' }}>
            ✦ Reply ✦
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
        </div>

        {/* Reply form */}
        <form onSubmit={submitReply} className="flex flex-col gap-2">
          <input
            type="text" placeholder="名前（省略で名無し）"
            value={replyName} onChange={e => setReplyName(e.target.value)} maxLength={20}
            className="font-sans-jp w-full text-[12px] px-3 py-2.5 rounded-xl outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <textarea
            placeholder="返信を書く…"
            value={replyBody} onChange={e => setReplyBody(e.target.value)} maxLength={2000} required rows={4}
            className="font-sans-jp w-full text-[12px] px-3 py-2.5 rounded-xl outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button
            type="submit"
            disabled={busy || !replyBody.trim()}
            className="font-sans-jp w-full py-3 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${color}cc, ${color})`,
              color: '#1a1c30',
              opacity: (busy || !replyBody.trim()) ? 0.5 : 1,
              boxShadow: `0 4px 14px ${color}44`,
            }}
          >
            {busy ? '送信中…' : '返信する'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function Bbs() {
  const path = window.location.pathname
  const threadId = path.startsWith('/bbs/') ? path.slice(5) : null
  if (threadId) return <ThreadView threadId={threadId} />
  return <ThreadList />
}
