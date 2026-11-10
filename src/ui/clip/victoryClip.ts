/**
 * CLIPE DA VITÓRIA — records the boss fight straight from the browser so the
 * player gets a short video of the kill, ready to share.
 *
 * The map is several stacked canvases (terrain/3D layer + the 2D game
 * canvas), so every frame they are composited, in page order, onto one
 * recording canvas that MediaRecorder captures. To keep only the LAST
 * seconds without re-encoding, two recorders run staggered by half a
 * segment and each restarts once it reaches a full segment: at the kill the
 * older one always holds between SEGMENT/2 and SEGMENT of footage ending at
 * the kill, and the younger one is thrown away. Nothing is uploaded — the
 * clip only ever lives in the player's browser.
 */

const SEGMENT_MS = 20_000;
const FPS = 30;
const MAX_WIDTH = 1280;
/** How long the "boss defeated" card is shown at the end of the clip. */
export const CLIP_OUTRO_MS = 2600;

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickClipMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function isClipRecordingSupported(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas") as HTMLCanvasElement & { captureStream?: unknown };
  return typeof c.captureStream === "function" && pickClipMimeType() !== null;
}

export interface ClipOutro {
  title: string;
  subtitle: string;
  wave: string;
}

export interface FinishedClip {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
}

interface Segment {
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
}

export class VictoryClipRecorder {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stream: MediaStream;
  private readonly mimeType: string;
  private segments: Segment[] = [];
  private raf: number | null = null;
  private timer: number | null = null;
  private lastFrame = 0;
  private outro: (ClipOutro & { since: number }) | null = null;
  private stopped = false;

  constructor(private readonly container: HTMLElement) {
    this.mimeType = pickClipMimeType() ?? "video/webm";
    const rect = container.getBoundingClientRect();
    const scale = Math.min(1, MAX_WIDTH / Math.max(1, rect.width));
    this.canvas = document.createElement("canvas");
    // even dimensions keep H.264 encoders happy
    this.canvas.width = Math.max(2, Math.round((rect.width * scale) / 2) * 2);
    this.canvas.height = Math.max(2, Math.round((rect.height * scale) / 2) * 2);
    this.ctx = this.canvas.getContext("2d")!;
    this.stream = (this.canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(FPS);
  }

  start(): void {
    this.drawFrame(performance.now());
    this.startSegment();
    this.timer = window.setTimeout(() => this.startSegment(), SEGMENT_MS / 2);
    const loop = (now: number) => {
      if (this.stopped) return;
      if (now - this.lastFrame >= 1000 / FPS - 2) {
        this.lastFrame = now;
        this.drawFrame(now);
      }
      this.recycleSegments(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Shows the end card, keeps recording it for CLIP_OUTRO_MS, then returns the clip (null if nothing usable was recorded). */
  finish(outro: ClipOutro): Promise<FinishedClip | null> {
    this.outro = { ...outro, since: performance.now() };
    return new Promise((resolve) => {
      window.setTimeout(() => {
        const oldest = [...this.segments].sort((a, b) => a.startedAt - b.startedAt)[0];
        if (!oldest) {
          this.cancel();
          resolve(null);
          return;
        }
        this.segments = this.segments.filter((s) => s !== oldest);
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          const blob = new Blob(oldest.chunks, { type: this.mimeType.split(";")[0] });
          this.cancel();
          resolve(blob.size > 0 ? { blob, mimeType: blob.type, extension: blob.type.includes("mp4") ? "mp4" : "webm" } : null);
        };
        // the final piece of video arrives as one last dataavailable right around stop — wait for it before closing the file
        oldest.recorder.ondataavailable = (e) => {
          if (e.data.size > 0) oldest.chunks.push(e.data);
          if (oldest.recorder.state === "inactive") window.setTimeout(done, 0);
        };
        oldest.recorder.onstop = () => window.setTimeout(done, 250);
        try {
          oldest.recorder.requestData();
          oldest.recorder.stop();
        } catch {
          this.cancel();
          resolve(null);
        }
      }, CLIP_OUTRO_MS);
    });
  }

  cancel(): void {
    this.stopped = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    if (this.timer !== null) window.clearTimeout(this.timer);
    for (const s of this.segments) {
      s.recorder.ondataavailable = null;
      s.recorder.onstop = null;
      try {
        if (s.recorder.state !== "inactive") s.recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    this.segments = [];
    for (const track of this.stream.getTracks()) track.stop();
  }

  private startSegment(): void {
    if (this.stopped) return;
    try {
      const recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType, videoBitsPerSecond: 5_000_000 });
      const segment: Segment = { recorder, chunks: [], startedAt: performance.now() };
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) segment.chunks.push(e.data);
      };
      recorder.start(1000);
      this.segments.push(segment);
    } catch {
      /* recording unavailable — the game goes on without a clip */
    }
  }

  private recycleSegments(now: number): void {
    if (this.outro) return; // never cut the clip while the end card is rolling
    for (const s of [...this.segments]) {
      if (now - s.startedAt < SEGMENT_MS) continue;
      s.recorder.ondataavailable = null;
      try {
        s.recorder.stop();
      } catch {
        /* ignore */
      }
      this.segments = this.segments.filter((x) => x !== s);
      this.startSegment();
    }
  }

  private drawFrame(now: number): void {
    const { ctx, canvas } = this;
    const rect = this.container.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const layer of this.container.querySelectorAll("canvas")) {
      const r = layer.getBoundingClientRect();
      if (r.width < rect.width * 0.4 || r.height < rect.height * 0.4) continue; // only the full-map layers, not small UI previews
      if (layer.width === 0 || layer.height === 0) continue;
      try {
        ctx.drawImage(layer, (r.left - rect.left) * sx, (r.top - rect.top) * sy, r.width * sx, r.height * sy);
      } catch {
        /* a tainted/lost layer is skipped */
      }
    }
    this.drawWatermark();
    if (this.outro) this.drawOutro(now - this.outro.since);
  }

  private drawWatermark(): void {
    const { ctx, canvas } = this;
    const size = Math.round(canvas.height * 0.038);
    ctx.save();
    ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = "rgba(255,226,160,0.92)";
    ctx.fillText("HORDE NOVA", canvas.width - size * 0.8, canvas.height - size * 0.6);
    ctx.restore();
  }

  private drawOutro(elapsed: number): void {
    if (!this.outro) return;
    const { ctx, canvas } = this;
    const t = Math.min(1, elapsed / 450);
    const h = canvas.height;
    ctx.save();
    const band = ctx.createLinearGradient(0, h * 0.26, 0, h * 0.74);
    band.addColorStop(0, "rgba(10,6,2,0)");
    band.addColorStop(0.3, `rgba(10,6,2,${0.86 * t})`);
    band.addColorStop(0.7, `rgba(10,6,2,${0.86 * t})`);
    band.addColorStop(1, "rgba(10,6,2,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.26, canvas.width, h * 0.48);
    ctx.globalAlpha = t;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = h * 0.02;
    const cx = canvas.width / 2;
    const pop = 1 + (1 - t) * 0.25;
    ctx.font = `700 ${Math.round(h * 0.075 * pop)}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = "#ffd257";
    ctx.fillText(this.outro.title, cx, h * 0.44);
    ctx.font = `600 ${Math.round(h * 0.042)}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = "#f4e8d0";
    ctx.fillText(this.outro.subtitle, cx, h * 0.53);
    ctx.font = `700 ${Math.round(h * 0.032)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,226,160,0.9)";
    ctx.fillText(this.outro.wave, cx, h * 0.6);
    ctx.restore();
  }
}
