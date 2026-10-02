/* Hero background — rede de partículas (canvas)
   Usa a cor --accent-color definida em main.css */
(function () {
  'use strict';

  const hero = document.getElementById('hero');
  const canvas = document.getElementById('hero-canvas');
  if (!hero || !canvas) return;

  const ctx = canvas.getContext('2d');
  const accent =
    getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#e50914';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LINK_DIST = 140;   // distância máxima para ligar duas partículas
  const MOUSE_DIST = 180;  // raio de ligação com o mouse
  const MAX_PARTICLES = 90;

  let w = 0, h = 0, particles = [], running = false, rafId = null;
  const mouse = { x: null, y: null };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(MAX_PARTICLES, Math.floor((w * h) / 16000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5
    }));
    if (!running) draw(); // mantém o quadro estático correto ao redimensionar
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (running) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < LINK_DIST) {
          ctx.globalAlpha = (1 - d / LINK_DIST) * 0.35;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      if (mouse.x !== null) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d < MOUSE_DIST) {
          ctx.globalAlpha = (1 - d / MOUSE_DIST) * 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    if (!running) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    loop();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  hero.addEventListener('mousemove', function (e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  hero.addEventListener('mouseleave', function () {
    mouse.x = mouse.y = null;
  });

  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // Pausa a animação quando o hero sai da tela (economiza bateria/CPU)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }).observe(hero);
  } else {
    start();
  }

  resize();
  start();
})();
