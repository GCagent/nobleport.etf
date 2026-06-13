/* ========================================================
   CYBORG.IO — App Logic
   ======================================================== */

(function () {
  'use strict';

  // ── Mobile Nav Toggle ──
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const mainNav = document.querySelector('.main-nav');
  if (menuBtn && mainNav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      menuBtn.classList.toggle('active');
      menuBtn.setAttribute('aria-expanded', isOpen);
    });
    // Close on nav link click
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        menuBtn.classList.remove('active');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── Animated Number Counters ──
  function animateCounter(el, target, duration = 1200) {
    const start = performance.now();
    const from = 0;
    const isFloat = String(target).includes('.');
    
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      
      if (isFloat) {
        el.textContent = current.toFixed(3);
      } else {
        el.textContent = Math.round(current).toLocaleString();
      }
      
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }
    
    requestAnimationFrame(tick);
  }

  // ── Intersection Observer for counters and reveals ──
  const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px 0px -50px 0px'
  };

  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        if (!isNaN(target)) {
          animateCounter(el, target);
        }
        countObserver.unobserve(el);
      }
    });
  }, observerOptions);

  document.querySelectorAll('[data-count]').forEach(el => {
    countObserver.observe(el);
  });

  // ── KPI Bar Fill Animation ──
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.width = entry.target.style.getPropertyValue('--fill') || '0%';
        barObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.kpi-bar-fill').forEach(bar => {
    // Start at 0, animate to target
    const targetWidth = getComputedStyle(bar).getPropertyValue('--fill') || '0%';
    bar.style.setProperty('--fill', targetWidth);
    bar.style.width = '0%';
    barObserver.observe(bar);
  });

  // ── Hero Grid Canvas — Animated dot grid ──
  const canvas = document.getElementById('heroGrid');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let animId;
    let dots = [];
    const SPACING = 50;
    const DOT_RADIUS = 1;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      initDots(rect.width, rect.height);
    }

    function initDots(w, h) {
      dots = [];
      for (let x = 0; x < w; x += SPACING) {
        for (let y = 0; y < h; y += SPACING) {
          dots.push({
            x, y,
            baseAlpha: 0.1 + Math.random() * 0.15,
            phase: Math.random() * Math.PI * 2
          });
        }
      }
    }

    let time = 0;
    function draw() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      time += 0.008;

      for (const dot of dots) {
        const pulse = Math.sin(time + dot.phase) * 0.08;
        const alpha = dot.baseAlpha + pulse;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${Math.max(0, alpha)})`;
        ctx.fill();
      }

      // Draw occasional connecting lines between nearby dots
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SPACING * 1.5 && dist > SPACING * 0.8) {
            const lineAlpha = (Math.sin(time * 0.5 + i * 0.1) + 1) * 0.02;
            if (lineAlpha > 0.01) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(0, 229, 255, ${lineAlpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', () => {
      cancelAnimationFrame(animId);
      resize();
      draw();
    });
  }

  // ── Header scroll behavior ──
  const header = document.querySelector('.site-header');
  let lastScroll = 0;
  if (header) {
    window.addEventListener('scroll', () => {
      const curr = window.scrollY;
      if (curr > 100) {
        header.style.borderBottomColor = 'rgba(0, 229, 255, 0.1)';
      } else {
        header.style.borderBottomColor = '';
      }
      lastScroll = curr;
    }, { passive: true });
  }

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Typewriter effect for hero badge ──
  const badgeText = document.querySelector('.badge-text');
  if (badgeText) {
    const original = badgeText.textContent;
    badgeText.textContent = '';
    let i = 0;
    const typeInterval = setInterval(() => {
      badgeText.textContent = original.slice(0, i + 1);
      i++;
      if (i >= original.length) {
        clearInterval(typeInterval);
        // Blink cursor effect
        badgeText.style.borderRight = '2px solid var(--green)';
        setInterval(() => {
          badgeText.style.borderRightColor = 
            badgeText.style.borderRightColor === 'transparent' ? 'var(--green)' : 'transparent';
        }, 530);
      }
    }, 50);
  }

})();
