"""Build the BOMB short from REAL game screenshots + speaker bubbles.

Pipeline (drift-free sync):
  1. Per beat: compose frame PNG (real screenshot + speech bubble, or
     intro/rules/outro splash) and synth a TTS line.
  2. Build silent video clips (image x duration) and concat them (video only).
  3. Build ONE master narration WAV from the same per-beat durations.
  4. Synth BGM, then mux video + narration + BGM in a single pass.
Because every video clip's length equals its audio segment length, the
subtitle bubbles stay perfectly aligned with the voice.
"""
from __future__ import annotations
import os, re, json, subprocess, wave, contextlib
import numpy as np
import imageio_ffmpeg
from PIL import Image

import render

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "bomb_short.mp4")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
DIC = "/var/lib/mecab/dic/open-jtalk/naist-jdic"
HTS = "/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice"
SR = 44100
PAD = 0.45

VOICE = {
    "narrator": dict(fm=1.0, a=0.50, r=1.45),
    "rin":      dict(fm=6.0, a=0.42, r=1.5),
    "sou":      dict(fm=-4.0, a=0.58, r=1.35),
    "kai":      dict(fm=1.0, a=0.50, r=1.55),
}


def sanitize(t):
    t = t.replace("!", "。").replace("?", "。").replace("！", "。").replace("？", "。")
    t = t.replace("…", "、").replace("「", "").replace("」", "").replace(".", "。")
    return re.sub(r"[ \t]", "", t)


def synth(text, speaker, path):
    v = VOICE.get(speaker, VOICE["narrator"])
    cmd = ["open_jtalk", "-x", DIC, "-m", HTS, "-fm", str(v["fm"]),
           "-a", str(v["a"]), "-r", str(v["r"]), "-ow", path]
    p = subprocess.run(cmd, input=sanitize(text).encode(), capture_output=True)
    if p.returncode != 0 or not os.path.exists(path):
        raise RuntimeError("open_jtalk: " + p.stderr.decode())
    return read_wav(path)


def read_wav(path):
    with contextlib.closing(wave.open(path, "r")) as w:
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(axis=1).astype(np.int16)
    if sr != SR:
        x = np.linspace(0, 1, len(data))
        xi = np.linspace(0, 1, int(len(data) * SR / sr))
        data = np.interp(xi, x, data).astype(np.int16)
    return data


def run(cmd):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(cmd[0] + ":\n" + r.stderr.decode()[-2000:])


def compose_frame(beat, idx):
    kind = beat["kind"]
    if kind == "title":
        img = render.render_title(beat["title"], beat["sub"])
    elif kind == "rules":
        img = render.render_rules(beat["items"])
    elif kind == "outro":
        img = render.render_outro()
    else:  # game
        base = Image.open(beat["screenshot"]).convert("RGB")
        spk = beat["speaker"]
        box = beat["boxes"].get(beat["speakerId"]) if beat.get("speakerId") else None
        img = render.draw_speech_bubble(base, spk, box, beat["text"],
                                        beat["shotW"], beat["shotH"])
    path = os.path.join(BUILD, f"frame{idx:02d}.png")
    img.save(path)
    return path


# ---- BGM (reused, light original loop) ----
def adsr(n, a=0.01, d=0.06, s=0.6, r=0.2):
    env = np.ones(n); ai=int(SR*a); di=int(SR*d); ri=int(SR*r); ai=min(ai,n)
    if ai: env[:ai]=np.linspace(0,1,ai)
    if di and ai+di<n: env[ai:ai+di]=np.linspace(1,s,di)
    if ai+di<n: env[ai+di:]=s
    if ri and ri<n: env[-ri:]*=np.linspace(s,0,ri)
    return env

def tone(freq,dur,vol,kind="sine"):
    n=int(SR*dur); t=np.arange(n)/SR
    if kind=="saw": w=2*(t*freq-np.floor(0.5+t*freq))
    elif kind=="tri": w=2*np.abs(2*(t*freq-np.floor(0.5+t*freq)))-1
    else: w=np.sin(2*np.pi*freq*t)
    return w*adsr(n)*vol

def note(name):
    base={"C":0,"D":2,"E":4,"F":5,"G":7,"A":9,"B":11}
    midi=12*(int(name[-1])+1)+base[name[0]]+(1 if "#" in name else 0)
    return 440.0*2**((midi-69)/12)

def make_bgm(total):
    bpm=124; beat=60/bpm
    chords=[["A3","C4","E4"],["F3","A3","C4"],["C4","E4","G4"],["G3","B3","D4"]]
    bass=["A2","F2","C2","G2"]; loop=np.zeros(0,dtype=np.float32)
    for bar in range(4):
        ch=chords[bar]; buf=np.zeros(int(SR*beat*4),dtype=np.float32)
        for i in range(8):
            f=note(ch[i%3])*(2 if i%4==3 else 1); seg=tone(f,beat/2,0.12,"tri")
            pos=int(SR*beat*i/2); buf[pos:pos+len(seg)]+=seg[:len(buf)-pos]
        for b in range(4):
            seg=tone(note(bass[bar])/2,beat,0.18,"saw"); pos=int(SR*beat*b)
            buf[pos:pos+len(seg)]+=seg[:len(buf)-pos]
            kn=int(SR*0.12); tt=np.arange(kn)/SR
            kick=np.sin(2*np.pi*(110*np.exp(-tt*30))*tt)*np.exp(-tt*18)*0.5
            buf[pos:pos+kn]+=kick
        loop=np.concatenate([loop,buf])
    need=int(SR*total); full=np.tile(loop,int(np.ceil(need/len(loop))))[:need]
    fi=int(SR*0.8); full[:fi]*=np.linspace(0,1,fi); full[-fi:]*=np.linspace(1,0,fi)
    return np.clip(full,-1,1)


def write_wav(path, arr_int16):
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(arr_int16.tobytes())


def main():
    meta = json.load(open(os.path.join(BUILD, "beats_meta.json")))
    clips, master = [], []
    print(f"Composing {len(meta)} beats...")
    for i, beat in enumerate(meta):
        frame = compose_frame(beat, i)
        wavp = os.path.join(BUILD, f"v{i:02d}.wav")
        voice = synth(beat["text"], beat["speaker"], wavp)
        dur = len(voice) / SR + PAD
        if "ドカーン" in beat["text"]:
            dur += 0.6
        # master audio segment = voice + silence to fill dur
        seg = np.zeros(int(dur * SR), dtype=np.int16)
        seg[:len(voice)] = voice
        master.append(seg)
        # silent video clip of exact duration
        clip = os.path.join(BUILD, f"clip{i:02d}.mp4")
        run([FFMPEG, "-y", "-loop", "1", "-i", frame, "-t", f"{dur:.3f}",
             "-r", "30", "-c:v", "libx264", "-tune", "stillimage",
             "-pix_fmt", "yuv420p", "-vf", "scale=1080:1920", clip])
        clips.append(clip)
        print(f"  [{i:02d}] {beat['kind']:6s} {beat['speaker']:8s} {dur:4.1f}s")

    # concat video (no audio -> no drift)
    listf = os.path.join(BUILD, "vlist.txt")
    open(listf, "w").write("".join(f"file '{c}'\n" for c in clips))
    video = os.path.join(BUILD, "video.mp4")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", video])

    # master narration
    narr = np.concatenate(master)
    write_wav(os.path.join(BUILD, "narration.wav"), narr)
    total = len(narr) / SR

    # bgm
    bgm = make_bgm(total + 0.3)
    write_wav(os.path.join(BUILD, "bgm.wav"), (bgm * 32767).astype(np.int16))

    print(f"Total {total:.1f}s. Muxing...")
    run([FFMPEG, "-y", "-i", video,
         "-i", os.path.join(BUILD, "narration.wav"),
         "-i", os.path.join(BUILD, "bgm.wav"),
         "-filter_complex",
         "[1:a]volume=1.0[v];[2:a]volume=0.14[b];[v][b]amix=inputs=2:duration=first:dropout_transition=2[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
         "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT])
    print("Done ->", OUT, f"({total:.1f}s)")


if __name__ == "__main__":
    main()
