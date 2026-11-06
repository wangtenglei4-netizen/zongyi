'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type Point = { x: number; y: number };
type Ignition = { x: number; y: number; start: number; reach: number; seed: number };
type Contour = { source: Ignition; points: Point[] };

const ignitions: Ignition[] = [
  { x: .06, y: .96, start: 0, reach: .47, seed: 1.8 },
  { x: .49, y: 1.01, start: .13, reach: .44, seed: 3.6 },
  { x: .78, y: .32, start: .31, reach: .38, seed: 6.1 },
];
const segments = 52;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const wave = Math.PI * 2;

function radiusAt(source: Ignition, progress: number, width: number) {
  const spread = clamp((progress - source.start) / (1 - source.start));
  return width * source.reach * (spread ** 1.14);
}

function edgeDistance(source: Ignition, radius: number, angle: number) {
  const irregularity = Math.sin(angle * 7 + source.seed) * .095
    + Math.sin(angle * 13 - source.seed * 2) * .055
    + Math.sin(angle * 23 + source.seed) * .035;
  return radius * (1 + irregularity);
}

function edgePoint(source: Ignition, radius: number, angle: number, width: number, height: number): Point {
  const distance = edgeDistance(source, radius, angle);
  return {
    x: source.x * width + Math.cos(angle) * distance,
    y: source.y * height + Math.sin(angle) * distance * .9,
  };
}

function exposedEdge(point: Point, own: Ignition, progress: number, width: number, height: number) {
  if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) return false;
  return !ignitions.some(source => {
    if (source === own) return false;
    const dx = point.x - source.x * width;
    const dy = (point.y - source.y * height) / .9;
    const radius = radiusAt(source, progress, width);
    return Math.hypot(dx, dy) < edgeDistance(source, radius, Math.atan2(dy, dx)) - 1;
  });
}

function tracePaperHoles(ctx: CanvasRenderingContext2D, contours: Contour[]) {
  ctx.beginPath();
  for (const { points } of contours) {
    ctx.moveTo(points[0].x, points[0].y);
    for (const { x, y } of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
  }
}

function paintPaper(ctx: CanvasRenderingContext2D, envelope: HTMLImageElement, contours: Contour[], width: number, height: number) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(envelope, 0, 0, width, height);
  tracePaperHoles(ctx, contours);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.fill();

  // Char and glow follow the same cutouts, on the pixels of the remaining envelope only.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#553320';
  ctx.lineWidth = 22;
  ctx.stroke();
  ctx.strokeStyle = '#261209';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.strokeStyle = '#a34420';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = '#ffb35c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function flame(ctx: CanvasRenderingContext2D, point: Point, height: number, lean: number, alpha: number) {
  const { x, y } = point;
  const width = 4 + height * .16;
  const gradient = ctx.createLinearGradient(x, y - height, x, y + 2);
  gradient.addColorStop(0, 'rgba(244,65,11,0)');
  gradient.addColorStop(.28, 'rgba(245,73,14,.45)');
  gradient.addColorStop(.62, '#f77a1f');
  gradient.addColorStop(.84, '#ffc35b');
  gradient.addColorStop(1, '#fff1b5');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x - width, y + 1);
  ctx.bezierCurveTo(x - width * 1.1, y - height * .36, x + lean * .55, y - height * .52, x + lean, y - height);
  ctx.bezierCurveTo(x + lean - width * .1, y - height * .52, x + width * 1.3, y - height * .25, x + width, y + 1);
  ctx.closePath();
  ctx.fill();
}

function paintFlames(ctx: CanvasRenderingContext2D, contours: Contour[],
  progress: number, seconds: number, width: number, height: number) {
  const fade = clamp((1 - progress) / .17);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const { source, points } of contours) {
    for (let i = 0; i < points.length; i += 3) {
      const point = points[i];
      if (!exposedEdge(point, source, progress, width, height)) continue;
      const flicker = .5 + .5 * Math.sin(seconds * (17 + i % 6) + i * 2.37 + source.seed);
      const flameHeight = (12 + 33 * flicker ** 1.5) * (0.72 + .28 * Math.sin(i * 5.3));
      const lean = 7 + Math.sin(seconds * 12 + i * 1.92) * 13;
      flame(ctx, point, flameHeight, lean, fade * (.46 + flicker * .46));
    }
  }

  for (let i = 0; i < 84; i++) {
    const birth = i / 102;
    const age = progress - birth;
    if (age < 0 || age > .24) continue;
    const source = ignitions[i % ignitions.length];
    const radius = radiusAt(source, birth, width);
    if (radius <= 1) continue;
    const origin = edgePoint(source, radius, i * 2.39996, width, height);
    if (!exposedEdge(origin, source, birth, width, height)) continue;
    const x = origin.x + Math.sin(i * 7.5) * age * 175 + age * 22;
    const y = origin.y - age * (185 + 78 * Math.sin(i * 3.1));
    ctx.globalAlpha = (1 - age / .24) * fade;
    ctx.fillStyle = i % 3 ? '#ff8a37' : '#ffdf8e';
    ctx.fillRect(x, y, i % 4 === 0 ? 2.6 : 1.4, i % 4 === 0 ? 2.6 : 1.4);
  }
  ctx.restore();
}

export function EnvelopeFire({ paper, duration }: { paper: RefObject<SVGSVGElement | null>; duration: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sheet = paper.current;
    const layer = canvas.current;
    const ctx = layer?.getContext('2d');
    if (!sheet || !layer || !ctx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const texture = new Image();
    const source = new XMLSerializer().serializeToString(sheet);
    const start = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = clamp((now - start) / duration);
      const width = sheet.clientWidth;
      const height = sheet.clientHeight;
      const canvasWidth = layer.clientWidth;
      const canvasHeight = layer.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const bitmapWidth = Math.ceil(canvasWidth * ratio);
      const bitmapHeight = Math.ceil(canvasHeight * ratio);
      if (width && height && bitmapWidth && bitmapHeight) {
        if (layer.width !== bitmapWidth) layer.width = bitmapWidth;
        if (layer.height !== bitmapHeight) layer.height = bitmapHeight;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.translate((canvasWidth - width) / 2, (canvasHeight - height) / 2);

        if (progress < .985) {
          const contours = ignitions.flatMap(source => {
            const radius = radiusAt(source, progress, width);
            if (radius < .5) return [];
            const points = Array.from({ length: segments }, (_, index) =>
              edgePoint(source, radius, index / segments * wave, width, height));
            return [{ source, points }];
          });
          paintPaper(ctx, texture, contours, width, height);
          paintFlames(ctx, contours, progress, (now - start) / 1000, width, height);
        }
        // Keep the original visible until the combined paper-and-fire frame can replace it.
        sheet.style.opacity = '0';
      }
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    texture.onload = () => { frame = requestAnimationFrame(animate); };
    texture.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    return () => {
      texture.onload = null;
      cancelAnimationFrame(frame);
      sheet.style.removeProperty('opacity');
    };
  }, [duration, paper]);

  return <div className="oath-fire" aria-hidden="true"><canvas ref={canvas}/></div>;
}
