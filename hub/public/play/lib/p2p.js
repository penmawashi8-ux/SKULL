// ボドゲ広場 オンライン対戦用 P2P ヘルパー（PeerJS / WebRTC）
// シグナリングには PeerJS Cloud（無料公開サーバー・キー不要）、
// NAT越えには Google の公開 STUN サーバーを使用する。
// サーバー運用・アカウント登録・APIキー設定は一切不要。
//
// 対戦方法:
//   - host / join : 数字4ケタの部屋コードで友達と対戦
//   - quickMatch  : 野良マッチ。あいことば無しなら誰とでも、
//                   あいことば有りなら同じ言葉を入れた人とだけマッチ
//
// テスト・セルフホスト用に URL パラメータでシグナリングサーバーを切替可能:
//   ?peerhost=127.0.0.1&peerport=9000&peerpath=/&peersecure=0
window.BGP2P = (() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const QUICK_SLOTS = 10;        // 野良マッチの同時部屋数
  // 参加試行のタイムアウト。シグナリングサーバーが「相手不在」を返すまで
  // 約5秒かかる（EXPIRE）ため、それより長くしないと永久にスロットを巡回してしまう。
  const JOIN_TIMEOUT = 6500;

  function peerOptions() {
    const opts = {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    };
    const host = params.get('peerhost');
    if (host) {
      opts.host = host;
      opts.port = parseInt(params.get('peerport') || '9000', 10);
      opts.path = params.get('peerpath') || '/';
      opts.secure = params.get('peersecure') === '1';
    }
    return opts;
  }

  // 数字4ケタの部屋コード
  function makeCode() {
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  // あいことば → 決定的な短いハッシュ（同じ言葉なら全員同じ値になる）
  function phraseHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  const roomId = (game, code) => `bgcat-${game}-r-${code}`;
  const slotId = (game, ns, slot) => `bgcat-${game}-${ns}-${slot}`;

  function makeSession(isHost) {
    return {
      peer: null, code: null, isHost, conn: null, closed: false,
      send(obj) { if (this.conn && this.conn.open) this.conn.send(obj); },
      close() {
        this.closed = true;
        try { this.peer && this.peer.destroy(); } catch { /* noop */ }
        this.peer = null;
        this.conn = null;
      },
    };
  }

  function bindConn(session, conn, h) {
    session.conn = conn;
    conn.on('open', () => h.onConnect && h.onConnect());
    conn.on('data', d => h.onData && h.onData(d));
    conn.on('close', () => { session.conn = null; h.onClose && h.onClose(); });
    conn.on('error', e => h.onError && h.onError(e));
  }

  // ── 部屋を作って相手を待つ（コード衝突時は自動で作り直し） ──
  // h: { onReady(code), onMatched(isHost), onConnect, onData, onClose, onError }
  function host(game, h) {
    const session = makeSession(true);
    let attempts = 0;
    function tryHost() {
      if (session.closed) return;
      const code = (params.get('forcecode') || makeCode());
      const peer = new Peer(roomId(game, code), peerOptions());
      session.peer = peer;
      session.code = code;
      peer.on('open', () => {
        h.onMatched && h.onMatched(true);
        h.onReady && h.onReady(code);
      });
      peer.on('connection', conn => {
        if (session.conn) { try { conn.close(); } catch { /* 満室 */ } return; }
        bindConn(session, conn, h);
      });
      peer.on('disconnected', () => { if (!session.closed) try { peer.reconnect(); } catch { /* noop */ } });
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && attempts++ < 5 && !params.get('forcecode')) {
          try { peer.destroy(); } catch { /* noop */ }
          tryHost(); // コード衝突: 別の番号で作り直し
          return;
        }
        h.onError && h.onError(e);
      });
    }
    tryHost();
    return session;
  }

  // ── 複数人部屋（ホスト + 最大 maxGuests 人）──
  // ホストが全ゲストと1対1で接続し、メッセージを中継するスター型。
  // h: { onReady(code), onGuestJoin(gi, count), onGuestLeave(gi, count),
  //      onGuestData(gi, d), onError(e) }
  function hostMulti(game, maxGuests, h) {
    const session = makeSession(true);
    session.guests = [];   // DataConnection（切断は null）
    session.locked = false; // ゲーム開始後は入室拒否
    session.activeGuests = () =>
      session.guests.map((c, i) => (c && c.open ? i : -1)).filter(i => i >= 0);
    session.broadcast = obj => {
      for (const c of session.guests) if (c && c.open) c.send(obj);
    };
    session.sendToGuest = (gi, obj) => {
      const c = session.guests[gi];
      if (c && c.open) c.send(obj);
    };
    session.lock = () => { session.locked = true; };

    let attempts = 0;
    function tryHost() {
      if (session.closed) return;
      const code = (params.get('forcecode') || makeCode());
      const peer = new Peer(roomId(game, code), peerOptions());
      session.peer = peer;
      session.code = code;
      peer.on('open', () => h.onReady && h.onReady(code));
      peer.on('connection', conn => {
        if (session.locked || session.activeGuests().length >= maxGuests) {
          try { conn.close(); } catch { /* 満室 */ }
          return;
        }
        const gi = session.guests.length;
        session.guests.push(conn);
        conn.on('open', () => h.onGuestJoin && h.onGuestJoin(gi, session.activeGuests().length));
        conn.on('data', d => h.onGuestData && h.onGuestData(gi, d));
        conn.on('close', () => {
          session.guests[gi] = null;
          h.onGuestLeave && h.onGuestLeave(gi, session.activeGuests().length);
        });
        conn.on('error', () => { /* close 側で処理 */ });
      });
      peer.on('disconnected', () => { if (!session.closed) try { peer.reconnect(); } catch { /* noop */ } });
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && attempts++ < 5 && !params.get('forcecode')) {
          try { peer.destroy(); } catch { /* noop */ }
          tryHost();
          return;
        }
        h.onError && h.onError(e);
      });
    }
    tryHost();
    return session;
  }

  // ── 部屋コードで参加する ──
  function join(game, code, h) {
    const session = makeSession(false);
    session.code = code;
    const peer = new Peer(peerOptions());
    session.peer = peer;
    peer.on('open', () => {
      h.onMatched && h.onMatched(false);
      const conn = peer.connect(roomId(game, code), { reliable: true });
      bindConn(session, conn, h);
    });
    peer.on('disconnected', () => { if (!session.closed) try { peer.reconnect(); } catch { /* noop */ } });
    peer.on('error', e => h.onError && h.onError(e));
    return session;
  }

  // ── 野良マッチ ──
  // スロット0から順に「待っている人がいれば参加、いなければ自分が待つ」。
  // あいことば有りなら専用の名前空間になり、同じ言葉の人としかマッチしない。
  // h: { onSearch(text), onMatched(isHost), onConnect, onData, onClose, onError }
  function quickMatch(game, passphrase, h) {
    const ns = passphrase ? 'w' + phraseHash(passphrase.trim()) : 'pub';
    const session = makeSession(false);

    function cleanupPeer() {
      try { session.peer && session.peer.destroy(); } catch { /* noop */ }
      session.peer = null;
    }

    // slot に参加を試みる。誰もいなければホストとして待つ。
    function tryJoin(slot) {
      if (session.closed) return;
      if (slot >= QUICK_SLOTS) {
        // 全スロットが対戦中: 少し待って最初から探し直す
        h.onSearch && h.onSearch('対戦相手を探しています…（混み合っています）');
        setTimeout(() => tryJoin(0), 3000);
        return;
      }
      h.onSearch && h.onSearch('対戦相手を探しています…');
      const peer = new Peer(peerOptions());
      session.peer = peer;
      let settled = false;

      const giveUp = setTimeout(() => {
        if (settled || session.closed) return;
        settled = true;
        cleanupPeer();
        tryJoin(slot + 1); // 応答なし: 次のスロットへ
      }, JOIN_TIMEOUT);

      peer.on('open', () => {
        if (session.closed) return;
        const conn = peer.connect(slotId(game, ns, slot), { reliable: true });
        let gotData = false;
        conn.on('data', d => {
          if (session.closed) return;
          if (!gotData) {
            // 最初のデータ受信＝マッチ成立（ホストの init）
            gotData = true;
            settled = true;
            clearTimeout(giveUp);
            session.conn = conn;
            session.isHost = false;
            h.onMatched && h.onMatched(false);
            h.onConnect && h.onConnect();
            conn.on('close', () => { session.conn = null; h.onClose && h.onClose(); });
          }
          h.onData && h.onData(d);
        });
        conn.on('close', () => {
          if (gotData) return; // 対戦成立後の切断は上のハンドラが対応
          if (settled || session.closed) return;
          settled = true;
          clearTimeout(giveUp);
          cleanupPeer();
          tryJoin(slot + 1); // 対戦中の部屋だった: 次へ
        });
        conn.on('error', () => { /* close 側で処理 */ });
      });
      peer.on('error', e => {
        if (settled || session.closed) return;
        if (e.type === 'peer-unavailable') {
          // 誰も待っていない: 自分がこのスロットで待つ
          settled = true;
          clearTimeout(giveUp);
          cleanupPeer();
          becomeHost(slot);
        }
      });
    }

    function becomeHost(slot) {
      if (session.closed) return;
      const peer = new Peer(slotId(game, ns, slot), peerOptions());
      session.peer = peer;
      peer.on('open', () => {
        h.onSearch && h.onSearch(passphrase
          ? 'あいことば「' + passphrase + '」で相手を待っています…'
          : '対戦相手を待っています…（このままお待ちください）');
      });
      peer.on('connection', conn => {
        if (session.conn) { try { conn.close(); } catch { /* 満室 */ } return; }
        session.isHost = true;
        h.onMatched && h.onMatched(true);
        bindConn(session, conn, h);
      });
      peer.on('disconnected', () => { if (!session.closed) try { peer.reconnect(); } catch { /* noop */ } });
      peer.on('error', e => {
        if (session.closed) return;
        if (e.type === 'unavailable-id') {
          // 直前に誰かが同じスロットで待ち始めた: そこに参加し直す
          cleanupPeer();
          tryJoin(slot);
          return;
        }
        h.onError && h.onError(e);
      });
    }

    tryJoin(0);
    return session;
  }

  // エラー種別を日本語メッセージに変換
  function errorText(e) {
    switch (e && e.type) {
      case 'peer-unavailable': return 'その部屋コードの部屋が見つかりません。コードを確認してください。';
      case 'unavailable-id': return '部屋コードが重複しました。もう一度部屋を作ってください。';
      case 'network': return '通信サーバーに接続できません。ネットワーク環境を確認してください。';
      case 'browser-incompatible': return 'このブラウザはオンライン対戦（WebRTC）に対応していません。';
      default: return '通信エラーが発生しました。ネットワーク環境によっては接続できない場合があります。';
    }
  }

  return { host, hostMulti, join, quickMatch, errorText };
})();
