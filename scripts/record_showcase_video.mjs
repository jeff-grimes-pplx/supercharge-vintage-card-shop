import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const VIDEO_DIR = '/home/user/workspace/supercharge-card-shop/video';
const RAW_DIR = path.join(VIDEO_DIR, 'raw_webm');
fs.mkdirSync(RAW_DIR, { recursive: true });

const manifest = JSON.parse(
  fs.readFileSync(path.join(VIDEO_DIR, 'scenes.json'), 'utf8')
);

(async () => {
  console.log('Launching Chromium for 1920x1080 real-time WebGL2 recording...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-accelerated-2d-canvas'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: RAW_DIR,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Put up a solid #FF00FF curtain immediately on navigation so we can trim exact warmup frames
  await page.addInitScript(() => {
    window.__installWarmupCurtain = () => {
      if (document.getElementById('warmup-curtain')) return;
      const c = document.createElement('div');
      c.id = 'warmup-curtain';
      c.style.cssText =
        'position:fixed;inset:0;background:#ff00ff;z-index:2147483647;pointer-events:none;';
      document.documentElement.appendChild(c);
    };
    document.addEventListener('DOMContentLoaded', window.__installWarmupCurtain);
  });

  await page.goto('http://127.0.0.1:8765', { waitUntil: 'networkidle' });

  console.log('Pre-warming all 6 pack textures and 72 collector card canvases...');
  await page.evaluate(async scenesData => {
    window.__installWarmupCurtain();

    const app = window.SUPERCHARGE_APP;
    const stage = app.getThreeStage();
    const forge = stage.forge;
    const cat = window.SUPERCHARGE_CATALOG;

    await forge.preloadAll(cat);
    for (const p of cat.packs) {
      await forge.renderPackTexture(p);
    }
    for (const c of cat.cards) {
      await forge.renderCardFrontTexture(c);
    }
    forge.renderCardBackTexture();

    // Ensure Pack 01 is freshly loaded on the counter with pre-warmed texture
    await app.selectBoosterPack('wall-street-alpha', true);

    // Inject showcase CSS:
    // 1. Lift .stage-bottom-hud slightly so the bottom closed-caption pill never overlaps action buttons or pulled card pills
    // 2. Smooth camera zoom transitions on .shop-main and .modal-card-dialog
    // 3. Opaque high-contrast bottom closed-caption pill + brass pointer cursor
    const style = document.createElement('style');
    style.textContent = `
      .shop-main, .modal-card-dialog {
        transform-origin: 50% 44%;
        transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .stage-bottom-hud {
        bottom: 90px !important;
      }
      #shop-toast {
        bottom: 96px !important;
      }
      #audit-caption-wrap {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 16px;
        display: flex;
        justify-content: center;
        pointer-events: none;
        z-index: 999990;
      }
      #audit-caption-pill {
        max-width: 1280px;
        padding: 11px 28px;
        background: rgba(8, 12, 11, 0.94);
        border: 1.5px solid rgba(212, 175, 55, 0.55);
        border-radius: 14px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.88);
        color: #faf5ea;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 21px;
        font-weight: 600;
        line-height: 1.35;
        letter-spacing: 0.01em;
        text-align: center;
      }
      #audit-cursor {
        position: fixed;
        left: 960px;
        top: 540px;
        width: 26px;
        height: 26px;
        margin-left: -13px;
        margin-top: -13px;
        border-radius: 50%;
        background: rgba(229, 184, 75, 0.28);
        border: 2.5px solid #fce08b;
        box-shadow: 0 0 18px rgba(229, 184, 75, 0.85), inset 0 0 6px rgba(255, 255, 255, 0.8);
        pointer-events: none;
        z-index: 999995;
        transition: transform 0.14s ease;
      }
      #audit-cursor::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 6px;
        height: 6px;
        margin-left: -3px;
        margin-top: -3px;
        border-radius: 50%;
        background: #ffffff;
      }
      #audit-cursor.clicking {
        transform: scale(0.72);
        background: rgba(63, 224, 208, 0.55);
        border-color: #8efcf1;
      }
    `;
    document.head.appendChild(style);

    const capWrap = document.createElement('div');
    capWrap.id = 'audit-caption-wrap';
    const capPill = document.createElement('div');
    capPill.id = 'audit-caption-pill';
    capPill.textContent = scenesData.scenes[0].narration;
    capWrap.appendChild(capPill);
    document.body.appendChild(capWrap);

    const cursor = document.createElement('div');
    cursor.id = 'audit-cursor';
    document.body.appendChild(cursor);

    window.__SCENES_DATA = scenesData;
  }, manifest);

  // Brief settle before lifting the #FF00FF curtain
  await page.waitForTimeout(800);

  console.log(
    `Starting 16-scene choreography (${manifest.total_duration}s)...`
  );

  await page.evaluate(async () => {
    const scenesData = window.__SCENES_DATA;
    const scenes = scenesData.scenes;
    const totalDur = scenesData.total_duration;
    const app = window.SUPERCHARGE_APP;
    const stage = app.getThreeStage();
    const shopMain = document.querySelector('.shop-main');
    const modalDialog = document.querySelector('.modal-card-dialog');
    const capPill = document.getElementById('audit-caption-pill');
    const cursor = document.getElementById('audit-cursor');
    const curtain = document.getElementById('warmup-curtain');

    // Remove the magenta warmup curtain: Frame 0 of our film starts NOW!
    if (curtain) curtain.remove();
    const t0 = performance.now();

    const triggered = new Set();
    const once = (key, fn) => {
      if (triggered.has(key)) return;
      triggered.add(key);
      cursor.classList.add('clicking');
      setTimeout(() => cursor.classList.remove('clicking'), 220);
      fn();
    };

    const movePointer = (x, y) => {
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: x,
          clientY: y,
          bubbles: true
        })
      );
      const modalHolder = document.getElementById('modal-3d-card-holder');
      if (
        modalHolder &&
        document.getElementById('card-inspector-modal')?.classList.contains('open')
      ) {
        modalHolder.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX: x,
            clientY: y,
            bubbles: true
          })
        );
      }
    };

    const setCameraZoom = (scale, originX = 50, originY = 44, zoomModal = false) => {
      if (shopMain) {
        shopMain.style.transformOrigin = `${originX}% ${originY}%`;
        shopMain.style.transform = !zoomModal && scale !== 1 ? `scale(${scale})` : 'scale(1)';
      }
      if (modalDialog) {
        modalDialog.style.transformOrigin = '50% 48%';
        modalDialog.style.transform = zoomModal && scale !== 1 ? `scale(${scale})` : 'scale(1)';
      }
    };

    await new Promise(resolve => {
      function tick() {
        const elapsed = (performance.now() - t0) / 1000;
        if (elapsed >= totalDur) {
          resolve();
          return;
        }

        let scIdx = scenes.findIndex(
          s => elapsed >= s.start_time && elapsed < s.end_time
        );
        if (scIdx === -1) scIdx = scenes.length - 1;
        const sc = scenes[scIdx];
        const u = Math.max(
          0,
          Math.min(1, (elapsed - sc.start_time) / sc.scene_duration)
        );
        const localT = elapsed - sc.start_time;

        if (capPill.textContent !== sc.narration) {
          capPill.textContent = sc.narration;
        }

        switch (sc.id) {
          case 's01': {
            // 1.0x wide establishing shot: floating Wall Street & Alpha pack tilting in light
            setCameraZoom(1.0, 50, 45);
            const px = 960 + Math.sin(localT * 1.35) * 190;
            const py = 450 + Math.cos(localT * 0.95) * 125;
            movePointer(px, py);
            break;
          }
          case 's02': {
            // 1.0x wide: inspect left dispenser briefly, then trace top foil crimp seam (SEAM 0% -> 84%)
            setCameraZoom(1.0, 50, 45);
            if (u < 0.35) {
              const du = u / 0.35;
              movePointer(165, 210 + du * 280);
            } else {
              const seamU = (u - 0.35) / 0.65;
              const px = 815 + seamU * 290;
              const py = 268 + Math.sin(seamU * Math.PI * 3) * 6;
              movePointer(px, py);
              const pct = Math.min(0.84, seamU * 0.84);
              stage.ripProgress = pct;
              stage.packUniformsMain.uRipProgress.value = pct;
              stage.packUniformsStrip.uRipProgress.value = pct;
              const seamEl = document.getElementById('hud-seam-pct');
              if (seamEl) seamEl.textContent = `SEAM ${Math.round(pct * 100)}%`;
            }
            break;
          }
          case 's03': {
            // 1.0x wide: complete seam slice at localT=1.15s -> rip pack & fan out 5 holographic cards
            setCameraZoom(1.0, 50, 46);
            if (localT < 1.15) {
              const p = localT / 1.15;
              movePointer(980 + p * 140, 268);
            } else {
              once('rip_s03', () => {
                app.ripActivePack();
              });
              const sweep = (localT - 1.15) / (sc.scene_duration - 1.15);
              movePointer(
                640 + Math.sin(sweep * Math.PI * 2) * 320 + sweep * 260,
                465 + Math.cos(sweep * Math.PI * 3) * 60
              );
            }
            break;
          }
          case 's04': {
            // 1.16x gentle medium framing on the 5-card 3D holographic fan
            setCameraZoom(1.16, 50, 44);
            const cardIdx = Math.min(4, Math.floor(u * 5));
            const cardXs = [580, 770, 960, 1150, 1340];
            const targetX = cardXs[cardIdx] + Math.sin(localT * 4.2) * 38;
            const targetY = 460 + Math.cos(localT * 3.6) * 42;
            movePointer(targetX, targetY);
            once(`s04_focus_${cardIdx}`, () => {
              stage.hoveredCardIdx = cardIdx;
              stage.focusPulledCard(cardIdx);
              const chips = document.querySelectorAll('#pulled-cards-tray button');
              if (chips[cardIdx]) chips[cardIdx].click();
            });
            break;
          }
          case 's05': {
            // 1.0x wide: click Finance Core Engine -> open 3D Holographic Card Inspector Modal
            setCameraZoom(1.0, 50, 48);
            if (localT < 0.85) {
              movePointer(580, 465);
            } else {
              once('s05_open_modal', () => {
                app.openCardInspectorById('finance');
              });
              const mx = 665 + Math.sin(localT * 1.9) * 95;
              const my = 485 + Math.cos(localT * 1.5) * 120;
              movePointer(mx, my);
            }
            break;
          }
          case 's06': {
            // 1.12x gentle medium on modal: flip card front->back at 1.2s, hold back through midpoint, flip back->front at 6.4s, close at end
            setCameraZoom(1.12, 50, 50, true);
            if (localT >= 1.2) {
              once('s06_flip_back', () => {
                document.getElementById('modal-btn-flip')?.click();
              });
            }
            if (localT >= 6.4) {
              once('s06_flip_front', () => {
                document.getElementById('modal-btn-flip')?.click();
              });
            }
            if (localT < 6.4) {
              movePointer(
                665 + Math.sin(localT * 1.8) * 80,
                500 + Math.cos(localT * 1.4) * 90
              );
            } else if (localT < sc.scene_duration - 0.6) {
              movePointer(1040 + Math.sin(localT * 2.0) * 90, 725);
            } else {
              once('s06_close_modal', () => {
                setCameraZoom(1.0, 50, 45, false);
                app.closeCardInspector();
              });
            }
            break;
          }
          case 's07': {
            // 1.0x wide: Pack 02 Auteur & 3D Studio Pack -> select & rip at localT=1.25s
            setCameraZoom(1.0, 50, 46);
            once('s07_select', () => {
              app.closeCardInspector();
              app.selectBoosterPack('auteur-3d-studio', true);
            });
            if (localT < 1.25) {
              movePointer(160 + (localT / 1.25) * 800, 250 + (localT / 1.25) * 160);
            } else {
              once('s07_rip', () => {
                app.ripActivePack();
              });
              const idx = Math.min(4, Math.floor(((localT - 1.25) / (sc.scene_duration - 1.25)) * 5));
              const xs = [580, 770, 960, 1150, 1340];
              movePointer(xs[idx] + Math.sin(localT * 3.5) * 35, 465 + Math.cos(localT * 3.0) * 35);
              once(`s07_card_${idx}`, () => {
                stage.hoveredCardIdx = idx;
                const chips = document.querySelectorAll('#pulled-cards-tray button');
                if (chips[idx]) chips[idx].click();
              });
            }
            break;
          }
          case 's08': {
            // 1.0x wide: Pack 03 Design Craft & Web Atelier Pack -> select & rip at localT=1.25s
            setCameraZoom(1.0, 50, 46);
            once('s08_select', () => {
              app.selectBoosterPack('design-craft-atelier', true);
            });
            if (localT < 1.25) {
              movePointer(160 + (localT / 1.25) * 800, 345 + (localT / 1.25) * 80);
            } else {
              once('s08_rip', () => {
                app.ripActivePack();
              });
              const idx = Math.min(4, Math.floor(((localT - 1.25) / (sc.scene_duration - 1.25)) * 5));
              const xs = [580, 770, 960, 1150, 1340];
              movePointer(xs[idx] + Math.sin(localT * 3.5) * 35, 465 + Math.cos(localT * 3.0) * 35);
              once(`s08_card_${idx}`, () => {
                stage.hoveredCardIdx = idx;
                const chips = document.querySelectorAll('#pulled-cards-tray button');
                if (chips[idx]) chips[idx].click();
              });
            }
            break;
          }
          case 's09': {
            // 1.0x wide: Pack 04 Systems, Silicon & Red-Team Pack -> select & rip at localT=1.25s
            setCameraZoom(1.0, 50, 46);
            once('s09_select', () => {
              app.selectBoosterPack('systems-silicon-redteam', true);
            });
            if (localT < 1.25) {
              movePointer(160 + (localT / 1.25) * 800, 440);
            } else {
              once('s09_rip', () => {
                app.ripActivePack();
              });
              const idx = Math.min(4, Math.floor(((localT - 1.25) / (sc.scene_duration - 1.25)) * 5));
              const xs = [580, 770, 960, 1150, 1340];
              movePointer(xs[idx] + Math.sin(localT * 3.5) * 35, 465 + Math.cos(localT * 3.0) * 35);
              once(`s09_card_${idx}`, () => {
                stage.hoveredCardIdx = idx;
                const chips = document.querySelectorAll('#pulled-cards-tray button');
                if (chips[idx]) chips[idx].click();
              });
            }
            break;
          }
          case 's10': {
            // 1.0x wide: Pack 05 Deal Desk, Legal & Enterprise GTM Pack -> select & rip at localT=1.25s
            setCameraZoom(1.0, 50, 46);
            once('s10_select', () => {
              app.selectBoosterPack('deal-desk-legal-gtm', true);
            });
            if (localT < 1.25) {
              movePointer(160 + (localT / 1.25) * 800, 530 - (localT / 1.25) * 70);
            } else {
              once('s10_rip', () => {
                app.ripActivePack();
              });
              const idx = Math.min(4, Math.floor(((localT - 1.25) / (sc.scene_duration - 1.25)) * 5));
              const xs = [580, 770, 960, 1150, 1340];
              movePointer(xs[idx] + Math.sin(localT * 3.5) * 35, 465 + Math.cos(localT * 3.0) * 35);
              once(`s10_card_${idx}`, () => {
                stage.hoveredCardIdx = idx;
                const chips = document.querySelectorAll('#pulled-cards-tray button');
                if (chips[idx]) chips[idx].click();
              });
            }
            break;
          }
          case 's11': {
            // 1.0x wide: Room 02 Illuminated Glass Display Cases + smooth cabinet scroll
            setCameraZoom(1.0, 50, 40);
            once('s11_view', () => {
              app.switchView('cases');
            });
            const casesScroll = document.querySelector('#view-cases .scroll-view-container');
            if (casesScroll) {
              casesScroll.scrollTop = Math.sin(u * Math.PI * 0.88) * 620;
            }
            movePointer(
              480 + Math.sin(localT * 1.7) * 380,
              460 + Math.cos(localT * 1.3) * 110
            );
            break;
          }
          case 's12': {
            // 1.15x medium framing on Display Cases rarity filters
            setCameraZoom(1.15, 50, 26);
            const casesScroll = document.querySelector('#view-cases .scroll-view-container');
            if (casesScroll) casesScroll.scrollTop = 0;
            if (localT >= 1.2) {
              once('s12_mythic', () => {
                document.querySelector('#cases-rarity-filters [data-rarity="mythic-holo"]')?.click();
              });
            }
            if (localT >= 3.8) {
              once('s12_gold', () => {
                document.querySelector('#cases-rarity-filters [data-rarity="gold-connector"]')?.click();
              });
            }
            if (localT >= 7.6) {
              once('s12_all', () => {
                document.querySelector('#cases-rarity-filters [data-rarity="all"]')?.click();
              });
            }
            movePointer(
              1180 + Math.sin(localT * 1.6) * 220,
              210 + Math.cos(localT * 1.2) * 140
            );
            break;
          }
          case 's13': {
            // 1.0x wide: Room 03 Complete 72-Card Collector Binder + Unlock All 72 Cards + smooth binder scroll
            setCameraZoom(1.0, 50, 40);
            once('s13_view', () => {
              app.switchView('binder');
            });
            if (localT >= 1.1) {
              once('s13_unlock', () => {
                document.getElementById('btn-unlock-all')?.click();
              });
            }
            const binderScroll = document.querySelector('#view-binder .scroll-view-container');
            if (binderScroll && localT > 1.8) {
              const scrollU = (localT - 1.8) / (sc.scene_duration - 1.8);
              binderScroll.scrollTop = Math.sin(scrollU * Math.PI) * 820;
            }
            movePointer(
              620 + Math.sin(localT * 1.5) * 340,
              480 + Math.cos(localT * 1.1) * 140
            );
            break;
          }
          case 's14': {
            // 1.12x medium framing on Binder Search & Type Filters
            setCameraZoom(1.12, 48, 24);
            const binderScroll = document.querySelector('#view-binder .scroll-view-container');
            if (binderScroll) binderScroll.scrollTop = 0;
            if (localT >= 1.0) {
              once('s14_plugins', () => {
                document.querySelector('[data-binder-kind="plugin"]')?.click();
              });
            }
            if (localT >= 3.2) {
              once('s14_connectors', () => {
                document.querySelector('[data-binder-kind="connector"]')?.click();
              });
            }
            if (localT >= 5.6) {
              once('s14_search_factset', () => {
                document.querySelector('[data-binder-kind="all"]')?.click();
                const inp = document.getElementById('binder-search-input');
                if (inp) {
                  inp.value = 'FactSet';
                  inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
              });
            }
            if (localT >= 7.9) {
              once('s14_reset', () => {
                const inp = document.getElementById('binder-search-input');
                if (inp) {
                  inp.value = '';
                  inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
              });
            }
            movePointer(
              520 + Math.sin(localT * 1.8) * 280,
              240 + Math.cos(localT * 1.4) * 90
            );
            break;
          }
          case 's15': {
            // 1.0x wide: Room 04 Loadout Deck Builder (6 / 6) + curated presets ('studio', 'security', 'wallstreet')
            setCameraZoom(1.0, 50, 44);
            once('s15_view', () => {
              app.switchView('deck');
            });
            if (localT >= 1.6) {
              once('s15_studio', () => {
                app.applyPresetDeck('studio');
              });
            }
            if (localT >= 3.6) {
              once('s15_security', () => {
                app.applyPresetDeck('security');
              });
            }
            if (localT >= 5.8) {
              once('s15_wallstreet', () => {
                app.applyPresetDeck('wallstreet');
              });
            }
            movePointer(
              640 + Math.sin(localT * 1.7) * 320,
              360 + Math.cos(localT * 1.3) * 120
            );
            break;
          }
          case 's16': {
            // 1.0x wide: Copy Stack Prompt -> return to 01 Pack Counter with 5-card Wall Street fan for closing shot
            setCameraZoom(1.0, 50, 45);
            if (localT >= 1.2) {
              once('s16_copy', () => {
                document.getElementById('btn-copy-stack-prompt')?.click();
              });
            }
            if (localT >= 3.8) {
              once('s16_return_counter', async () => {
                app.switchView('counter');
                await app.selectBoosterPack('wall-street-alpha', true);
                app.ripActivePack();
              });
            }
            movePointer(
              960 + Math.sin(localT * 1.5) * 280,
              465 + Math.cos(localT * 1.1) * 75
            );
            break;
          }
        }

        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  });

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  console.log('Finished recording raw WebM:', videoPath);
  fs.writeFileSync(path.join(VIDEO_DIR, 'latest_raw_webm.txt'), videoPath);
})();
