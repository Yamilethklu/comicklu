import type { ComicData } from "./types";
import { mediaUrl } from "./native";

/** PDF completo A4, creado en el navegador tras autorización de compra Stripe.
 * No pasa el archivo por la función Vercel (límite de respuesta de ~4.5 MB).
 * Las imágenes y los textos se componen juntos en cada página del documento.
 */
const W = 1240, H = 1754;
const encode = (s: string) => new TextEncoder().encode(s);

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  width: number, size: number, lineHeight: number, maxLines = 15): number {
  ctx.font = `600 ${size}px sans-serif`;
  const words = text.split(/\s+/).filter(Boolean);
  let row = "", count = 0;
  for (const word of words) {
    const candidate = row ? row + " " + word : word;
    if (ctx.measureText(candidate).width > width && row) {
      ctx.fillText(row, x, y); y += lineHeight; row = word; count++;
      if (count >= maxLines) return y;
    } else row = candidate;
  }
  if (row && count < maxLines) { ctx.fillText(row, x, y); y += lineHeight; }
  return y;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar una imagen de la historieta. Comprueba la conexión."));
    img.src = url;
  });
}
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
}
async function jpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("No se pudo preparar el PDF.")), "image/jpeg", 0.77));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Genera un PDF real con portada y todas las viñetas (una por página). */
export async function buildComicPdf(comic: ComicData): Promise<Blob> {
  if (!comic.panels.length) throw new Error("Agrega viñetas antes de exportar.");
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite generar el PDF.");
  const ctx: CanvasRenderingContext2D = context;
  const images: Uint8Array[] = [];
  function background() {
    ctx.fillStyle = "#fffdf5"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, W, 18);
    ctx.fillRect(0, H - 18, W, 18);
  }

  background();
  ctx.fillStyle = "#111827";
  ctx.font = "bold 40px sans-serif"; ctx.fillText("COMICKLU", 90, 118);
  ctx.fillRect(90, 152, 320, 7);
  ctx.font = "bold 72px sans-serif";
  let y = drawText(ctx, comic.title || "Mi historieta", 90, 360, W - 180, 72, 90, 5);
  ctx.font = "28px sans-serif"; ctx.fillStyle = "#4b5563";
  y = drawText(ctx, comic.synopsis || "Una historia creada en ComicKlu", 95, y + 75, W - 190, 33, 50, 12);
  ctx.fillStyle = "#6b7280"; ctx.font = "25px sans-serif";
  ctx.fillText(`${comic.panels.length} viñetas · ComicKlu`, 95, H - 115);
  images.push(await jpeg(canvas));

  for (let i = 0; i < comic.panels.length; i++) {
    const panel = comic.panels[i];
    background(); ctx.fillStyle = "#111827";
    ctx.font = "bold 31px sans-serif"; ctx.fillText(comic.title.slice(0, 56), 78, 92);
    ctx.fillRect(78, 116, W - 156, 4);
    const imageX = 78, imageY = 160, imageW = W - 156, imageH = 1090;
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(imageX, imageY, imageW, imageH);
    if (panel.imageUrl) {
      const img = await loadImage(mediaUrl(panel.imageUrl));
      drawContain(ctx, img, imageX, imageY, imageW, imageH);
    } else {
      ctx.fillStyle = "#6b7280"; ctx.font = "bold 30px sans-serif";
      ctx.fillText("Viñeta sin imagen", imageX + 35, imageY + 75);
    }
    let textY = 1330;
    ctx.fillStyle = "#111827";
    if (panel.caption) {
      ctx.font = "bold 31px sans-serif"; ctx.fillText("NARRACIÓN", 78, textY); textY += 48;
      textY = drawText(ctx, panel.caption, 85, textY, W - 170, 27, 38, 6) + 25;
    }
    if (panel.dialogue) {
      ctx.fillStyle = "#7c3aed"; ctx.font = "bold 29px sans-serif"; ctx.fillText("DIÁLOGO", 78, textY); textY += 46;
      ctx.fillStyle = "#111827"; drawText(ctx, panel.dialogue, 85, textY, W - 170, 26, 36, 5);
    }
    ctx.font = "bold 25px sans-serif"; ctx.fillStyle = "#4b5563";
    ctx.fillText(`VIÑETA ${i + 1} DE ${comic.panels.length}`, 78, H - 100);
    images.push(await jpeg(canvas));
  }

  // Montaje de PDF 1.4 sin dependencias externas; páginas JPEG incrustadas.
  const chunks: BlobPart[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const add = (b: Uint8Array) => { const ab = new ArrayBuffer(b.byteLength); new Uint8Array(ab).set(b); chunks.push(ab); length += b.byteLength; };
  const write = (s: string) => add(encode(s));
  write("%PDF-1.4\n");
  function begin(id: number) { offsets[id] = length; write(`${id} 0 obj\n`); }
  function end() { write("endobj\n"); }
  const count = images.length;
  begin(1); write("<< /Type /Catalog /Pages 2 0 R >>\n"); end();
  begin(2);
  write(`<< /Type /Pages /Count ${count} /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>\n`);
  end();
  for (let i = 0; i < count; i++) {
    const page = 3 + i * 3, image = page + 1, content = page + 2, bytes = images[i];
    begin(page);
    write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>\n`);
    end();
    begin(image);
    write(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.byteLength} >>\nstream\n`);
    add(bytes); write("\nendstream\n"); end();
    const ops = encode("q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n");
    begin(content); write(`<< /Length ${ops.length} >>\nstream\n`); add(ops); write("endstream\n"); end();
  }
  const xref = length;
  const total = 3 + 3 * count;
  write(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let id = 1; id < total; id++) write(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

export function downloadComicPdf(blob: Blob, name: string) {
  const safe = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 70) || "historieta";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = safe + ".pdf";
  document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
