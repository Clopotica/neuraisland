import * as THREE from 'three';
import { Physics } from './engine/physics.js';
import { Input } from './engine/input.js';
import { Player } from './engine/player.js';
import { buildWorld } from './world/index.js';
import { createRobot } from './world/robot.js';
import { terrainHeight, WATER_Y, stationIslands, hub, local, islandAt, TOP } from './world/layout.js';
import { state, sp, save, bus } from './state.js';
import { t, L } from './i18n.js';
import { sfx, unlockAudio, setAmbience, stopSpeaking } from './audio.js';
import { createHud } from './ui/hud.js';
import { runDialog } from './ui/dialog.js';
import { titleScreen, openMenu, openMap, openSign, openFinal } from './ui/menus.js';
import { openStationPanel } from './ui/station.js';
import { STATION_META, metaById } from './content/meta.js';
import { FACTS } from './content/facts.js';
import { adaTalk, INTRO, stationPassedLines, finalLines } from './content/story.js';
import { CHALLENGES } from './content/challenges.js';

// Find out what draws the 3D. Without a real graphics driver, browsers fall back
// to software rendering (e.g. "Microsoft Basic Render Driver"), which is very slow.
function probeGpu() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false, name: '', software: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return { ok: true, name, software: /swiftshader|basic render|llvmpipe|softpipe|software|warp|offscreen/i.test(name) };
  } catch {
    return { ok: false, name: '', software: false };
  }
}

export class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.ui = document.getElementById('ui');
    this.gpu = probeGpu();
    // Without a graphics card, start in Fast mode. When the card works (for example after
    // switching it on in the browser settings), go back to Pretty, unless the player chose.
    if (!state.qualityChosen) state.quality = this.gpu.software ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: state.quality !== 'low', powerPreference: 'high-performance' });
    // Old graphics cards (like Intel HD 2000/3000) only offer WebGL 1.
    this.webgl2 = this.renderer.capabilities.isWebGL2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.pixelScale = 1;
    this.frameMs = 16;
    this.govTimer = 0;
    this.slowScale = Infinity; // resolution scale that was last too slow
    this.slowAt = -1e9;
    this.lastScaleChange = -1e9;
    this.cap30 = false; // draw every other screen refresh on devices that can't keep 60 fps
    this.slowChecks = 0;
    this.running = false;
    this.contextLost = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);

    this.physics = new Physics();
    this.physics.onBallHit = (v) => {
      if (v > 2.5 && this.mode === 'play') sfx('bounce');
    };
    this.world = buildWorld(this.scene, this.physics, {
      openStation: (id) => this.openStation(id),
      openFinal: () => this.openFinalChallenge(),
      talkAda: (isl) => this.talkToAda(isl),
      openMap: () => this.openMapPanel(),
      readSign: (s) => this.openPanel(() => openSign(this, s)),
      challengeDone: (id) => this.onChallengeDone(id),
      challengeInfo: (id, after) => this.challengeInfo(id, after),
    });
    this.robot = createRobot();
    this.scene.add(this.robot.group);
    this.player = new Player(this.physics, this.robot);
    this.player.onSplash = (p) => {
      sfx('splash');
      this.world.particles.emit({ x: p.x, y: 0.1, z: p.z, count: 50, colors: ['#ffffff', '#bdf3ff', '#7fd8ff'], up: 6, spread: 2.5, size: 0.3 });
      this.hud.toast('💦 ' + t('splash'));
    };
    this.input = new Input(this.canvas);

    this.hud = createHud(this.ui, {
      map: () => this.mode === 'play' && this.openMapPanel(),
      lang: () => this.setLang(state.lang === 'en' ? 'ro' : 'en'),
      menu: () => this.mode === 'play' && this.openMenuPanel(),
      use: () => this.use(),
      nitro: () => this.mode === 'play' && this.toggleNitro(),
    });
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fade';
    this.ui.appendChild(this.fadeEl);

    this.mode = 'title';
    this.camYaw = Math.PI * 0.15;
    this.camPitch = 0.38;
    this.camDist = 7.5;
    this.camPos = new THREE.Vector3(0, 20, 60);
    this.camTarget = new THREE.Vector3();
    this.time = 0;
    this.physAcc = 0;
    this.near = null;
    this.stationPanel = null;
    this.render3D = true;
    this.kickHintShown = false;

    // Touch screens: phones, tablets and interactive whiteboards. Some whiteboards act like a
    // mouse, so the on-screen controls can also be switched on by hand in the Menu.
    this.touchDevice =
      matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.input.attachTouch(this.hud.touch, {
      map: () => this.mode === 'play' && this.openMapPanel(),
      nitro: () => this.mode === 'play' && this.toggleNitro(),
    });
    this.setScreenControls(state.screenControls);

    window.addEventListener('resize', () => {
      this.setBasePixelRatio();
      this.renderer.setPixelRatio(this.basePixelRatio * this.pixelScale);
      this.resize();
    });
    this.watchContext();
    bus.on('novoice', (lang) => {
      if (this.noVoiceShown) return;
      this.noVoiceShown = true;
      this.hud.toast('🔇 ' + t('voiceNoneShort', { lang: lang === 'ro' ? 'română' : 'English' }), null, 6000);
    });
    this.resize();
    this.applyQuality();
    this.setLang(state.lang, true);
    this.world.refreshProgress();
    this.placePlayer();

    const unlock = () => {
      unlockAudio();
      setAmbience(state.sound);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  // Changing the canvas size wipes it (it shows black until the next drawing), so the
  // picture is drawn again right away. `redraw = false` when a frame is drawn next anyway.
  resize(redraw = true) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.world.particles.setScale(h);
    if (redraw && this.running && !this.contextLost) this.renderer.render(this.scene, this.camera);
  }

  // Sharpness is limited by pixels. Big screens (interactive whiteboards, 4K monitors) start
  // around 3 million pixels instead of many millions that no school graphics chip can draw.
  setBasePixelRatio() {
    const high = state.quality !== 'low';
    const dpr = window.devicePixelRatio || 1;
    const cap = this.touchDevice ? 1.3 : 1.75;
    const budget = Math.max(0.5, Math.sqrt(3.2e6 / Math.max(1, window.innerWidth * window.innerHeight)));
    this.basePixelRatio = high ? Math.min(dpr, cap, budget) : this.gpu.software ? 0.5 : Math.min(1, dpr * 0.75, budget);
  }

  // On-screen joystick and buttons: 'auto' (touch screens), 'on' (also for whiteboards that
  // act like a mouse) or 'off'.
  setScreenControls(mode = 'auto') {
    const on = mode === 'on' || (mode !== 'off' && this.touchDevice);
    this.touch = on;
    this.hud.touch.hidden = !on;
    this.hud.layer.classList.toggle('touch-on', on);
    this.input.setTouchMode(on, mode === 'on');
  }

  applyQuality() {
    const high = state.quality !== 'low';
    this.setBasePixelRatio();
    this.renderer.setPixelRatio(this.basePixelRatio * this.pixelScale);
    // Touch devices and older graphics cards (WebGL 1) get a smaller shadow map.
    const shadowSize = this.touchDevice || !this.webgl2 ? 1024 : 2048;
    const sun = this.world.env.sun;
    if (sun.shadow.mapSize.x !== shadowSize) {
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
    if (this.renderer.shadowMap.enabled !== high) {
      this.renderer.shadowMap.enabled = high;
      this.scene.traverse((o) => {
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
      });
    }
    this.world.setLow(!high);
    this.resize();
  }

  // Keep the game smooth on slow computers. Runs only while visible, before the frame is
  // drawn, so a resolution change never shows an empty (black) canvas.
  // 1. A device that can't keep 60 fps draws every other screen refresh: an even 30 fps
  //    looks much smoother than frames jumping between 20 and 60 fps.
  // 2. Then the resolution goes down when even 30 fps is missed, and up when there is room,
  //    but not back to a resolution that was too slow recently, and at most every 3 seconds.
  governFrameRate(rawMs) {
    // The title flyover shows the whole island at once; judge the speed in play only.
    if (this.mode === 'title' || document.visibilityState !== 'visible' || rawMs > 1000) return;
    this.frameMs += (rawMs - this.frameMs) * 0.1;
    this.govTimer += rawMs / 1000;
    if (this.govTimer < 1.5) return;
    this.govTimer = 0;
    if (!this.cap30) {
      this.slowChecks = this.frameMs > 21 ? this.slowChecks + 1 : 0;
      if (this.slowChecks >= 3) {
        this.cap30 = true;
        this.frameMs = 34;
        document.body.classList.add('lowfx');
        return;
      }
    }
    const now = performance.now() / 1000;
    if (now - this.lastScaleChange < 3) return;
    // Never go below 0.4 of a CSS pixel: blurrier than that is worse than a slower frame.
    // Software drawing is limited by the number of objects more than by pixels, so it stops at 0.5.
    const minScale = Math.min(1, (this.gpu.software ? 0.5 : 0.4) / this.basePixelRatio);
    let next = this.pixelScale;
    if (this.cap30 && this.frameMs > 40 && this.pixelScale > minScale) {
      next = Math.max(minScale, this.pixelScale * 0.85);
      this.slowScale = this.pixelScale;
      this.slowAt = now;
    } else if (this.pixelScale < 1) {
      const up = Math.min(1, this.pixelScale * 1.15);
      const room = this.cap30 ? this.frameMs < 35.5 && (up < this.slowScale * 0.98 || now - this.slowAt > 90) : this.frameMs < 20;
      if (room) next = up;
    }
    if (next !== this.pixelScale) {
      this.pixelScale = next;
      this.lastScaleChange = now;
      this.renderer.setPixelRatio(this.basePixelRatio * this.pixelScale);
      this.resize(false);
    } else if (this.cap30 && this.frameMs > 60 && state.quality !== 'low' && !state.qualityChosen) {
      state.quality = 'low';
      save();
      this.applyQuality();
      this.hud.toast('🐢 ' + t('autoFast'), null, 6000);
    }
  }

  // If the graphics driver resets, the 3D view goes blank. Show what happened and recover.
  watchContext() {
    const box = document.createElement('div');
    box.className = 'ctx-lost';
    box.hidden = true;
    this.ui.appendChild(box);
    let timer = 0;
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      box.hidden = false;
      box.textContent = t('ctxLost');
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!this.contextLost) return;
        const b = document.createElement('button');
        b.className = 'btn primary';
        b.textContent = t('ctxReload');
        b.addEventListener('click', () => window.location.reload());
        box.appendChild(document.createElement('br'));
        box.appendChild(b);
      }, 6000);
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      box.hidden = true;
      if (!state.qualityChosen && state.quality !== 'low') {
        state.quality = 'low';
        save();
        this.applyQuality();
      }
    });
  }

  setLang(lang, silent) {
    state.lang = lang;
    document.documentElement.lang = lang;
    save();
    this.hud.refreshLang(lang);
    this.world.refreshLang();
    this.updateGoal();
    if (this.stationPanel) this.stationPanel.refresh();
    if (!silent) sfx('click');
  }

  refreshAll() {
    this.updateGoal();
    if (this.stationPanel) this.stationPanel.refresh();
  }

  placePlayer() {
    if (state.pos && state.introDone) {
      const { x, z } = state.pos;
      this.player.teleport(x, terrainHeight(x, z) + 0.5, z, state.pos.yaw);
    } else {
      this.player.teleport(0, TOP + 0.5, 13.5, Math.PI);
    }
    this.camYaw = this.player.yaw + Math.PI;
  }

  async start() {
    // Build every shader now, behind the loading screen, instead of freezing mid-game.
    const loadingText = document.querySelector('#loading p');
    if (loadingText) loadingText.textContent = t('loadingBuild');
    this.camera.position.set(0, 20, 42);
    this.camera.lookAt(0, 12, 0);
    try {
      await Promise.race([this.renderer.compileAsync(this.scene, this.camera), new Promise((r) => setTimeout(r, 15000))]);
    } catch (err) {
      console.warn(err);
    }
    let last = performance.now();
    this.running = true;
    const loop = (now) => {
      requestAnimationFrame(loop);
      // Even pacing on slow devices: skip every other screen refresh (see governFrameRate).
      if (this.cap30 && now - last < 1000 / 30 - 4) return;
      const raw = now - last;
      const dt = Math.min(0.05, raw / 1000);
      last = now;
      try {
        if (this.render3D) this.governFrameRate(raw);
        this.tick(dt);
      } catch (err) {
        if (!this.loggedError) {
          console.error(err);
          this.hud.toast('⚠️ ' + t('errorToast'), String(err && err.message ? err.message : err), 12000);
        }
        this.loggedError = true;
        this.input.endFrame();
      }
    };
    requestAnimationFrame(loop);
    document.getElementById('loading')?.classList.add('gone');
    setTimeout(() => document.getElementById('loading')?.remove(), 600);

    this.hud.show(false);
    const res = await titleScreen(this);
    unlockAudio();
    this.hud.show(true);
    // Start judging the frame rate fresh, after a short settling time.
    this.frameMs = 20;
    this.govTimer = -2;
    this.slowScale = Infinity;
    this.slowChecks = 0;
    if (this.gpu.software && !state.qualityChosen) this.hud.toast('🐢 ' + t(/Windows/.test(navigator.userAgent) ? 'gpuSlow' : 'gpuSlowOther'), null, 10000);
    if (this.touch && window.innerHeight > window.innerWidth) this.hud.toast('📱 ' + t('rotateHint'), null, 7000);
    this.updateGoal();
    if (res.fresh || !state.introDone) {
      this.placePlayer();
      this.mode = 'cutscene';
      this.camYaw = this.player.yaw + Math.PI;
      await this.dialog(INTRO);
      state.introDone = true;
      save();
      this.world.refreshProgress();
      this.updateGoal();
      this.hud.toast('🎯 ' + t('goal'), L(this.goalText));
    }
    this.mode = 'play';
    this.canvas.focus();
  }

  // ---------- panels ----------
  openPanel(fn) {
    if (this.mode !== 'play') return null;
    this.mode = 'panel';
    this.input.clear();
    this.hud.setPrompt(null);
    this.render3D = false;
    this.renderer.render(this.scene, this.camera);
    return fn();
  }

  closePanel() {
    this.stationPanel = null;
    this.mode = 'play';
    this.render3D = true;
    this.input.clear();
    this.updateGoal();
    this.canvas.focus();
  }

  openStation(id) {
    if (!this.world.isUnlocked(id)) {
      const i = STATION_META.findIndex((m) => m.id === id);
      sfx('bad');
      this.hud.toast('🔒 ' + t('promptLocked', { n: i + 1 }));
      return;
    }
    this.openPanel(() => {
      this.stationPanel = openStationPanel(this, id);
    });
  }

  openMenuPanel() {
    this.openPanel(() => openMenu(this));
  }

  openMapPanel() {
    this.openPanel(() => openMap(this));
  }

  openFinalChallenge() {
    if (this.world.passedCount() < 13) {
      sfx('bad');
      this.hud.toast('🔒 ' + t('promptFinalLocked'));
      return;
    }
    this.openPanel(() => openFinal(this));
  }

  async dialog(lines) {
    const prevMode = this.mode;
    const wasPanel = prevMode === 'panel';
    if (!wasPanel) {
      this.mode = 'cutscene';
      this.input.clear();
      this.hud.setPrompt(null);
    }
    await runDialog(this.ui, lines, {
      onLine: (ln) => {
        if (ln.who === 'bip') this.robot.talk(1.6);
        else this.world.ada.talk(1.6);
      },
    });
    if (!wasPanel) this.mode = prevMode === 'cutscene' ? 'cutscene' : 'play';
  }

  async talkToAda(isl) {
    if (this.mode !== 'play') return;
    const lines = adaTalk(this, isl);
    this.world.ada.wave(1.5);
    await this.dialog(lines);
    this.mode = 'play';
  }

  robotHappy() {
    this.robot.setHappy(2.5);
  }

  // ---------- island challenges ----------
  async challengeInfo(id, after) {
    if (this.mode !== 'play') return;
    await this.dialog(CHALLENGES[id].intro);
    this.mode = 'play';
    if (after) after();
  }

  onChallengeDone(id) {
    state.field = state.field || {};
    if (state.field[id]) return;
    state.field[id] = true;
    save();
    sfx('win');
    this.robot.setHappy(4);
    const p = this.player.pos;
    this.world.particles.emit({ x: p.x, y: p.y + 1.5, z: p.z, count: 90, colors: ['#ffd23f', '#ff6b3d', '#43b05c', '#2a9df4', '#ffffff'], up: 6, spread: 3, size: 0.25 });
    this.hud.toast('⭐ ' + t('challengeDoneToast'), L(CHALLENGES[id].title), 5000);
    this.updateGoal();
    if (this.mode === 'play') setTimeout(() => this.mode === 'play' && this.dialog([{ who: 'ada', text: CHALLENGES[id].outro }]), 700);
  }

  async onStationPassed(id) {
    const meta = metaById(id);
    this.world.buildBridgeFor(id);
    this.world.refreshProgress();
    this.robot.setHappy(4);
    const i = meta.num - 1;
    const ty = this.world.tower.ringWorldY(i);
    this.world.particles.emit({ x: this.player.pos.x, y: this.player.pos.y + 1.5, z: this.player.pos.z, count: 80, colors: [meta.color, '#ffd23f', '#ffffff'], up: 6, spread: 3, size: 0.25 });
    this.world.particles.emit({ x: 0, y: ty, z: 0, count: 90, colors: [meta.color, '#ffffff'], up: 3, spread: 5, size: 0.4, gravity: 0.2 });
    this.hud.toast('💎 ' + t('coreEarned', { n: meta.num }), t('bridgeBuilt'), 4200);
    this.updateGoal();
    await this.dialog(stationPassedLines(meta));
    this.updateGoal();
  }

  async onFinalPassed() {
    this.world.refreshProgress();
    this.robot.setHappy(8);
    for (let k = 0; k < 6; k++) {
      setTimeout(() => {
        this.world.particles.emit({ x: (Math.random() - 0.5) * 8, y: 30, z: (Math.random() - 0.5) * 8, count: 120, colors: ['#ffd23f', '#ff6b3d', '#43b05c', '#2a9df4', '#b44dff', '#ff4d9d'], up: 8, spread: 10, size: 0.6, gravity: 0.35, life: 2.5 });
        sfx('pop');
      }, k * 500);
    }
    this.updateGoal();
  }

  finalDialog() {
    setTimeout(() => this.mode === 'play' && this.dialog(finalLines()), 600);
  }

  teleportTo(id) {
    let pad;
    if (id === 'hub') pad = this.world.pads.find((p) => p.id === 'hub');
    else pad = this.world.pads.find((p) => p.id === id);
    if (!pad) return;
    sfx('whoosh');
    this.fadeEl.classList.add('on');
    setTimeout(() => {
      const isl = islandAt(pad.x, pad.z);
      const cx = isl ? isl.x : 0;
      const cz = isl ? isl.z : 0;
      const yaw = Math.atan2(cx - pad.x, cz - pad.z);
      const x = pad.x + Math.sin(yaw) * 1.8;
      const z = pad.z + Math.cos(yaw) * 1.8;
      this.player.teleport(x, terrainHeight(x, z) + 0.3, z, yaw);
      this.camYaw = yaw + Math.PI;
      this.snapCamera = true;
      this.fadeEl.classList.remove('on');
      this.world.particles.emit({ x, y: this.player.pos.y + 1, z, count: 40, colors: ['#6fe7ff', '#ffffff'], up: 3, spread: 2, size: 0.2 });
      this.hud.toast('✨ ' + t('teleported'));
    }, 380);
  }

  use() {
    if (this.mode !== 'play' || !this.near) return;
    sfx('click');
    this.near.action();
  }

  // Nitro: Bip's top speed goes from 4.2 m/s (walk) or 7.2 m/s (run) to 10 m/s.
  toggleNitro(on = !this.player.nitro) {
    this.player.nitro = on;
    this.robot.setNitro(on);
    this.hud.setNitro(on);
    sfx(on ? 'nitro' : 'nitroOff');
    if (on && !this.nitroTipShown) {
      this.nitroTipShown = true;
      this.hud.toast('🚀 ' + t('nitroOn'), t(this.touch ? 'nitroFactTouch' : 'nitroFact'), 7000);
    } else this.hud.toast(on ? '🚀 ' + t('nitroOn') : '🐢 ' + t('nitroOff'), null, 1600);
  }

  kick() {
    const p = this.player;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    let best = null;
    let bestD = 1.9;
    for (const b of this.physics.balls) {
      const dx = b.pos.x - p.pos.x;
      const dz = b.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz) - b.r;
      if (d > bestD || Math.abs(b.pos.y - (p.pos.y + 0.3)) > 1.4) continue;
      if ((dx * fx + dz * fz) / Math.max(0.01, Math.hypot(dx, dz)) < 0.2) continue;
      best = b;
      bestD = d;
    }
    if (!best) return;
    const dx = best.pos.x - p.pos.x;
    const dz = best.pos.z - p.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    // Same impulse (3 N*s) for every ball: dv = J / m.
    best.kick((dx / l) * 0.6 + fx * 0.4, (dz / l) * 0.6 + fz * 0.4, 3, 0.45);
    sfx('kick');
    this.robot.wave(0.4);
  }

  // ---------- goal & beacon ----------
  updateGoal() {
    const w = this.world;
    const passed = STATION_META.map((m) => sp(m.id).passed);
    this.hud.setCounts(passed, state.crystals.length, w.crystals.total);
    this.hud.setStars(Object.keys(state.field || {}).length, STATION_META.length);
    if (!state.introDone) {
      this.goalText = t('goalIntro');
      this.hud.setGoal(t('goal'), t('goalIntro'), '!', '#7b5cff');
      w.beacon.hide();
      return;
    }
    if (state.finalPassed) {
      this.goalText = t('goalDone');
      this.hud.setGoal(t('goal'), t('goalDone'), '★', '#7b5cff');
      w.beacon.hide();
      return;
    }
    const nextIdx = passed.indexOf(false);
    if (nextIdx === -1) {
      this.goalText = t('goalFinal');
      this.hud.setGoal(t('goal'), t('goalFinal'), '🏆', '#7b5cff');
      w.beacon.set(0, terrainHeight(0, 6.9), 6.9, TOP + 3.4);
      return;
    }
    const meta = STATION_META[nextIdx];
    const k = w.kiosks[nextIdx];
    const here = islandAt(this.player.pos.x, this.player.pos.z) === stationIslands[nextIdx];
    this.goalText = here ? t('goalAtStation', { n: meta.num }) : t('goalStation', { n: meta.num, title: L(meta.title) });
    this.hud.setGoal(t('goal'), this.goalText, String(meta.num), meta.color);
    w.beacon.set(k.x, k.y, k.z, k.y + 3.3);
  }

  // ---------- frame ----------
  tick(dt) {
    this.time += dt;
    const p = this.player;
    if (this.mode === 'play' || this.mode === 'cutscene') {
      if (this.mode === 'play') {
        if (this.input.pressed('KeyE')) this.use();
        if (this.input.pressed('KeyF')) this.kick();
        if (this.input.pressed('KeyN')) this.toggleNitro();
        if (this.input.pressed('KeyM')) this.openMapPanel();
        if (this.input.pressed('Escape')) this.openMenuPanel();
      }
      p.frozen = this.mode !== 'play';
      const res = p.update(dt, this.input, this.camYaw);
      // Fixed-step physics for balls.
      this.physAcc += dt;
      const h = 1 / 120;
      let n = 0;
      while (this.physAcc >= h && n < 8) {
        this.physics.step(h, p);
        this.physAcc -= h;
        n++;
      }
      if (n === 8) this.physAcc = 0;
      for (const b of this.physics.balls) b.syncMesh(h * n);
      this.updateCamera(dt);
      if (p.nitro && this.render3D) this.nitroSparks(dt, res.speed || 0);
      if (this.mode === 'play') {
        this.updateInteractions();
        this.checkCrystals();
        this.hud.setReadout(res.speed || 0, Math.max(0, p.pos.y - WATER_Y));
        this.saveTimer = (this.saveTimer || 0) - dt;
        if (this.saveTimer <= 0) {
          this.saveTimer = 3;
          state.pos = { x: p.pos.x, z: p.pos.z, yaw: p.yaw };
          save();
          const isl = islandAt(p.pos.x, p.pos.z);
          if (isl !== this.lastIsland) {
            this.lastIsland = isl;
            this.updateGoal();
          }
        }
      }
    } else if (this.mode === 'title') {
      const a = this.time * 0.06;
      this.camera.position.set(Math.sin(a) * 42, 18 + Math.sin(this.time * 0.2) * 3, Math.cos(a) * 42);
      this.camera.lookAt(0, 12, 0);
      this.robot.update(dt, { speed: 0, onGround: true });
    }
    if (this.render3D) {
      this.world.update(dt, p);
      if (!this.contextLost) this.renderer.render(this.scene, this.camera);
    }
    this.input.endFrame();
  }

  // A few sparks from the boosters while Bip zooms along.
  nitroSparks(dt, speed) {
    this.sparkTimer = (this.sparkTimer || 0) - dt;
    if (speed < 3 || this.sparkTimer > 0) return;
    this.sparkTimer = 0.05;
    const p = this.player;
    const bx = p.pos.x - Math.sin(p.yaw) * 0.6;
    const bz = p.pos.z - Math.cos(p.yaw) * 0.6;
    this.world.particles.emit({ x: bx, y: p.pos.y + 0.55, z: bz, count: 2, colors: ['#ff9a2e', '#ffd23f', '#fff1b8'], up: 0.8, spread: 0.4, size: 0.12, life: 0.35 });
  }

  updateCamera(dt) {
    const inp = this.input;
    this.camYaw -= inp.lookX * 0.0055;
    this.camPitch = Math.max(-0.1, Math.min(1.25, this.camPitch + inp.lookY * 0.0045));
    this.camDist = Math.max(3.2, Math.min(16, this.camDist + inp.zoom * 0.9));
    const p = this.player;
    const moving = Math.hypot(p.vel.x, p.vel.z) > 1;
    // Gently swing the camera behind Bip when the player isn't steering it.
    if (moving && performance.now() / 1000 - inp.lastLookTime > 1.2 && !inp.dragging) {
      const want = p.yaw + Math.PI;
      let d = want - this.camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const back = Math.abs(d) > 2.6; // walking toward the camera: don't spin
      if (!back) this.camYaw += d * Math.min(1, dt * 1.4);
    }
    this.camTarget.set(p.pos.x, p.pos.y + 1.35, p.pos.z);
    const cp = Math.cos(this.camPitch);
    const want = new THREE.Vector3(
      this.camTarget.x + Math.sin(this.camYaw) * cp * this.camDist,
      this.camTarget.y + Math.sin(this.camPitch) * this.camDist,
      this.camTarget.z + Math.cos(this.camYaw) * cp * this.camDist,
    );
    const ground = Math.max(terrainHeight(want.x, want.z), WATER_Y) + 0.6;
    if (want.y < ground) want.y = ground;
    if (this.snapCamera || this.mode === 'cutscene' && !this.camInit) {
      this.camPos.copy(want);
      this.snapCamera = false;
      this.camInit = true;
    } else this.camPos.lerp(want, 1 - Math.exp(-dt * 10));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    // Widen the view a little above running speed, for the feeling of zooming along.
    const fov = 60 + Math.max(0, Math.hypot(p.vel.x, p.vel.z) - 7.2) * 2.5;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }

  updateInteractions() {
    const p = this.player.pos;
    let best = null;
    let bestD = Infinity;
    for (const it of this.world.interactables) {
      if (!it.enabled()) continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < it.r && d < bestD && Math.abs((it.y ?? p.y) - p.y) < 2.6) {
        best = it;
        bestD = d;
      }
    }
    if (best !== this.near) {
      this.near = best;
      if (best) sfx('hover');
    }
    this.hud.setPrompt(best ? best.label() : null, this.touch);
    // A one-time hint about kicking.
    if (!this.kickHintShown) {
      for (const b of this.physics.balls) {
        if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 2.5) {
          this.kickHintShown = true;
          this.hud.toast('⚽ ' + t('kickHint'), null, 4000);
          break;
        }
      }
    }
  }

  checkCrystals() {
    const p = this.player.pos;
    const cr = this.world.crystals;
    for (const c of cr.items) {
      if (c.taken) continue;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 1.3 && Math.abs(c.y - (p.y + 0.8)) < 1.6) {
        c.taken = true;
        c.mesh.visible = false;
        state.crystals.push(c.i);
        save();
        sfx('pop');
        this.world.particles.emit({ x: c.x, y: c.y, z: c.z, count: 40, colors: ['#7ff6ff', '#ffffff', '#b388ff'], up: 4, spread: 2, size: 0.22 });
        const fact = FACTS[c.i % FACTS.length];
        this.hud.toast('💎 ' + t('crystalFound', { a: state.crystals.length, b: cr.total }), L(fact), 7000);
        this.updateGoal();
        this.robot.setHappy(1.5);
      }
    }
  }
}

void hub;
void local;
void stopSpeaking;
