"""Generates a gentle, original BGM as a MIDI file and renders it to WAV with
real General-MIDI instrument sounds (fluidsynth + FluidR3_GM soundfont).

A mellow lo-fi loop: warm electric piano chords, soft vibraphone melody,
acoustic bass and a light chill groove. Fully offline, royalty-free (original).
"""
from __future__ import annotations
import os, struct, subprocess

SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
TPQN = 480
BPM = 150


def _vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


def _note(pitch):
    base = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    name = pitch[0]
    octave = int(pitch[-1])
    semis = base[name] + (1 if "#" in pitch else 0)
    return 12 * (octave + 1) + semis


def build_midi(bars, path):
    # events: (tick, order, bytes)  order: 0 = note-off first at same tick
    evs = []

    def add(ch, pitch, start_beat, dur_beats, vel):
        p = _note(pitch) if isinstance(pitch, str) else pitch
        t0 = int(start_beat * TPQN)
        t1 = int((start_beat + dur_beats) * TPQN)
        evs.append((t0, 1, bytes([0x90 | ch, p, vel])))
        evs.append((t1, 0, bytes([0x80 | ch, p, 0])))

    # progression per bar (4/4): C - G - Am - F
    chords = [["C4", "E4", "G4"], ["G3", "B3", "D4"],
              ["A3", "C4", "E4"], ["F3", "A4", "C4"]]
    basses = ["C2", "G2", "A2", "F2"]
    # vibraphone melody phrase (one entry per bar): list of (pitch, start_in_bar, dur)
    melody = [
        [("E5", 0, 1), ("G5", 1, 1), ("C5", 2, 2)],
        [("D5", 0, 1), ("B4", 1, 1), ("G4", 2, 2)],
        [("C5", 0, 1), ("A4", 1, 1.5), ("E4", 2.5, 1.5)],
        [("F4", 0, 1), ("A4", 1, 1), ("G4", 2, 1), ("C5", 3, 1)],
    ]

    for bar in range(bars):
        b0 = bar * 4
        ci = bar % 4
        # warm EP chords on beats 1 and 3 (half notes), soft
        for beat in (0, 2):
            for n in chords[ci]:
                add(0, n, b0 + beat, 1.9, 46)
        # soft warm pad: chord root held as a whole note, very quiet
        add(3, chords[ci][0], b0, 4, 28)
        # driving bass: bouncing root/fifth eighth feel on every beat
        root = _note(basses[ci])
        for beat in range(4):
            add(2, root, b0 + beat, 0.45, 62)
            add(2, root + 7, b0 + beat + 0.5, 0.4, 50)  # fifth on the "and"
        # vibraphone melody
        for pitch, st, du in melody[ci]:
            add(1, pitch, b0 + st, du, 62)
        # upbeat groove: four-on-the-floor kick + backbeat snare + hats
        for beat in range(4):
            add(9, 36, b0 + beat, 0.2, 84)            # kick every beat
        add(9, 38, b0 + 1, 0.2, 64)                   # snare backbeat
        add(9, 38, b0 + 3, 0.2, 64)
        for e in range(8):                            # hats, accent offbeats
            add(9, 42, b0 + e * 0.5, 0.1, 30 if e % 2 == 0 else 44)

    evs.sort(key=lambda x: (x[0], x[1]))

    # serialize track
    track = bytearray()
    # tempo meta
    mpqn = int(60_000_000 / BPM)
    track += _vlq(0) + b"\xFF\x51\x03" + struct.pack(">I", mpqn)[1:]
    # program changes (ch, program)
    for ch, prog in [(0, 4), (1, 11), (2, 32), (3, 89)]:
        track += _vlq(0) + bytes([0xC0 | ch, prog])
    last = 0
    for tick, _o, data in evs:
        track += _vlq(tick - last) + data
        last = tick
    track += _vlq(0) + b"\xFF\x2F\x00"  # end of track

    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, TPQN))
        f.write(b"MTrk" + struct.pack(">I", len(track)) + track)


def render_bgm(total_seconds, out_wav, build_dir):
    bar_sec = 4 * 60.0 / BPM
    bars = int(total_seconds / bar_sec) + 2
    mid = os.path.join(build_dir, "bgm.mid")
    build_midi(bars, mid)
    r = subprocess.run(
        ["fluidsynth", "-ni", "-g", "0.7", "-F", out_wav, "-r", "44100", SF2, mid],
        capture_output=True)
    if r.returncode != 0 or not os.path.exists(out_wav):
        raise RuntimeError("fluidsynth: " + r.stderr.decode()[-1500:])
    return out_wav
