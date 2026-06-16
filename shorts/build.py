"""Build the BOMB gameplay short: TTS + frames + BGM -> vertical MP4.

Fully offline:
  - open-jtalk for Japanese voice (per-speaker pitch / 1.4x rate)
  - PIL for frames (render.py)
  - numpy-synthesized royalty-free BGM
  - bundled static ffmpeg (imageio-ffmpeg) for muxing
"""
from __future__ import annotations
import os
import re
import subprocess
import wave
import contextlib
import numpy as np
import imageio_ffmpeg

import render
import script_data as S

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "bomb_short.mp4")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

DIC = "/var/lib/mecab/dic/open-jtalk/naist-jdic"
HTS = "/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice"

# Per-speaker open-jtalk params: half-tone (-fm), all-pass (-a), speed (-r ~1.4x)
VOICE = {
    "narrator": dict(fm=1.0, a=0.50, r=1.45),
    "rin":      dict(fm=6.0, a=0.42, r=1.5),   # bright, high, taunting
    "sou":      dict(fm=-4.0, a=0.58, r=1.35),  # low, calm, sly
    "kai":      dict(fm=1.0, a=0.50, r=1.55),   # energetic, gets baited
}
SR = 44100


def sanitize(text: str) -> str:
    """open-jtalk reads Japanese punctuation best; normalize ASCII marks."""
    text = text.replace("!", "。").replace("?", "。")
    text = text.replace("！", "。").replace("？", "。")
    text = text.replace("…", "、").replace("「", "").replace("」", "")
    text = re.sub(r"[ \t]", "", text)
    return text


def synth(text: str, speaker: str, path: str) -> float:
    v = VOICE[speaker]
    cmd = [
        "open_jtalk", "-x", DIC, "-m", HTS,
        "-fm", str(v["fm"]), "-a", str(v["a"]), "-r", str(v["r"]),
        "-ow", path,
    ]
    p = subprocess.run(cmd, input=sanitize(text).encode("utf-8"),
                       capture_output=True)
    if p.returncode != 0 or not os.path.exists(path):
        raise RuntimeError(f"open_jtalk failed: {p.stderr.decode()}")
    return wav_duration(path)


def wav_duration(path: str) -> float:
    with contextlib.closing(wave.open(path, "r")) as w:
        return w.getnframes() / float(w.getframerate())


def render_beat(beat) -> "render.Image.Image":
    kind = beat["kind"]
    spk = S.SPEAKERS[beat["speaker"]]
    if kind == "title":
        return render.render_title(beat["title"], beat["sub"])
    if kind == "rules":
        return render.render_rules(beat["items"])
    if kind == "outro":
        return render.render_outro()
    # game
    st = dict(beat["state"])
    st["subtitle"] = beat["text"]
    st["sub_speaker"] = spk
    return render.render_game(st)


# ---------- BGM ----------

def adsr(n, a=0.01, d=0.06, s=0.6, r=0.2):
    env = np.ones(n)
    ai = int(SR * a); di = int(SR * d); ri = int(SR * r)
    ai = min(ai, n);
    if ai: env[:ai] = np.linspace(0, 1, ai)
    if di and ai + di < n: env[ai:ai + di] = np.linspace(1, s, di)
    if ai + di < n: env[ai + di:] = s
    if ri and ri < n: env[-ri:] *= np.linspace(s, 0, ri)
    return env


def tone(freq, dur, vol=0.2, kind="sine"):
    n = int(SR * dur)
    t = np.arange(n) / SR
    if kind == "saw":
        wave_ = 2 * (t * freq - np.floor(0.5 + t * freq))
    elif kind == "tri":
        wave_ = 2 * np.abs(2 * (t * freq - np.floor(0.5 + t * freq))) - 1
    else:
        wave_ = np.sin(2 * np.pi * freq * t)
    return wave_ * adsr(n) * vol


def note(name):
    base = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = name[0]; octave = int(name[-1]); semis = base[n]
    if "#" in name: semis += 1
    midi = 12 * (octave + 1) + semis
    return 440.0 * 2 ** ((midi - 69) / 12)


def make_bgm(total: float) -> str:
    """Light, upbeat, original royalty-free loop."""
    bpm = 124
    beat = 60.0 / bpm
    # 4-bar loop, chord per bar (Am - F - C - G), arpeggio of 8ths
    chords = [["A3", "C4", "E4"], ["F3", "A3", "C4"],
              ["C4", "E4", "G4"], ["G3", "B3", "D4"]]
    bass = ["A2", "F2", "C2", "G2"]
    loop = np.zeros(0, dtype=np.float32)
    for bar in range(4):
        ch = chords[bar]
        bar_buf = np.zeros(int(SR * beat * 4), dtype=np.float32)
        # arpeggio: 8 eighth-notes
        for i in range(8):
            f = note(ch[i % 3]) * (2 if i % 4 == 3 else 1)
            seg = tone(f, beat / 2, vol=0.12, kind="tri")
            pos = int(SR * beat * i / 2)
            bar_buf[pos:pos + len(seg)] += seg[:len(bar_buf) - pos]
        # bass on each beat
        for b in range(4):
            seg = tone(note(bass[bar]) / 2, beat, vol=0.18, kind="saw")
            pos = int(SR * beat * b)
            bar_buf[pos:pos + len(seg)] += seg[:len(bar_buf) - pos]
        # soft kick
        for b in range(4):
            kn = int(SR * 0.12)
            tt = np.arange(kn) / SR
            kick = np.sin(2 * np.pi * (110 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 18) * 0.5
            pos = int(SR * beat * b)
            bar_buf[pos:pos + kn] += kick
        loop = np.concatenate([loop, bar_buf])
    # tile to length
    need = int(SR * total)
    reps = int(np.ceil(need / len(loop)))
    full = np.tile(loop, reps)[:need]
    # gentle fade in/out
    fi = int(SR * 0.8)
    full[:fi] *= np.linspace(0, 1, fi)
    full[-fi:] *= np.linspace(1, 0, fi)
    full = np.clip(full, -1, 1)
    path = os.path.join(BUILD, "bgm.wav")
    pcm = (full * 32767).astype(np.int16)
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path


def run(cmd):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(cmd[0] + " failed:\n" + r.stderr.decode()[-2000:])


def main():
    os.makedirs(BUILD, exist_ok=True)
    PAD = 0.45  # silence after each line
    clips = []
    total = 0.0
    print(f"Building {len(S.BEATS)} beats...")
    for i, beat in enumerate(S.BEATS):
        png = os.path.join(BUILD, f"f{i:02d}.png")
        wav = os.path.join(BUILD, f"a{i:02d}.wav")
        clip = os.path.join(BUILD, f"c{i:02d}.mp4")
        render_beat(beat).save(png)
        dur = synth(beat["text"], beat["speaker"], wav) + PAD
        # extra dwell on the climax bomb beat
        if "ドカーン" in beat["text"]:
            dur += 0.6
        total += dur
        run([FFMPEG, "-y", "-loop", "1", "-i", png, "-i", wav,
             "-c:v", "libx264", "-tune", "stillimage", "-r", "30",
             "-t", f"{dur:.3f}", "-pix_fmt", "yuv420p",
             "-vf", "scale=1080:1920", "-c:a", "aac", "-b:a", "160k",
             "-ar", str(SR), clip])
        clips.append(clip)
        print(f"  [{i:02d}] {beat['speaker']:8s} {dur:4.1f}s  {beat['text'][:24]}")

    # concat
    listf = os.path.join(BUILD, "list.txt")
    with open(listf, "w") as f:
        for c in clips:
            f.write(f"file '{c}'\n")
    concat = os.path.join(BUILD, "concat.mp4")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listf,
         "-c", "copy", concat])

    print(f"Total duration ~{total:.1f}s. Generating BGM + mixing...")
    bgm = make_bgm(total + 0.5)
    run([FFMPEG, "-y", "-i", concat, "-i", bgm, "-filter_complex",
         "[1:a]volume=0.16[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
         "-b:a", "192k", "-movflags", "+faststart", OUT])
    print(f"\nDone -> {OUT}  ({total:.1f}s)")


if __name__ == "__main__":
    main()
