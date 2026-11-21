"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface SignaturePadHandle {
  clear(): void;
  /** PNG data URL, or null if nothing has been drawn. */
  value(): string | null;
}

const SignaturePad = forwardRef<SignaturePadHandle, { onInk?: (inked: boolean) => void }>(function SignaturePad(
  { onInk },
  ref,
) {
  const cv = useRef<HTMLCanvasElement>(null);
  const inked = useRef(false);

  useEffect(() => {
    const c = cv.current!;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.lineWidth = 2.6;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#1d3f8a";

    let down = false;
    const pos = (e: PointerEvent) => {
      const b = c.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top] as const;
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      c.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      g.beginPath();
      g.moveTo(x, y);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const [x, y] = pos(e);
      g.lineTo(x, y);
      g.stroke();
      if (!inked.current) {
        inked.current = true;
        onInk?.(true);
      }
    };
    const onUp = () => (down = false);
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    return () => {
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
    };
  }, [onInk]);

  useImperativeHandle(ref, () => ({
    clear() {
      const c = cv.current!;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      inked.current = false;
      onInk?.(false);
    },
    value() {
      return inked.current ? cv.current!.toDataURL("image/png") : null;
    },
  }));

  return (
    <div className="sigpad">
      <canvas ref={cv} aria-label="Signature pad — draw with mouse or finger" />
      <span className="sigline">Sign above</span>
    </div>
  );
});

export default SignaturePad;
