// Captures real BOMB game screens by injecting scripted board states into the
// running dev app, then writes per-beat metadata (text, speaker, screenshot,
// player-card bounding boxes) for the Python compositor.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import { writeFileSync } from 'fs';

const URL = process.env.APP_URL || 'http://localhost:5174';
const OUT = '/home/user/SKULL/shorts/build';
const SID = 'sid-human';
const SCALE = 2;
const VW = 540, VH = 960; // -> 1080 x 1920 screenshots (full 9:16)

const P = {
  rin: { id: 'p-rin', name: 'リン', color: 'red',   cpu: false, sid: SID },
  sou: { id: 'p-sou', name: 'ソウ', color: 'blue',  cpu: true,  sid: 'cpu-sou' },
  kai: { id: 'p-kai', name: 'カイ', color: 'green', cpu: true,  sid: 'cpu-kai' },
};
const ID = { rin: 'p-rin', sou: 'p-sou', kai: 'p-kai' };

function mkPlayer(key, seat, win = 0, elim = false) {
  const p = P[key];
  return {
    id: p.id, room_id: 'r1', player_name: p.name, player_color: p.color,
    seat_order: seat, is_cpu: p.cpu, session_id: p.sid,
    flower_count: 3, bomb_count: 1, win_count: win, is_eliminated: elim, created_at: '',
  };
}

let discSeq = 0;
function disc(ownerKey, type, pos, flipped, flipperKey = null) {
  return {
    id: `d${++discSeq}`, room_id: 'r1', player_id: ID[ownerKey], round_number: 1,
    disc_type: type, position: pos, is_flipped: flipped,
    flipped_by: flipperKey ? ID[flipperKey] : null, created_at: '',
  };
}

// stacks: { key: [ ['flower'|'bomb', flippedBool], ... ] }
function buildDiscs(stacks, flipper) {
  const all = [];
  for (const key of Object.keys(stacks)) {
    stacks[key].forEach(([type, flipped], i) => all.push(disc(key, type, i, flipped, flipped ? flipper : null)));
  }
  return all;
}

function state(beat) {
  const stacks = beat.stacks || {};
  const all = buildDiscs(stacks, beat.flipper);
  const players = [mkPlayer('rin', 1, beat.win?.rin || 0), mkPlayer('sou', 2, beat.win?.sou || 0), mkPlayer('kai', 3, beat.win?.kai || 0)];
  let last_emote = null;
  if (beat.emote) last_emote = { playerId: ID[beat.emote[0]], type: beat.emote[1], sentAt: new Date(Date.now() + discSeq).toISOString() };
  return {
    sessionId: SID,
    room: { id: 'r1', room_code: 'BOMB01', status: 'playing', host_id: SID, max_players: 3, current_round: 1, password: null, created_at: '', updated_at: '' },
    players,
    isCpuGame: true, isLoading: false, _myPlayerId: 'p-rin',
    _foldedPlayerIds: (beat.folded || []).map(k => ID[k]),
    _permCards: { 'p-rin': { flowers: 3, bombs: 1 }, 'p-sou': { flowers: 3, bombs: 1 }, 'p-kai': { flowers: 3, bombs: 1 } },
    myDiscs: all.filter(d => d.player_id === 'p-rin'),
    publicDiscs: all,
    gameState: {
      id: 'gs1', room_id: 'r1', round_number: 1, phase: beat.phase,
      current_player_id: beat.turn ? ID[beat.turn] : null,
      highest_bid: beat.bid || 0,
      highest_bidder_id: beat.bidder ? ID[beat.bidder] : null,
      pass_count: 0, flip_count: beat.flip || 0, turn_started_at: null,
      last_emote, created_at: '', updated_at: '',
    },
  };
}

// face-down / flipped shorthand
const fd = (t) => [t, false];
const up = (t) => [t, true];

// ── Scripted match (real-UI semantics: only highest bidder shows 宣言) ──
const BEATS = [
  { kind: 'title', speaker: 'narrator', text: '爆弾を踏ませろ。心理戦ボードゲーム、ボム。',
    title: '爆弾か、りんごか。', sub: '嘘で相手に爆弾を踏ませろ' },
  { kind: 'rules', speaker: 'narrator', text: 'カードを伏せて、何枚めくれるか宣言。一番強気な人がめくって、爆弾を踏んだら負け。',
    items: ['「何枚めくれる」と宣言し合い', '一番強気な人がめくる役に。', '爆弾を踏んだら手札を失う。'] },

  { kind: 'game', speaker: 'sou', text: 'さあ始めるか。俺はりんご二枚、安全に積むぜ。',
    phase: 'place', turn: 'sou', stacks: { sou: [fd('flower'), fd('flower')] } },
  { kind: 'game', speaker: 'rin', text: 'ふーん。私は一枚だけ。中身はナイショだよ。',
    phase: 'place', turn: 'rin', emote: ['rin', 'FLOWER'],
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')] } },
  { kind: 'game', speaker: 'kai', text: 'リン一枚だけって、ぜったい爆弾じゃん。読めたわ。',
    phase: 'place', turn: 'kai',
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')], kai: [fd('flower')] } },

  { kind: 'game', speaker: 'sou', text: '場は四枚。まずは俺が、三枚いけると宣言する。',
    phase: 'bid', turn: 'kai', bid: 3, bidder: 'sou',
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')], kai: [fd('flower')] } },
  { kind: 'game', speaker: 'kai', text: '三枚。甘い甘い、俺は四枚全部めくってやるよ。',
    phase: 'bid', turn: 'rin', bid: 4, bidder: 'kai',
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')], kai: [fd('flower')] } },
  { kind: 'game', speaker: 'rin', text: 'カイくん威勢いいねぇ。私はパス。せいぜい頑張って。',
    phase: 'bid', turn: 'sou', bid: 4, bidder: 'kai', folded: ['rin'], emote: ['rin', 'FLOWER'],
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')], kai: [fd('flower')] } },
  { kind: 'game', speaker: 'sou', text: 'ふっ。俺もパスだ。カイ、お前がめくれ。',
    phase: 'bid', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'],
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')], kai: [fd('flower')] } },

  { kind: 'game', speaker: 'kai', text: 'は、二人ともビビった。余裕で四枚いただくわ。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 0,
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')], kai: [fd('flower')] } },
  { kind: 'game', speaker: 'kai', text: 'まず自分の。りんご。一枚目セーフ。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 1, flipper: 'kai',
    stacks: { sou: [fd('flower'), fd('flower')], rin: [fd('bomb')], kai: [up('flower')] } },
  { kind: 'game', speaker: 'kai', text: 'ソウのも、りんご、りんご。三枚目、楽勝だっての。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 3, flipper: 'kai',
    stacks: { sou: [up('flower'), up('flower')], rin: [fd('bomb')], kai: [up('flower')] } },
  { kind: 'game', speaker: 'sou', text: 'さあ、最後はリンのカードだなぁ。どうなるかな。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 3, flipper: 'kai', emote: ['sou', 'BOMB'],
    stacks: { sou: [up('flower'), up('flower')], rin: [fd('bomb')], kai: [up('flower')] } },
  { kind: 'game', speaker: 'kai', text: 'リンのはりんごだろ。さっき安全って。いくぞ。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 3, flipper: 'kai',
    stacks: { sou: [up('flower'), up('flower')], rin: [fd('bomb')], kai: [up('flower')] } },
  { kind: 'game', speaker: 'narrator', text: 'ドカーン。リンの一枚は、爆弾だった。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 3, flipper: 'kai',
    stacks: { sou: [up('flower'), up('flower')], rin: [up('bomb')], kai: [up('flower')] } },
  { kind: 'game', speaker: 'rin', text: 'あはは。りんごって言ったの、あれぜんぶ嘘でーす。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 3, flipper: 'kai', emote: ['rin', 'BOMB'],
    stacks: { sou: [up('flower'), up('flower')], rin: [up('bomb')], kai: [up('flower')] } },
  { kind: 'game', speaker: 'kai', text: 'うわー、まんまと釣られた。手札一枚失ったし。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 3, flipper: 'kai',
    stacks: { sou: [up('flower'), up('flower')], rin: [up('bomb')], kai: [up('flower')] } },
  { kind: 'game', speaker: 'sou', text: '計画通り。煽ってくる奴ほど、よく釣れるんだよ。',
    phase: 'flip', turn: 'kai', bid: 4, bidder: 'kai', folded: ['rin', 'sou'], flip: 3, flipper: 'kai', emote: ['sou', 'FLOWER'],
    stacks: { sou: [up('flower'), up('flower')], rin: [up('bomb')], kai: [up('flower')] } },

  { kind: 'outro', speaker: 'narrator', text: 'このボム、ボードゲーム広場で今すぐ無料で遊べる。友達と騙し合おう。' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: SCALE });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__bombStore, null, { timeout: 15000 });

let routed = false;
const meta = [];
for (let i = 0; i < BEATS.length; i++) {
  const b = BEATS[i];
  const rec = { index: i, kind: b.kind, speaker: b.speaker, text: b.text };
  if (b.kind === 'title') { rec.title = b.title; rec.sub = b.sub; }
  if (b.kind === 'rules') { rec.items = b.items; }
  if (b.kind === 'game') {
    await page.evaluate((s) => {
      window.__bombStore.setState(s);
      if (!window.__routed) {
        window.history.pushState({}, '', '/game/BOMB01');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.__routed = true;
      }
    }, state(b));
    routed = true;
    await page.waitForTimeout(b.emote ? 850 : 650);
    const shot = `${OUT}/g${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: shot });
    rec.screenshot = shot;
    rec.boxes = await page.evaluate((scale) => {
      const out = {};
      document.querySelectorAll('[data-player-id]').forEach(el => {
        const r = el.getBoundingClientRect();
        out[el.getAttribute('data-player-id')] = { x: r.x * scale, y: r.y * scale, w: r.width * scale, h: r.height * scale };
      });
      return out;
    }, SCALE);
    rec.speakerId = ({ rin: 'p-rin', sou: 'p-sou', kai: 'p-kai' })[b.speaker] || null;
    rec.shotW = VW * SCALE; rec.shotH = VH * SCALE;
  }
  meta.push(rec);
  console.log(`[${i}] ${b.kind} ${b.speaker}`);
}
writeFileSync(`${OUT}/beats_meta.json`, JSON.stringify(meta, null, 2));
await browser.close();
console.log('captured', meta.length, 'beats');
