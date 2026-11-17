/*
  <flag-header> — a pull-and-spring string of signal flags, stitched like cross-stitch embroidery.

  Usage:
    <script src="flag-header.js" defer></script>
    <flag-header layout="string"></flag-header>
    <flag-header layout="logo" logo-src="assets/rv-logo.svg" height="240"></flag-header>

  Attributes:
    layout     "string" (flags only, default) or "logo" (logo tile hangs in the middle)
    logo-src   path to your logo image (used by layout="logo"); falls back to an "RV" tile
    height     height in px (default 100, or 130 with layout="logo")
    spring     1-100, how firmly the string snaps back (default 40)
    size       width of each flag in px (default 30); smaller = more flags

  Colors (set on the element or any parent):
    --flag-rope  --flag-edge  --flag-clip  --flag-logo-bg
*/
(function () {
  if (customElements.get('flag-header')) return;

  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var BLACK = '#1f2433';
  var RED = '#d93a40', BLUE = '#2f52b3', YEL = '#efbb57', WHITE = '#f7f3ea';
  var OVERDRAW = 120; // canvas extends this far below the element so pulled flags are never cropped
  var MAX_PULL = 62; // px the rope can be pulled from its resting spot

  var CSS = [
    ':host{display:block;position:relative;z-index:9;width:100%;height:100px;touch-action:none;',
    '--flag-rope:#c9cdd6;--flag-edge:rgba(16,26,61,.38);',
    '--flag-clip:#1a2142;--flag-logo-bg:#2c4fb0}',
    '@media (prefers-color-scheme:dark){:host{--flag-rope:#9ea5b8;',
    '--flag-edge:rgba(232,236,250,.45);--flag-clip:#04061a;--flag-logo-bg:#3a5fcc}}',
    ':host([layout="logo"]){height:130px}',
    'canvas{position:absolute;left:0;top:0;display:block;width:100%;pointer-events:none}'
  ].join('');


  function shade(c, f) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(c).trim());
    if (!m) return c;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, a = Math.abs(f);
    return 'rgb(' + Math.round(r + (t - r) * a) + ',' + Math.round(g + (t - g) * a) + ',' + Math.round(b + (t - b) * a) + ')';
  }
  function hex2(v) { return (v < 16 ? '0' : '') + v.toString(16); }
  function noise(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }

  // which thread colour sits at (u, v) in a flag, both 0..1; null = no fabric (swallowtail notch)
  function colorAt(L, u, v) {
    var cy = 0.4; // visual centre of a downward triangle sits above the middle
    var du = Math.abs(u - 0.5), dv = Math.abs(v - cy), cheb = Math.max(du, dv);
    var b;
    switch (L) {
      case 'A': return u < 0.5 ? WHITE : BLUE;
      case 'B': return RED;
      case 'C': b = Math.floor(v * 5); return b === 2 ? RED : (b === 1 || b === 3) ? WHITE : BLUE;
      case 'D': return (v > 0.25 && v < 0.75) ? BLUE : YEL;
      case 'E': return v < 0.5 ? BLUE : RED;
      case 'F': return (du + dv < 0.26) ? RED : WHITE;
      case 'G': return Math.floor(u * 6) % 2 === 0 ? YEL : BLUE;
      case 'H': return u < 0.5 ? WHITE : RED;
      case 'I': return (du * du + dv * dv < 0.05) ? BLACK : YEL;
      case 'J': return (v > 0.33 && v < 0.67) ? WHITE : BLUE;
      case 'K': return u < 0.5 ? YEL : BLUE;
      case 'L': return ((u < 0.5) === (v < cy)) ? YEL : BLACK;
      case 'M': return Math.abs(du - dv) < 0.13 ? WHITE : BLUE;
      case 'N': return ((Math.floor(u * 4) + Math.floor(v * 4)) % 2 === 0) ? BLUE : WHITE;
      case 'O': return (u + v < 1) ? YEL : RED;
      case 'P': return cheb < 0.2 ? WHITE : BLUE;
      case 'Q': return YEL;
      case 'R': return (du < 0.15 || dv < 0.15) ? YEL : RED;
      case 'S': return cheb < 0.2 ? BLUE : WHITE;
      case 'T': return u < 0.333 ? RED : u < 0.667 ? WHITE : BLUE;
      case 'U': return ((u < 0.5) === (v < cy)) ? RED : WHITE;
      case 'V': return Math.abs(du - dv) < 0.13 ? RED : WHITE;
      case 'W': return cheb < 0.12 ? RED : cheb < 0.26 ? WHITE : BLUE;
      case 'X': return (du < 0.13 || dv < 0.13) ? BLUE : WHITE;
      case 'Y': return Math.floor((u + v) * 4) % 2 === 0 ? RED : YEL;
      case 'Z':
        if (v - cy < u - 0.5 && v - cy < 0.5 - u) return YEL;
        if (v - cy > u - 0.5 && v - cy > 0.5 - u) return BLACK;
        return u < 0.5 ? RED : BLUE;
    }
    return WHITE;
  }

  // one cross stitch: lower thread "/", upper thread "\", plus a thin sheen on top
  function stitch(g, x, y, w, h, color, f) {
    var px = w * 0.13, py = h * 0.13, lw = Math.min(w, h) * 0.38;
    g.lineCap = 'round';
    g.lineWidth = lw;
    g.strokeStyle = shade(color, f - 0.2);
    g.beginPath(); g.moveTo(x + px, y + h - py); g.lineTo(x + w - px, y + py); g.stroke();
    g.strokeStyle = shade(color, f);
    g.beginPath(); g.moveTo(x + px, y + py); g.lineTo(x + w - px, y + h - py); g.stroke();
    g.strokeStyle = shade(color, Math.min(0.55, f + 0.4));
    g.lineWidth = lw * 0.26;
    g.beginPath(); g.moveTo(x + px + lw * 0.1, y + py - lw * 0.12); g.lineTo(x + w - px - lw * 0.1, y + h - py - lw * 0.12); g.stroke();
  }

  function init(host, root) {
    var cv = root.querySelector('canvas');
    var ctx = cv.getContext('2d');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    var W = 0, H = 0, Hc = 0, dpr = 1, N = 0, segLen = 0;
    var rope = [], rest = [], items = [];
    var layout = 'string', flagSize = 30, springK = 380, grab = null, logoImg = null, logoSrc = '';
    var raf = 0, stopped = false, logoBgNow = '#2c4fb0', mq = null;

    function readOptions() {
      var lay = host.getAttribute('layout') === 'logo' ? 'logo' : 'string';
      var sp = parseFloat(host.getAttribute('spring'));
      if (!isFinite(sp)) sp = 40;
      springK = 60 + Math.max(1, Math.min(100, sp)) * 8;
      var fs = parseFloat(host.getAttribute('size'));
      flagSize = isFinite(fs) ? Math.max(16, Math.min(80, fs)) : 30;
      var h = parseFloat(host.getAttribute('height'));
      host.style.height = (isFinite(h) && h > 80) ? h + 'px' : '';
      var src = host.getAttribute('logo-src') || '';
      if (src !== logoSrc) {
        logoSrc = src;
        if (src) {
          logoImg = new Image();
          logoImg.onload = function () { items.forEach(function (it) { if (it.logo) it.tex = makeTex(it); }); };
          logoImg.src = src;
        } else { logoImg = null; }
      }
      return lay;
    }

    function build() {
      var r = host.getBoundingClientRect();
      W = r.width; H = r.height; Hc = H + OVERDRAW;
      if (W < 1 || H < 1) { N = 0; rope = []; rest = []; items = []; return; }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(Hc * dpr); cv.style.height = Hc + 'px';

      var x0 = 0, x1 = W, y0 = 1, i; // rope ends sit on the top edge, flush with the element
      var sag = Math.max(14, Math.min(40, W * 0.045));
      N = Math.max(24, Math.round(W / 14));
      rest = [];
      for (i = 0; i < N; i++) {
        var t = i / (N - 1);
        rest.push({ x: x0 + (x1 - x0) * t, y: y0 + sag * 4 * t * (1 - t) });
      }
      var L = 0;
      for (i = 1; i < N; i++) L += Math.hypot(rest[i].x - rest[i - 1].x, rest[i].y - rest[i - 1].y);
      segLen = L / (N - 1);
      rope = rest.map(function (p) { return { x: p.x, y: p.y, px: p.x, py: p.y }; });

      var fw = flagSize;
      var slots = Math.max(6, Math.floor(W / (fw * 1.3)));
      if (layout === 'logo' && slots % 2 === 0) slots++;
      var slotW = W / slots, logoW = Math.max(56, fw * 1.6);
      var centre = Math.floor(slots / 2);
      var skip = layout === 'logo' ? Math.ceil((logoW / slotW - 1) / 2) : -1;
      items = [];
      var li = 0;
      for (var s = 0; s < slots; s++) {
        var isLogo = layout === 'logo' && s === centre;
        if (layout === 'logo' && !isLogo && Math.abs(s - centre) <= skip) continue;
        var tt = (s + 0.5) / slots;
        var w = isLogo ? logoW : fw;
        var h = isLogo ? w : fw * 1.3;
        var mid = tt * (N - 1), half = w / 2 / segLen;
        var ia = Math.max(0, Math.round(mid - half));
        var ib = Math.min(N - 1, Math.max(ia + 1, Math.round(mid + half)));
        var a = rope[ia], b = rope[ib];
        items.push({
          letter: isLogo ? null : LETTERS[li++ % LETTERS.length], logo: isLogo,
          w: w, h: h, ia: ia, ib: ib, ph: s * 0.9,
          bl: { x: a.x, y: a.y + h, px: a.x, py: a.y + h },
          br: { x: b.x, y: b.y + h, px: b.x, py: b.y + h }
        });
      }
      logoBgNow = (getComputedStyle(host).getPropertyValue('--flag-logo-bg') || '').trim() || '#2c4fb0';
      items.forEach(function (it) { it.tex = makeTex(it); });
    }

    function cons(p, q, len, wp, wq) {
      var dx = q.x - p.x, dy = q.y - p.y;
      var d = Math.hypot(dx, dy) || 1e-6;
      var k = (d - len) / d, tw = wp + wq;
      if (!tw) return;
      p.x += dx * k * wp / tw; p.y += dy * k * wp / tw;
      q.x -= dx * k * wq / tw; q.y -= dy * k * wq / tw;
    }

    function step(dt, time) {
      if (!N) return;
      var i, it, k;
      var damp = Math.max(0.5, 1 - 1.4 * Math.sqrt(springK) * dt);
      for (i = 1; i < N - 1; i++) {
        var p = rope[i], q = rest[i];
        var vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
        p.px = p.x; p.py = p.y;
        p.x += vx + (q.x - p.x) * springK * dt * dt;
        p.y += vy + (q.y - p.y) * springK * dt * dt;
      }
      for (var iter = 0; iter < 10; iter++) {
        for (i = 0; i < N - 1; i++) {
          var a = rope[i], b = rope[i + 1];
          var dx = b.x - a.x, dy = b.y - a.y;
          var d = Math.hypot(dx, dy) || 1e-6;
          var kk = (d - segLen) / d * 0.6;
          var wa = i === 0 ? 0 : 1, wb = i + 1 === N - 1 ? 0 : 1, tw = wa + wb;
          if (!tw) continue;
          a.x += dx * kk * wa / tw; a.y += dy * kk * wa / tw;
          b.x -= dx * kk * wb / tw; b.y -= dy * kk * wb / tw;
        }
        rope[0].x = rest[0].x; rope[0].y = rest[0].y;
        rope[N - 1].x = rest[N - 1].x; rope[N - 1].y = rest[N - 1].y;
        if (grab) {
          var g = rope[grab.i], rs = rest[grab.i];
          var gx = grab.tx - grab.ox - rs.x, gy = grab.ty - grab.oy - rs.y;
          var gd = Math.hypot(gx, gy) || 1e-6;
          var ge = MAX_PULL * Math.tanh(gd / MAX_PULL);
          g.x = rs.x + gx / gd * ge;
          g.y = Math.max(6, Math.min(Hc - 60, rs.y + gy / gd * ge));
          g.px = g.x; g.py = g.y;
        }
      }
      for (k = 0; k < items.length; k++) {
        it = items[k];
        var ta = rope[it.ia], tb = rope[it.ib];
        var wind = reduce ? 0 : (Math.sin(time * 1.3 + it.ph) * 0.6 + 0.4) * 60;
        [it.bl, it.br].forEach(function (pp) {
          var ux = (pp.x - pp.px) * 0.94, uy = (pp.y - pp.py) * 0.94;
          pp.px = pp.x; pp.py = pp.y;
          pp.x += ux + wind * dt * dt;
          pp.y += uy + 900 * dt * dt;
        });
        for (var c = 0; c < 4; c++) {
          var tw2 = Math.hypot(tb.x - ta.x, tb.y - ta.y);
          var diag = Math.hypot(tw2, it.h);
          cons(it.bl, ta, it.h, 1, 0);
          cons(it.br, tb, it.h, 1, 0);
          cons(it.bl, tb, diag, 1, 0);
          cons(it.br, ta, diag, 1, 0);
          cons(it.bl, it.br, tw2, 1, 1);
        }
      }
    }

    function sampleLogo(cols, rows) {
      try {
        var s = document.createElement('canvas'); s.width = cols; s.height = rows;
        var g = s.getContext('2d', { willReadFrequently: true });
        g.fillStyle = logoBgNow; g.fillRect(0, 0, cols, rows);
        var i, out = [], d;
        if (logoImg && logoImg.complete && logoImg.naturalWidth) {
          g.drawImage(logoImg, cols * 0.12, rows * 0.12, cols * 0.76, rows * 0.76);
          d = g.getImageData(0, 0, cols, rows).data;
          for (i = 0; i < cols * rows; i++) out.push('#' + hex2(d[i * 4]) + hex2(d[i * 4 + 1]) + hex2(d[i * 4 + 2]));
          return out;
        }
        d = g.getImageData(0, 0, 1, 1).data;
        var bgLum = (d[0] + d[1] + d[2]) / 3;
        g.fillStyle = '#ffffff';
        g.font = '700 ' + Math.round(rows * 0.5) + 'px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('RV', cols / 2, rows / 2 + rows * 0.03);
        d = g.getImageData(0, 0, cols, rows).data;
        var bgHex = '#' + hex2(0) + hex2(0) + hex2(0);
        for (i = 0; i < cols * rows; i++) {
          var lum = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
          out.push(lum > (bgLum + 255) / 2 ? WHITE : null);
        }
        return out;
      } catch (err) { return null; }
    }

    // pre-render a flag as stitched thread on a transparent ground
    function makeTex(it) {
      var sc = 3, cs = Math.max(2.6, Math.min(4.2, it.w / 11));
      var cols = Math.max(4, Math.round(it.w / cs)), rows = Math.max(4, Math.round(it.h / cs));
      var tw = Math.ceil(it.w * sc), th = Math.ceil(it.h * sc);
      var c = document.createElement('canvas'); c.width = tw; c.height = th;
      var g = c.getContext('2d');
      var cw = tw / cols, chh = th / rows, rx, ry;
      var sample = it.logo ? sampleLogo(cols, rows) : null;
      var base = /^#[0-9a-f]{6}$/i.test(logoBgNow) ? logoBgNow : '#2c4fb0';
      for (ry = 0; ry < rows; ry++) {
        for (rx = 0; rx < cols; rx++) {
          var col;
          if (it.logo) {
            if ((rx === 0 || rx === cols - 1) && (ry === 0 || ry === rows - 1)) continue;
            col = sample ? (sample[ry * cols + rx] || base) : base;
          } else {
            var cu = (rx + 0.5) / cols, cr = (ry + 0.5) / rows;
            col = Math.abs(cu - 0.5) <= (1 - cr) * 0.5 + 0.08 / cols ? colorAt(it.letter, cu, cr) : null;
          }
          if (!col) continue;
          var f = (noise(rx + it.ph * 7, ry) - 0.5) * 0.16;
          stitch(g, rx * cw, ry * chh, cw, chh, col, f);
        }
      }
      if (!it.logo) {
        // running-stitch outline so pale flags still read
        var lw = Math.max(1.4, cw * 0.2), o = lw / 2 + 0.5;
        g.save();
        g.setLineDash([cw * 0.8, cw * 0.55]);
        g.lineWidth = lw; g.lineCap = 'round'; g.strokeStyle = 'rgba(42,53,102,0.8)';
        g.beginPath();
        g.moveTo(o, o); g.lineTo(tw - o, o); g.lineTo(tw / 2, th - o); g.closePath();
        g.stroke();
        g.restore();
      }
      return c;
    }

    function render() {
      if (!N || cv.width < 1 || cv.height < 1) return;
      var cs = getComputedStyle(host);
      var col = {
        rope: cs.getPropertyValue('--flag-rope').trim(),
        edge: cs.getPropertyValue('--flag-edge').trim(), clip: cs.getPropertyValue('--flag-clip').trim(),
        logo: cs.getPropertyValue('--flag-logo-bg').trim()
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hc);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

      var k, it;
      for (k = 0; k < items.length; k++) {
        it = items[k];
        var a = rope[it.ia], b = rope[it.ib];
        var ux = (b.x - a.x) / it.w, uy = (b.y - a.y) / it.w;
        var vx = ((it.bl.x - a.x) + (it.br.x - b.x)) / 2 / it.h;
        var vy = ((it.bl.y - a.y) + (it.br.y - b.y)) / 2 / it.h;
        ctx.save();
        ctx.setTransform(dpr * ux, dpr * uy, dpr * vx, dpr * vy, dpr * a.x, dpr * a.y);
        ctx.drawImage(it.tex, 0, 0, it.w, it.h);
        ctx.restore();
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(rope[0].x, rope[0].y);
      for (var i = 1; i < N - 1; i++) {
        var mx = (rope[i].x + rope[i + 1].x) / 2, my = (rope[i].y + rope[i + 1].y) / 2;
        ctx.quadraticCurveTo(rope[i].x, rope[i].y, mx, my);
      }
      ctx.lineTo(rope[N - 1].x, rope[N - 1].y);
      ctx.strokeStyle = col.rope; ctx.lineWidth = 2; ctx.stroke();

      ctx.fillStyle = col.clip;
      for (k = 0; k < items.length; k++) {
        it = items[k];
        var ta = rope[it.ia], tb = rope[it.ib];
        ctx.fillRect(ta.x - 0.8, ta.y - 1, 1.6, 6);
        ctx.fillRect(tb.x - 0.8, tb.y - 1, 1.6, 6);
      }
    }

    function inQuad(p, q1, q2, q3, q4) {
      var poly = [q1, q2, q3, q4], inside = false;
      for (var i = 0, j = 3; i < 4; j = i++) {
        var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
        if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }

    function clampIdx(i) { return Math.max(1, Math.min(N - 2, i)); }

    function pick(p) {
      if (!N) return -1;
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var apex = { x: (it.bl.x + it.br.x) / 2, y: (it.bl.y + it.br.y) / 2 };
        var hit = it.logo ? inQuad(p, rope[it.ia], rope[it.ib], it.br, it.bl) : inQuad(p, rope[it.ia], rope[it.ib], apex, apex);
        if (hit) return clampIdx(Math.round((it.ia + it.ib) / 2));
      }
      var best = -1, bd = 900;
      for (var i = 1; i < N - 1; i++) {
        var d = Math.pow(rope[i].x - p.x, 2) + Math.pow(rope[i].y - p.y, 2);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }

    function pt(e) { var r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    host.addEventListener('pointerdown', function (e) {
      if (stopped) return;
      var p = pt(e), i = pick(p);
      if (i < 0) return;
      grab = { i: i, ox: p.x - rope[i].x, oy: p.y - rope[i].y, tx: p.x, ty: p.y };
      try { host.setPointerCapture(e.pointerId); } catch (err) {}
      host.style.cursor = 'grabbing';
      e.preventDefault();
    });
    host.addEventListener('pointermove', function (e) {
      if (stopped) return;
      var p = pt(e);
      if (grab) { grab.tx = p.x; grab.ty = p.y; return; }
      host.style.cursor = pick(p) >= 0 ? 'grab' : 'default';
    });
    function release() { grab = null; host.style.cursor = 'default'; }
    host.addEventListener('pointerup', release);
    host.addEventListener('pointercancel', release);

    var pending = false;
    var ro = new ResizeObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; grab = null; build(); });
    });
    ro.observe(host);

    var last = performance.now(), acc = 0, clock = 0, DT = 1 / 120;
    function frame(now) {
      if (stopped) return;
      acc += Math.min(0.05, (now - last) / 1000);
      last = now;
      var n = 0;
      try {
        while (acc >= DT && n < 6) { clock += DT; step(DT, clock); acc -= DT; n++; }
        render();
      } catch (err) {}
      raf = requestAnimationFrame(frame);
    }

    function refresh() { layout = readOptions(); grab = null; build(); }

    refresh();
    if (window.matchMedia) {
      mq = matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', refresh);
    }
    raf = requestAnimationFrame(frame);

    return {
      refresh: refresh,
      stop: function () {
        stopped = true; cancelAnimationFrame(raf); ro.disconnect();
        if (mq && mq.removeEventListener) mq.removeEventListener('change', refresh);
      }
    };
  }

  class FlagHeader extends HTMLElement {
    static get observedAttributes() { return ['layout', 'logo-src', 'height', 'spring', 'size']; }
    constructor() {
      super();
      this._api = null;
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<style>' + CSS + '</style><canvas role="img" aria-label="A string of signal flags. Drag a flag or the rope to stretch it."></canvas>';
    }
    connectedCallback() { if (!this._api) this._api = init(this, this.shadowRoot); }
    disconnectedCallback() { if (this._api) { this._api.stop(); this._api = null; } }
    attributeChangedCallback() { if (this._api) this._api.refresh(); }
  }
  customElements.define('flag-header', FlagHeader);
})();