/* Hero background — terreno 3D em wireframe + estrelas + spotlight do mouse
   Canvas 2D puro, sem bibliotecas. Cores vêm de --accent-color e --background-color. */
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var canvas = document.getElementById('hero-canvas');
  if (!hero || !canvas) return;
  var spot = hero.querySelector('.hero-spotlight');
  var ctx = canvas.getContext('2d');

  function toRGB(str, fallback) {
    str = (str || '').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str);
    if (m) {
      var hx = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
      return [parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16)];
    }
    var r = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(str);
    return r ? [+r[1], +r[2], +r[3]] : fallback;
  }

  var ACCENT = toRGB(getComputedStyle(document.documentElement).getPropertyValue('--accent-color'), [229, 9, 20]);
  var BG = toRGB(getComputedStyle(hero).getPropertyValue('--background-color'), [6, 6, 6]);
  var A = ACCENT.join(',');
  var B = BG.join(',');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Parâmetros do terreno ----
  var HORIZON = 0.56;  // posição do horizonte (fração da altura do hero)
  var CAM_H = 4.6;     // altura da câmera
  var SPEED = 2.2;     // velocidade de avanço (unidades/segundo)

  var w = 0, h = 0, dpr = 1;
  var ROWS, DZ, DX, HALF, N, Z0, focal;
  var px, py, pk, rowZ;
  var stars = [];
  var mouse = { x: 0, y: 0, cx: 0, cy: 0, active: false };
  var clock = 0, last = 0, running = false, rafId = null;

  function setup() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var small = w < 700;
    ROWS = small ? 24 : 36;
    DZ = small ? 2.4 : 1.6;
    DX = small ? 4.4 : 1.9;
    HALF = small ? 26 : 62;
    N = HALF * 2 + 1;
    Z0 = DZ + 0.5;
    focal = h * 0.40;

    px = new Float32Array((ROWS + 1) * N);
    py = new Float32Array((ROWS + 1) * N);
    pk = new Float32Array((ROWS + 1) * N);
    rowZ = new Float32Array(ROWS + 1);

    var count = Math.min(140, Math.floor((w * h) / 9000));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * HORIZON * 0.94,
        r: Math.random() * 1.1 + 0.4,
        ph: Math.random() * 6.28,
        sp: Math.random() * 1.6 + 0.6,
        layer: Math.random() * 0.8 + 0.2,
        red: Math.random() < 0.22
      });
    }
    mouse.cx = w / 2;
    mouse.cy = h / 2;
  }

  function smooth(a, b, v) {
    var t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // Altura do terreno: vale plano no centro (onde fica o texto), montanhas nas laterais
  function heightAt(x, wz) {
    var a = smooth(7, 40, Math.abs(x));
    var n = Math.sin(x * 0.17 + wz * 0.13) * 0.9 +
            Math.sin(x * 0.071 - wz * 0.21 + 1.3) * 0.7 +
            Math.sin(x * 0.31 + wz * 0.047 + 2.1) * 0.35;
    var base = a * (n * 0.5 + 0.95) * 2.4;
    var ripple = (1 - a) * 0.09 * Math.sin(wz * 0.9 + x * 0.45);
    return base + ripple;
  }

  function drawStars(t, horizon) {
    var mx = mouse.active ? (mouse.cx / w - 0.5) : 0;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      var x = s.x - mx * 22 * s.layer;
      ctx.globalAlpha = tw * (0.35 + 0.65 * (s.y / (horizon * 0.94)) * 0.6 + 0.2);
      ctx.fillStyle = s.red ? 'rgb(' + A + ')' : '#e8eaf0';
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHorizonGlow(horizon) {
    ctx.save();
    ctx.translate(w / 2, horizon);
    ctx.scale(1, 0.32);
    var rad = Math.max(w, 600) * 0.55;
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, 'rgba(' + A + ',0.38)');
    g.addColorStop(0.5, 'rgba(' + A + ',0.10)');
    g.addColorStop(1, 'rgba(' + A + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
    ctx.restore();
  }

  function render(t) {
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    var horizon = h * HORIZON;

    drawStars(t, horizon);
    drawHorizonGlow(horizon);

    var travelled = t * SPEED;
    var phase = (travelled / DZ) % 1;
    var cx = w / 2;
    var R = Math.min(230, w * 0.28), R2 = R * R;
    var i, c, idx;

    // 1) projeta todos os vértices
    for (i = 0; i <= ROWS; i++) {
      var z = Z0 + (i - phase) * DZ;
      var s = focal / z;
      rowZ[i] = z;
      var wz = z + travelled;
      for (c = 0; c < N; c++) {
        var x = (c - HALF) * DX;
        var X = cx + x * s;
        var Y = horizon + (CAM_H - heightAt(x, wz)) * s;
        var k = 0;
        if (mouse.active) {
          var dx = X - mouse.cx, dy = Y - mouse.cy, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            k = Math.exp(-d2 / (R2 * 0.28));
            // o terreno "respira" em ondas ao redor do cursor
            Y -= k * s * (0.35 + 0.9 * Math.sin(t * 4.5 - Math.sqrt(d2) * 0.045));
          }
        }
        idx = i * N + c;
        px[idx] = X; py[idx] = Y; pk[idx] = k;
      }
    }

    // 2) desenha de trás para frente (as faixas da frente tapam as de trás)
    var span = ROWS * DZ;
    ctx.lineJoin = 'round';
    for (i = ROWS; i >= 1; i--) {
      var fade = Math.max(0, 1 - (rowZ[i] - Z0) / span);
      var alpha = 0.05 + 0.85 * Math.pow(fade, 1.35);
      var f0 = i * N, n0 = (i - 1) * N;

      ctx.beginPath();
      ctx.moveTo(px[f0], py[f0]);
      for (c = 1; c < N; c++) ctx.lineTo(px[f0 + c], py[f0 + c]);
      for (c = N - 1; c >= 0; c--) ctx.lineTo(px[n0 + c], py[n0 + c]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(' + B + ',0.80)';
      ctx.fill();

      ctx.lineWidth = 0.5 + fade * 1.1;
      // linhas laterais (colunas)
      ctx.strokeStyle = 'rgba(' + A + ',' + (alpha * 0.65).toFixed(3) + ')';
      ctx.beginPath();
      for (c = 0; c < N; c++) {
        ctx.moveTo(px[f0 + c], py[f0 + c]);
        ctx.lineTo(px[n0 + c], py[n0 + c]);
      }
      ctx.stroke();
      // linha da fileira
      ctx.strokeStyle = 'rgba(' + A + ',' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(px[f0], py[f0]);
      for (c = 1; c < N; c++) ctx.lineTo(px[f0 + c], py[f0 + c]);
      ctx.stroke();
    }
    // fileira mais próxima
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(' + A + ',0.9)';
    ctx.beginPath();
    ctx.moveTo(px[0], py[0]);
    for (c = 1; c < N; c++) ctx.lineTo(px[c], py[c]);
    ctx.stroke();

    // 3) pontos brilhantes nos vértices perto do mouse
    if (mouse.active) {
      for (idx = 0; idx < (ROWS + 1) * N; idx++) {
        var kk = pk[idx];
        // só nos vértices mais próximos (no fundo eles ficam amontoados demais)
        if (kk > 0.18 && rowZ[(idx / N) | 0] < Z0 + span * 0.45) {
          ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.9, kk).toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(px[idx], py[idx], 1 + kk * 1.6, 0, 6.2832);
          ctx.fill();
        }
      }
    }

    // 4) linha do horizonte
    var hg = ctx.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(' + A + ',0)');
    hg.addColorStop(0.5, 'rgba(' + A + ',0.95)');
    hg.addColorStop(1, 'rgba(' + A + ',0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - 0.5, w, 1.5);
  }

  function updateSpotlight() {
    mouse.cx += (mouse.x - mouse.cx) * 0.14;
    mouse.cy += (mouse.y - mouse.cy) * 0.14;
    if (spot) {
      spot.style.setProperty('--mx', mouse.cx.toFixed(1) + 'px');
      spot.style.setProperty('--my', mouse.cy.toFixed(1) + 'px');
    }
  }

  function frame(now) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    clock += dt;
    updateSpotlight();
    render(clock);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  function setPointer(e) {
    var r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    if (!mouse.active) { mouse.cx = mouse.x; mouse.cy = mouse.y; }
    mouse.active = true;
    if (spot && !reduceMotion) spot.classList.add('is-active');
  }

  hero.addEventListener('pointermove', setPointer);
  hero.addEventListener('pointerdown', setPointer);
  hero.addEventListener('pointerleave', function () {
    mouse.active = false;
    if (spot) spot.classList.remove('is-active');
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      setup();
      if (!running) render(clock);
    }, 150);
  });

  setup();
  render(0); // primeiro quadro (e único, se "reduzir movimento" estiver ativo)

  // Só anima enquanto o hero está visível
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }).observe(hero);
  } else {
    start();
  }
})();
