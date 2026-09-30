// Keyboard, mouse and touch input for the 3D world.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedSet = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.zoom = 0;
    this.joy = { x: 0, y: 0, active: false };
    this.enabled = true;
    this.lastLookTime = -10;
    this.touchMode = false; // on-screen joystick and buttons are active
    this.touchMouse = false; // ...and the mouse drives them too (whiteboards that act like a mouse)
    this.dragging = false;

    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!this.keys.has(e.code)) this.pressedSet.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && this.enabled) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    let lastX = 0;
    let lastY = 0;
    let pid = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.onScreen(e)) return; // handled by the on-screen controls
      this.dragging = true;
      pid = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerId !== pid) return;
      this.lookX += e.clientX - lastX;
      this.lookY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.lastLookTime = performance.now() / 1000;
    });
    const end = (e) => {
      if (e.pointerId === pid) {
        this.dragging = false;
        pid = null;
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.zoom += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Is this pointer for the on-screen controls (fingers and pens, and the mouse when asked)?
  onScreen(e) {
    return this.touchMode && (e.pointerType !== 'mouse' || this.touchMouse);
  }

  setTouchMode(on, mouseToo) {
    this.touchMode = on;
    this.touchMouse = on && !!mouseToo;
    if (!on && this.resetTouch) this.resetTouch();
  }

  // On-screen controls: a floating joystick on the left, camera drag on the right, two fingers
  // on the right pinch to zoom, and big buttons for jump / use / kick / map / nitro.
  // Built on pointer events, so fingers, pens and mice (on some whiteboards) all work.
  attachTouch(root, handlers) {
    const stick = root.querySelector('.joy');
    const knob = root.querySelector('.joy-knob');
    let joyId = null;
    let cx = 0;
    let cy = 0;
    const cams = new Map(); // touch id -> {x, y}
    let pinchDist = 0;
    const R = 55;
    const resetStick = () => {
      stick.style.left = '';
      stick.style.top = '';
      knob.style.transform = '';
      stick.classList.remove('on');
    };
    const releaseStick = () => {
      joyId = null;
      this.joy.x = 0;
      this.joy.y = 0;
      this.joy.active = false;
      resetStick();
    };
    this.resetTouch = () => {
      releaseStick();
      cams.clear();
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.onScreen(e)) return;
      e.preventDefault();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (e.clientX < window.innerWidth * 0.45 && joyId === null) {
        joyId = e.pointerId;
        cx = e.clientX;
        cy = e.clientY;
        stick.style.left = cx - 70 + 'px';
        stick.style.top = cy - 70 + 'px';
        stick.classList.add('on');
        this.joy.active = true;
        this.joy.x = 0;
        this.joy.y = 0;
      } else if (cams.size < 2) {
        cams.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (cams.size === 2) {
          const [a, b] = [...cams.values()];
          pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        }
      }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === joyId) {
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const l = Math.hypot(dx, dy);
        if (l > R) {
          dx = (dx / l) * R;
          dy = (dy / l) * R;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joy.x = dx / R;
        this.joy.y = -dy / R;
      } else if (cams.has(e.pointerId)) {
        const c = cams.get(e.pointerId);
        if (cams.size === 1) {
          this.lookX += (e.clientX - c.x) * 1.4;
          this.lookY += (e.clientY - c.y) * 1.4;
          this.lastLookTime = performance.now() / 1000;
        }
        c.x = e.clientX;
        c.y = e.clientY;
        if (cams.size === 2) {
          const [a, b] = [...cams.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          this.zoom += (pinchDist - d) * 0.03;
          pinchDist = d;
        }
      }
    });
    const onEnd = (e) => {
      if (e.pointerId === joyId) releaseStick();
      else cams.delete(e.pointerId);
    };
    this.canvas.addEventListener('pointerup', onEnd);
    this.canvas.addEventListener('pointercancel', onEnd);
    this.canvas.addEventListener('lostpointercapture', onEnd);
    // Buttons use pointer events, so they work with fingers, pens and mice alike.
    for (const [sel, code] of [['.tb-jump', 'Space'], ['.tb-use', 'KeyE'], ['.tb-kick', 'KeyF']]) {
      const b = root.querySelector(sel);
      if (!b) continue;
      const release = () => {
        this.keys.delete(code);
        b.classList.remove('pressed');
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        this.pressedSet.add(code);
        this.keys.add(code);
        b.classList.add('pressed');
      });
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // Tap buttons (act once on release): map, nitro on/off.
    for (const [sel, name] of [['.tb-map', 'map'], ['.tb-nitro', 'nitro']]) {
      const b = root.querySelector(sel);
      if (!b || !handlers || !handlers[name]) continue;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.add('pressed');
      });
      b.addEventListener('pointerup', () => {
        b.classList.remove('pressed');
        handlers[name]();
      });
      b.addEventListener('pointercancel', () => b.classList.remove('pressed'));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // Pushing the joystick all the way makes Bip run.
  get joyRun() {
    return this.joy.active && Math.hypot(this.joy.x, this.joy.y) > 0.92;
  }

  down(code) {
    return this.enabled && this.keys.has(code);
  }

  pressed(code) {
    if (!this.enabled) return false;
    if (this.pressedSet.has(code)) {
      this.pressedSet.delete(code);
      return true;
    }
    return false;
  }

  // Movement axis from keyboard or joystick: x = right, y = forward.
  axis() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.joy.active) {
      x += this.joy.x;
      y += this.joy.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  endFrame() {
    this.pressedSet.clear();
    this.lookX = 0;
    this.lookY = 0;
    this.zoom = 0;
  }

  clear() {
    this.keys.clear();
    this.pressedSet.clear();
    this.joy.x = 0;
    this.joy.y = 0;
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}
