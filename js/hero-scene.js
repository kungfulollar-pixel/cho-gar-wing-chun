/* ============================================
   Dragon Cave – 3D Hero-Szene (Three.js)
   Dezente, schwebende "Drachenperle" mit
   treibenden Glutpartikeln. Reagiert leicht auf
   Maus & Scroll, respektiert reduzierte Bewegung.
   ============================================ */

(async function () {
  var mount = document.getElementById('hero-canvas-mount');
  if (!mount) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = mount.closest('.hero') || mount.parentElement;

  var THREE;
  try {
    THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  } catch (err) {
    return; // No network / CDN blocked -> gradient background stays as-is.
  }

  // On some tabs the GPU/compositor isn't ready the instant a fresh page
  // finishes loading, so the very first WebGL context request can fail.
  // Retry a few times with backoff before giving up on the 3D scene.
  function acquireContext(attempt) {
    var el = document.createElement('canvas');
    el.className = 'scene-canvas';
    mount.appendChild(el);
    var context = el.getContext('webgl', { alpha: true, antialias: true }) ||
      el.getContext('experimental-webgl', { alpha: true, antialias: true });
    if (context) return { canvas: el, gl: context };
    mount.removeChild(el);
    if (attempt >= 4) return null;
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(acquireContext(attempt + 1));
      }, 200 * (attempt + 1));
    });
  }

  var acquired = await acquireContext(0);
  if (!acquired) return; // WebGL genuinely unavailable -> gradient background stays as-is.

  var canvas = acquired.canvas;
  var gl = acquired.gl;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, context: gl, alpha: true, antialias: true });
  } catch (err) {
    return;
  }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 32);

  var GOLD = 0xd4af37;
  var RED = 0x9e1b1b;

  function setSize() {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  setSize();
  window.addEventListener('resize', setSize);

  // Drachenperle: zwei verschachtelte Wireframe-Koerper
  var pearlGroup = new THREE.Group();
  pearlGroup.position.set(9, -1, -4);

  var outerGeo = new THREE.IcosahedronGeometry(6, 1);
  var outerMat = new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.32 });
  var outer = new THREE.Mesh(outerGeo, outerMat);
  pearlGroup.add(outer);

  var innerGeo = new THREE.IcosahedronGeometry(3.6, 0);
  var innerMat = new THREE.MeshBasicMaterial({ color: RED, wireframe: true, transparent: true, opacity: 0.35 });
  var inner = new THREE.Mesh(innerGeo, innerMat);
  pearlGroup.add(inner);

  var baseOpacity = { outer: outerMat.opacity, inner: innerMat.opacity, particles: 0.75 };

  scene.add(pearlGroup);

  // Glutpartikel
  var COUNT = 220;
  var positions = new Float32Array(COUNT * 3);
  var colors = new Float32Array(COUNT * 3);
  var phases = new Float32Array(COUNT);
  var speeds = new Float32Array(COUNT);

  var goldColor = new THREE.Color(GOLD);
  var redColor = new THREE.Color(RED);

  for (var i = 0; i < COUNT; i++) {
    var x = (Math.random() - 0.3) * 34;
    var y = (Math.random() - 0.5) * 30;
    var z = (Math.random() - 0.5) * 18;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    var mixed = goldColor.clone().lerp(redColor, Math.random());
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;

    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.15 + Math.random() * 0.35;
  }

  var particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  var particleMat = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  var particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Maus-Parallax
  var mouseX = 0, mouseY = 0, targetRotX = 0, targetRotY = 0;
  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  });

  // Sichtbarkeit pausieren, wenn Hero nicht im Viewport ist
  var isVisible = true;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { isVisible = entry.isIntersecting; });
    }, { threshold: 0.05 });
    io.observe(hero);
  }
  document.addEventListener('visibilitychange', function () {
    isVisible = isVisible && !document.hidden;
  });

  // Sanfter Scroll-Parallax ueber die Hero-Hoehe
  var scrollFade = 1;
  function updateScrollFade() {
    var rect = hero.getBoundingClientRect();
    var progress = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);
    scrollFade = 1 - progress * 0.7;
    pearlGroup.position.y = -1 - progress * 6;
  }
  window.addEventListener('scroll', updateScrollFade, { passive: true });
  updateScrollFade();

  var clock = new THREE.Clock();

  function renderStatic() {
    renderer.render(scene, camera);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    outer.rotation.y += dt * 0.09;
    outer.rotation.x += dt * 0.03;
    inner.rotation.y -= dt * 0.13;
    inner.rotation.x -= dt * 0.05;

    targetRotX += (mouseY * 0.12 - targetRotX) * 0.04;
    targetRotY += (mouseX * 0.16 - targetRotY) * 0.04;
    pearlGroup.rotation.x = targetRotX;
    pearlGroup.rotation.z = targetRotY * 0.3;
    camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 1 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    var posAttr = particleGeo.attributes.position;
    for (var i = 0; i < COUNT; i++) {
      var idx = i * 3;
      var newY = posAttr.array[idx + 1] + speeds[i] * dt;
      if (newY > 16) newY = -16;
      posAttr.array[idx + 1] = newY;
      posAttr.array[idx] += Math.sin(t * 0.5 + phases[i]) * 0.003;
    }
    posAttr.needsUpdate = true;

    particles.material.opacity = baseOpacity.particles * scrollFade;
    outerMat.opacity = baseOpacity.outer * scrollFade;
    innerMat.opacity = baseOpacity.inner * scrollFade;
    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    renderStatic();
  } else {
    animate();
  }
})();
