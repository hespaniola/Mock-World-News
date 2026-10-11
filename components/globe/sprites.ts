import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Texture,
} from "three";

// Shared textures, built once on the client.
let dotTexture: Texture | null = null;
let haloTexture: Texture | null = null;

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Sharp bright core with a thin bloom, for news dots. */
export function getDotTexture(): Texture {
  return (dotTexture ??= canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }));
}

/** Very soft falloff, for country glow halos. */
export function getHaloTexture(): Texture {
  return (haloTexture ??= canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }));
}

const dotMaterials = new Map<string, SpriteMaterial>();

/** One shared additive material per color keeps draw state cheap. */
export function dotMaterial(color: string): SpriteMaterial {
  let m = dotMaterials.get(color);
  if (!m) {
    m = new SpriteMaterial({
      map: getDotTexture(),
      color: new Color(color),
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    dotMaterials.set(color, m);
  }
  return m;
}

const labelMaterials = new Map<string, { material: SpriteMaterial; aspect: number }>();

/** Cluster count label, e.g. "128". Material cached by text, so reclustering allocates nothing new. */
export function labelSprite(text: string): Sprite {
  let entry = labelMaterials.get(text);
  if (!entry) {
    const font = "600 28px 'JetBrains Mono', ui-monospace, monospace";
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width) + 12;
    const h = 36;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(1,6,11,0.75)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e8fbff";
    ctx.fillText(text, 6, h / 2 + 1);
    const texture = new CanvasTexture(c);
    texture.colorSpace = SRGBColorSpace;
    const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    entry = { material, aspect: w / h };
    labelMaterials.set(text, entry);
  }
  const s = new Sprite(entry.material);
  s.userData.aspect = entry.aspect;
  return s;
}

export { Group, Sprite };
