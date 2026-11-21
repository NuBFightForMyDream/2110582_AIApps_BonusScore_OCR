import { CATALOG } from "./data";
import type { Order } from "./types";

/** Draws a fake photo of a signed delivery note. */
export function samplePhoto(o: Order): string {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 420;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 640, 420);
  grd.addColorStop(0, "#7b6a55");
  grd.addColorStop(1, "#4f4436");
  g.fillStyle = grd;
  g.fillRect(0, 0, 640, 420);
  g.save();
  g.translate(330, 215);
  g.rotate(-0.05);
  g.fillStyle = "#f7f3ea";
  g.shadowColor = "rgba(0,0,0,.4)";
  g.shadowBlur = 18;
  g.fillRect(-230, -180, 460, 360);
  g.shadowBlur = 0;
  g.fillStyle = "#132238";
  g.font = "bold 22px sans-serif";
  g.fillText("DELIVERY NOTE", -200, -140);
  g.font = "16px sans-serif";
  g.fillText(`${o.id}  ·  ${o.customer}`, -200, -112);
  g.strokeStyle = "#c9c0ad";
  g.lineWidth = 1;
  o.items.forEach((it, i) => {
    g.fillText(`${it.qty} × ${CATALOG[it.sku].name}`, -200, -72 + i * 28);
    g.beginPath();
    g.moveTo(-200, -64 + i * 28);
    g.lineTo(200, -64 + i * 28);
    g.stroke();
  });
  g.fillText("Received in good condition", -200, 70);
  g.beginPath();
  g.moveTo(-200, 140);
  g.lineTo(40, 140);
  g.stroke();
  drawSquiggle(g, -190, 130, 220, "#1d3f8a");
  g.fillStyle = "#132238";
  g.font = "13px sans-serif";
  g.fillText("Customer signature", -200, 160);
  g.restore();
  return c.toDataURL("image/jpeg", 0.85);
}

/** A generated signature, used by the guided demo. */
export function demoSignature(): string {
  const c = document.createElement("canvas");
  c.width = 520;
  c.height = 160;
  const g = c.getContext("2d")!;
  drawSquiggle(g, 90, 110, 340, "#1d3f8a");
  return c.toDataURL("image/png");
}

function drawSquiggle(g: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  const s = w / 220;
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x + 30 * s, y - 50, x + 50 * s, y + 20, x + 80 * s, y - 20);
  g.bezierCurveTo(x + 100 * s, y - 45, x + 120 * s, y + 20, x + 150 * s, y - 15);
  g.bezierCurveTo(x + 170 * s, y - 35, x + 190 * s, y, x + 220 * s, y - 25);
  g.stroke();
}
