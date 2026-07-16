// ボドゲ広場 オンライン対戦用 P2P ヘルパー（PeerJS / WebRTC）
// シグナリングには PeerJS Cloud（無料公開サーバー・キー不要）、
// NAT越えには Google の公開 STUN サーバーを使用する。
// サーバー運用・アカウント登録・APIキー設定は一切不要。
//
// テスト・セルフホスト用に URL パラメータでシグナリングサーバーを切替可能:
//   ?peerhost=127.0.0.1&peerport=9000&peerpath=/&peersecure=0
window.BGP2P = (() => {
  'use strict';

  const params = new URLSearchParams(location.search);

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

  // 紛らわしい文字（0/O, 1/I）を除いた部屋コード
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeCode(len = 4) {
    let s = '';
    for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }

  const peerId = (game, code) => `bgcat-${game}-${code}`;

  function bindConn(session, conn, h) {
    session.conn = conn;
    conn.on('open', () => h.onConnect && h.onConnect());
    conn.on('data', d => h.onData && h.onData(d));
    conn.on('close', () => { session.conn = null; h.onClose && h.onClose(); });
    conn.on('error', e => h.onError && h.onError(e));
  }

  function makeSession(peer, code, isHost) {
    return {
      peer, code, isHost, conn: null,
      send(obj) { if (this.conn && this.conn.open) this.conn.send(obj); },
      close() { try { this.peer.destroy(); } catch { /* noop */ } this.conn = null; },
    };
  }

  // 部屋を作って相手を待つ。h: { onReady(code), onConnect, onData, onClose, onError }
  function host(game, h) {
    const code = (params.get('forcecode') || makeCode()).toUpperCase();
    const peer = new Peer(peerId(game, code), peerOptions());
    const session = makeSession(peer, code, true);
    peer.on('open', () => h.onReady && h.onReady(code));
    peer.on('connection', conn => {
      if (session.conn) { try { conn.close(); } catch { /* 満室 */ } return; }
      bindConn(session, conn, h);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* noop */ } });
    peer.on('error', e => h.onError && h.onError(e));
    return session;
  }

  // 部屋コードで参加する。h: { onConnect, onData, onClose, onError }
  function join(game, code, h) {
    const peer = new Peer(peerOptions());
    const session = makeSession(peer, code.toUpperCase(), false);
    peer.on('open', () => {
      const conn = peer.connect(peerId(game, session.code), { reliable: true });
      bindConn(session, conn, h);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* noop */ } });
    peer.on('error', e => h.onError && h.onError(e));
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

  return { host, join, errorText };
})();
