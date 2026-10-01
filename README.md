# Neura Island / Insula Neura

A 3D adventure game where kids (around age 10) learn how artificial intelligence and machine learning work. You play as **Bip**, a friendly robot whose brain was scrambled by a storm. **Professor Ada**, a hologram teacher, guides you across 13 learning islands. Each island teaches one layer of how AI works. Pass its test to earn a Knowledge Core, light up a ring of the Core Tower, and unlock the bridge to the next island.

Everything is available in **English** and **Romanian**, at **three difficulty levels**.

## Play

**Easiest:** double-click `index.html` (the one at the top of the repository). The whole game is that one file; no server or install is needed. (An internet connection only adds the nicer fonts.)

**Best browser:** Microsoft Edge. It has natural-sounding voices for reading lessons aloud in both English and Romanian (Chrome and Firefox usually only have robotic voices, and often no Romanian one). You can pick the voice in the in-game Menu.

**For development:**

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The development server runs the source in `src/` (its entry is `src/index.html`). `npm run build` bundles everything into the playable `index.html` at the repository root.

Progress is saved automatically in the browser (localStorage), separately for each account.

## Classroom login (Clopotica edition)

Enter one of the 20 assigned accounts, user01 through user20, with its supplied password. Usernames ignore surrounding spaces and letter case; passwords are case-sensitive. Login appears before the 3D game starts, in English or Romanian. Use **Log out / Deconectare** on the title screen or in the game menu to switch accounts.

The current account is remembered in sessionStorage across reloads in the same tab. Progress is stored locally under an account-specific key; it does not sync between devices. The old shared save is left untouched and is not assigned to any account. If browser storage is blocked, you can still play, but progress and login may not survive a reload.

This is a simple offline classroom gate for the existing static GitHub Pages game, **not secure server-side authentication**. Only SHA-256 password digests are included in src/auth.js, but downloaded code and browser storage can be inspected or changed. Do not use this gate to protect sensitive data. Password verification requires Web Crypto (HTTPS, localhost, or the downloaded file in a compatible browser).

After changing the login or account digests, run npm run build and commit the root index.html as well.

## Publish on GitHub Pages

The playable game is the `index.html` at the root of the repository, so GitHub Pages can serve it directly.

1. Create an empty repository on GitHub and push this folder to it (`node_modules/` is already ignored).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose branch **main** and folder **/ (root)**, and save.
3. After a minute the game is live at `https://<your-username>.github.io/<repository-name>/`.

Whenever you change something in `src/`, run `npm run build` before committing so the root `index.html` is up to date. The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

Repository layout:

```
index.html        the playable game (built, self-contained) ← GitHub Pages serves this
.nojekyll         serve files as-is on GitHub Pages
src/              all source code; src/index.html is the development entry
package.json      scripts: npm run dev / npm run build
vite.config.js    builds src/ into the root index.html
```

## Slow, blurry or blank 3D?

The game checks what is drawing the 3D. When the browser draws it without the graphics card (Windows then reports the "Microsoft Basic Render Driver", which draws in software on the processor), the game switches to **Fast** graphics: half resolution, no shadows. It still works, but it looks blurry.

**Older laptops (for example Intel HD Graphics 2000/3000):** browsers block these graphics cards for WebGL 2, so they fall back to software drawing even when the driver is installed. The game also runs on WebGL 1, which these cards can do:

1. In Edge open `edge://flags` (in Chrome: `chrome://flags`).
2. Search for **ANGLE** and set **Choose ANGLE graphics backend** to **D3D11**.
3. Restart the browser.

The game then uses the graphics card and picks **Pretty** graphics by itself. On an HP ProBook 6460b (Intel HD Graphics 3000) this went from half resolution without shadows to about 85% resolution with shadows and smooth edges, at a similar speed. To undo it, set the option back to **Default**. (With D3D11 the browser offers only WebGL 1, so a few other websites that need WebGL 2 may not work.)

On other computers, updating the graphics driver (Intel, AMD or NVIDIA) makes a huge difference. A nearly full hard drive can also make browsers misbehave.

The picture quality never changes by itself during play: the resolution and the graphics setting stay exactly as they started (only the Menu changes them). To keep the motion smooth:

- A device that can't keep 60 frames per second switches to an even **30 fps** (it draws every other screen refresh). That looks much smoother than frames jumping between 20 and 60, and costs no sharpness.
- After every resize the picture is drawn again immediately, so the screen never flashes black (for example when an on-screen keyboard opens on a whiteboard).
- Big screens (interactive whiteboards, 4K monitors) use about 3 million pixels, which is sharp from a few meters away, instead of millions of extra pixels that school graphics chips can't draw.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | W A S D or arrow keys | joystick: touch anywhere on the left half |
| Look around | drag with the mouse, wheel to zoom | drag on the right half, pinch with two fingers to zoom |
| Jump | Space | ⤒ button |
| Run (7.2 m/s) | Shift | push the joystick all the way |
| Nitro on / off (10 m/s) | N (or click 🚀 Nitro, bottom left) | 🚀 button |
| Talk / use terminals, signs, pads | E (or click the prompt) | E button |
| Kick a ball | F | ⚽ button |
| Teleport map | M | 🗺️ button |
| Menu and settings | Esc | ☰ button |

The on-screen controls turn on by themselves on touch screens. **Menu → On-screen controls** can also force them **On** (for interactive whiteboards that act like a mouse: then the mouse or pen drives the joystick too) or **Off**.

## Difficulty levels

| Level | Lessons per station | Experiments | Test |
| --- | --- | --- | --- |
| 🌱 Explorer | 3 essential pages | one required per station (two at the last one), the rest are bonus | 4 questions, 3 to pass |
| 🔬 Scientist | 5 to 6 pages | all Explorer and Scientist experiments | 6 questions, 4 to pass |
| 🚀 Inventor | 7 to 9 pages, including the real math | all experiments, extra missions | 8 harder questions, 6 to pass |

The level can be changed at any time from the menu. Passed stations stay passed.

The test at each station unlocks only after the player has read every lesson page and completed the required experiments for their level. Every answer comes with an explanation. Failing is fine: the game sends the player back to review and lets them retry with a fresh set of questions.

## The 13 stations

| # | Topic | Hands-on experiments | 3D landmark on the island |
| --- | --- | --- | --- |
| 1 | What is AI? | Sort machines into "rules" vs "learning"; write rules for a cat detector (and find out why it's impossible) | Gear rule machine vs glowing learning machine |
| 2 | Data: food for AI | Pixel painter (see the numbers, invert, RGB); label factory (fix wrong labels, watch accuracy rise) | Crates of fruit and a labeling conveyor belt |
| 3 | Features & patterns | Feature explorer: pick chart axes and discover good vs useless features | A 3D feature-space sculpture |
| 4 | Classification (k-nearest neighbors) | Drag a mystery point, change k, see the decision map and outliers | A grid floor with pillars and a golden mystery gem |
| 5 | Training: learning from mistakes | Fit the ice-cream line by hand, then watch gradient descent; the foggy hill (learning rate, overshoot, local minimum, momentum) | **The Loss Valley**: a real bowl where balls roll to the lowest error |
| 6 | The artificial neuron | Neuron lab (weights and bias solve AND / OR / majority); watch a perceptron learn, and fail on XOR | A giant neuron with pulses flowing to the axon |
| 7 | Neural networks & layers | Live neural-network playground with backpropagation (blobs, circle, XOR, spiral) | A layered network sculpture with signals flowing forward |
| 8 | Computer vision | Teach the AI to see: draw shapes, train it, test it; filter lab (convolution, step by step) | Pixel wall of a cat plus its edge-filtered twin |
| 9 | Memorizing vs understanding (overfitting) | The wiggly curve lab: training vs test error, just-right complexity, more data | Two curves over the same dots |
| 10 | Clustering (unsupervised learning) | k-means on a bag of candies, step by step, choosing k, elbow chart | Real kickable balls sitting in three clusters |
| 11 | Learning from rewards (reinforcement learning) | The learning launcher (real projectile physics, with optional air drag); robot maze with Q-learning | **An AI launcher** that learns to hit a floating target by trial and error |
| 12 | Language AI & chatbots | Next word machine (teach it sentences, play with temperature); token chopper | Floating word tiles with next-word probability bars |
| 13 | Fair & safe AI | Safe or not? real-life AI situations; the unfair pet door (fix bias with better data) | A balance of fairness |
| 🏆 | Final Challenge at the Core Tower | One question from every station, then a certificate | The tower's crown lights up |

Also on the island: 30 Data Crystals to collect, each with a fun fact (science, AI history, and Romanian computing pioneers like Grigore Moisil and CIFA-1), plus info signs next to every landmark.

## Island challenges

Besides the experiments in each station's window, every island has a **physical challenge** in the 3D world, solved by moving Bip, pushing and kicking balls, standing on pressure plates and walking patterns. Look for the ⭐ flag and press E to hear the rules (this also puts the pieces back). They are bonus content: the test doesn't depend on them. Solved challenges are counted by the ⭐ counter at the top of the screen and marked on the map.

| # | Challenge | What you do | The idea |
| --- | --- | --- | --- |
| 1 | Tag the machines | Tag 5 objects on pedestals as "learns from data" or "follows rules" | Rules vs learning |
| 2 | Label the fruit | Push apples and oranges into the right circles (a green apple is still an apple) | Labels and datasets |
| 3 | Odd one out | Three rounds: find the ball with a different color, size, then weight (push them to feel it) | Features |
| 4 | Be the mystery point | Walk on the grid; your 3 nearest pillars vote red or blue | k-nearest neighbors, decision boundary |
| 5 | Two valleys | Get one ball to rest at the bottom of the Loss Valley and one in the side dip | Global vs local minimum |
| 6 | Wake the neuron | Stand on pressure plates and push balls onto them until the weighted sum passes 0 | Weights and bias |
| 7 | The XOR puzzle | Two plates feed a network with a hidden layer; find when its lamp lights | Why hidden layers matter |
| 8 | Pixel floor | Walk over tiles to switch pixels on and off and copy a picture | Images are numbers |
| 9 | Trust the pattern | Jump along stepping stones over the sea; three of them are invisible | Generalization |
| 10 | Group them yourself | Push unlabeled balls into unnamed circles so similar ones end up together | Clustering |
| 11 | You are the agent | Adjust a launcher's power with buttons and learn from the reward | Reinforcement learning |
| 12 | Walk a sentence | Step on word pads; brighter pads are likelier next words | Next-word prediction |
| 13 | Balance the data | Push balls onto the empty pan until the scale balances | Fair, balanced data |

## Real physics

The world follows real physics, and signs around the hub explain it:

- Gravity is 9.81 m/s². Bip's jump (5.1 m/s) reaches about 1.3 m, just as v²/2g predicts.
- Bip walks at 4.2 m/s and runs at 7.2 m/s. With nitro, boosters fold out of Bip's back and the top speed becomes 10 m/s (36 km/h, as fast as the world's fastest sprinters). Bip still accelerates and brakes at a real 22 m/s², so at full speed it needs about 2 m to stop.
- Balls have real masses and sizes (beach ball, soccer ball, basketball, bowling ball). A kick gives every ball the same impulse, so lighter balls fly faster (Newton's second law, Δv = J / m).
- Air drag is quadratic (½ρC<sub>d</sub>Av²), so big light balls slow down quickly.
- Buoyancy uses Archimedes' principle for both water and air: the beach ball and soccer ball float at the right depth, and the bowling ball sinks to the seabed.
- Balls roll without slipping, so they accelerate downhill at g·sinθ / (1 + I/mr²), and they keep spinning in the air.
- Bip is metal, so Bip sinks. Walking into deep water sends Bip back to dry land.
- Bip balances on a ball wheel and leans into acceleration like a real self-balancing robot. The wheel turns at ω = v / r.

## Project structure

```
src/index.html          page shell (development entry)
src/main.js             boot
src/game.js             game loop, camera, interactions, panels
src/state.js            save data (localStorage)
src/i18n.js             interface strings (EN / RO)
src/audio.js            synthesized sound effects and read-aloud (Web Speech)
src/engine/             physics, player controller, input
src/world/              islands, terrain, water, sky, bridges, station props, island challenges, Bip and Ada
src/ui/                 HUD, dialogs, station window, quiz, menus, lesson visuals
src/content/            lessons and quizzes for each station (s1.js ... s13.js), story, fun facts
src/experiments/        the 21 interactive experiments, plus a tiny neural network (mlp.js)
```

### Editing content

Each station lives in `src/content/sN.js`:

- `pages`: lesson pages with `level` (1, 2 or 3), `title`, `text` (supports `**bold**` and `- ` bullet lists), an optional `bip` comment and a `visual` (built-in types like `emoji`, `flow`, `vs`, `timeline`, or a custom canvas drawing function).
- `experiments`: `{ id, req, min }`, where `req` is the first level at which it is required and `min` the first level at which it appears.
- `quiz`: multiple choice (`a` = answers, `c` = index of the right one) or true/false (`tf: true`, `c: true/false`), each with a `level` and an explanation in `why`.

Every text field is an `{ en, ro }` pair.

## Tech

Three.js r162 for 3D (the last version that still supports WebGL 1, so the game can use old graphics cards; keep it on 0.162.x), a custom physics engine, plain JavaScript and CSS for the interface, Vite plus `vite-plugin-singlefile` for the one-file build. No images, sounds or models are downloaded: everything is generated in code.
