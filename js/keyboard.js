// מקלדת פסנתר מצוירת על קנבס
class KB {
  constructor(lo, hi) {
    while (lo % 12 !== 0) lo--;
    while (hi % 12 !== 11) hi++;
    this.lo = lo; this.hi = hi; this.whites = [];
    for (let m = lo; m <= hi; m++) if (!Music.isBlack(m)) this.whites.push(m);
    this.layout(0, 0, 100, 100);
  }
  layout(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.ww = w / this.whites.length; this.bw = this.ww * 0.62; this.bh = h * 0.62;
  }
  wi(m) { const o = Math.floor((m - this.lo) / 12), p = (m - this.lo) % 12; return o * 7 + [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][p]; }
  rect(m) {
    if (Music.isBlack(m)) return { x: this.x + (this.wi(m - 1) + 1) * this.ww - this.bw / 2, y: this.y, w: this.bw, h: this.bh, black: true };
    return { x: this.x + this.wi(m) * this.ww, y: this.y, w: this.ww, h: this.h, black: false };
  }
  hit(px, py) {
    if (py < this.y || py > this.y + this.h || px < this.x || px > this.x + this.w) return null;
    if (py < this.y + this.bh) for (let m = this.lo; m <= this.hi; m++) {
      if (!Music.isBlack(m)) continue;
      const r = this.rect(m); if (px >= r.x - 2 && px <= r.x + r.w + 2) return m;
    }
    return this.whites[Math.min(this.whites.length - 1, Math.floor((px - this.x) / this.ww))];
  }
  draw(ctx, colorFn) {
    const style = CFG.names === 'letters' ? 'letters' : 'sol';
    const allLabels = this.ww >= 30;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const m of this.whites) {
      const r = this.rect(m), c = colorFn && colorFn(m);
      ctx.fillStyle = c || '#f8fafc';
      rrect(ctx, r.x + 1, r.y, r.w - 2, r.h - 2, [0, 0, 6, 6]); ctx.fill();
      if (allLabels || m % 12 === 0) {
        ctx.fillStyle = c ? '#0f172a' : (m % 12 === 0 ? '#475569' : '#94a3b8');
        ctx.font = `600 ${Math.max(10, Math.min(15, this.ww * 0.36))}px Rubik, sans-serif`;
        ctx.fillText(Music.name(m, style), r.x + r.w / 2, r.y + r.h - 10);
      }
    }
    for (let m = this.lo; m <= this.hi; m++) {
      if (!Music.isBlack(m)) continue;
      const r = this.rect(m), c = colorFn && colorFn(m);
      ctx.fillStyle = c || '#1e293b';
      rrect(ctx, r.x, r.y, r.w, r.h, [0, 0, 4, 4]); ctx.fill();
    }
  }
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

// מחבר מגע/עכבר על קנבס למקלדת
function bindKeys(canvas, getKb) {
  const ptr = new Map();
  canvas.addEventListener('pointerdown', e => {
    const kb = getKb(); if (!kb) return;
    const r = canvas.getBoundingClientRect(), m = kb.hit(e.clientX - r.left, e.clientY - r.top);
    if (m != null) { e.preventDefault(); ptr.set(e.pointerId, m); Input.touch(m, true); }
  });
  const up = e => { const m = ptr.get(e.pointerId); if (m != null) { ptr.delete(e.pointerId); Input.touch(m, false); } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('pointerleave', up);
}
