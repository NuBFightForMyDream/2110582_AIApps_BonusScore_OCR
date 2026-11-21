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
