/* ==========================================================================
   SUPERCHARGE — VINTAGE 3D CARD SHOP & PERPLEXITY SKILL EMPORIUM CONTROLLER
   ========================================================================== */

(function () {
  const catalog = window.SUPERCHARGE_CATALOG;
  if (!catalog) {
    console.error('SUPERCHARGE_CATALOG missing');
    return;
  }

  const audio = new window.SuperchargeAudioEngine();
  const forge = new window.CardTextureForge();

  const state = {
    activeView: 'counter', // 'counter' | 'cases' | 'binder' | 'deck'
    activePackId: catalog.packs[0].id,
    packRipCountByPack: {},
    pulledCards: [],
    focusedCard: null,
    collectedIds: new Set(['finance', 'media', 'website-building', 'security-audit', 'contract-review', 'search']),
    loadoutIds: ['finance', 'carbon-arc', 'daloopa', 'factset', 'company-comps', 'pplx-document'],
    casesFilterRarity: 'all',
    binderSearch: '',
    binderPack: 'all',
    binderKind: 'all',
    binderRarity: 'all',
    inspectorCard: null,
    inspectorFlipped: false
  };

  const cardById = new Map();
  catalog.cards.forEach(c => cardById.set(c.id, c));
  const packById = new Map();
  catalog.packs.forEach(p => packById.set(p.id, p));

  let threeStage = null;

  // Deterministic-yet-varied 5-card booster pull from a pack
  function drawFiveCardsFromPack(packId) {
    const pool = catalog.cards.filter(c => c.packId === packId);
    const ripIdx = state.packRipCountByPack[packId] || 0;
    state.packRipCountByPack[packId] = ripIdx + 1;

    const mythics = pool.filter(c => c.rarity === 'mythic-holo');
    const golds = pool.filter(c => c.rarity === 'gold-connector');
    const prismatics = pool.filter(c => c.rarity === 'prismatic-skill');
    const rares = pool.filter(c => c.rarity === 'collector-rare');

    const picked = [];
    const addUnique = candidateList => {
      for (let i = 0; i < candidateList.length; i++) {
        const c = candidateList[(ripIdx + i) % candidateList.length];
        if (c && !picked.some(p => p.id === c.id)) {
          picked.push(c);
          return;
        }
      }
    };

    if (mythics.length > 0) addUnique(mythics);
    if (golds.length > 0) addUnique(golds);
    if (prismatics.length > 0) addUnique(prismatics);
    if (prismatics.length > 1) addUnique(prismatics.slice(1).concat(prismatics.slice(0, 1)));
    if (rares.length > 0) addUnique(rares);

    for (let i = 0; i < pool.length && picked.length < 5; i++) {
      const candidate = pool[(ripIdx * 3 + i) % pool.length];
      if (!picked.some(p => p.id === candidate.id)) {
        picked.push(candidate);
      }
    }

    return picked.slice(0, 5);
  }

  function showToast(msg) {
    const toast = document.getElementById('shop-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2600);
  }

  function updateCollectionBadge() {
    const countEl = document.getElementById('collected-count-val');
    if (countEl) {
      countEl.textContent = `${state.collectedIds.size} / ${catalog.cards.length}`;
    }
    const stackCountEl = document.getElementById('stack-count-val');
    if (stackCountEl) {
      stackCountEl.textContent = `${state.loadoutIds.length} / 6`;
    }
  }

  // =========================================================================
  // VIEW SWITCHING
  // =========================================================================
  function switchView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${viewName}`);
    });

    audio.playCardFlip();

    if (viewName === 'counter' && threeStage) {
      setTimeout(() => threeStage.handleResize(), 40);
    } else if (viewName === 'cases') {
      renderGlassDisplayCases();
    } else if (viewName === 'binder') {
      renderCollectorBinder();
    } else if (viewName === 'deck') {
      renderLoadoutDeckBuilder();
    }
  }

  // =========================================================================
  // VIEW 1: PACK COUNTER & 3D FOIL BOOSTER STAGE
  // =========================================================================
  function renderPackDispenserList() {
    const listEl = document.getElementById('pack-dispenser-list');
    if (!listEl) return;

    listEl.innerHTML = catalog.packs
      .map(pack => {
        const isActive = pack.id === state.activePackId;
        return `
          <div class="pack-selector-card ${isActive ? 'active' : ''}" data-pack-id="${pack.id}">
            <img class="pack-thumb-img" src="${pack.art}" alt="${pack.name}" crossorigin="anonymous" />
            <div class="pack-selector-meta">
              <div class="pack-code">${pack.number} · ${pack.cardCount} CARDS</div>
              <div class="pack-name">${pack.name}</div>
              <div class="pack-sub">${pack.subtitle}</div>
            </div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.pack-selector-card').forEach(cardEl => {
      cardEl.addEventListener('click', () => {
        const packId = cardEl.dataset.packId;
        selectBoosterPack(packId, true);
      });
    });
  }

  async function selectBoosterPack(packId, resetStage = true) {
    const pack = packById.get(packId);
    if (!pack) return;
    state.activePackId = packId;
    renderPackDispenserList();

    const titleEl = document.getElementById('hud-pack-title');
    const subEl = document.getElementById('hud-pack-subtitle');
    if (titleEl) titleEl.textContent = pack.name;
    if (subEl) subEl.textContent = `${pack.series} — ${pack.description}`;

    const packCards = catalog.cards.filter(c => c.packId === packId);
    state.focusedCard = packCards[0] || catalog.cards[0];
    state.pulledCards = [];
    renderPulledTray();
    renderRightSideCardPreview(state.focusedCard, false);

    if (threeStage) {
      await threeStage.setPack(pack, resetStage);
    }
  }

  async function ripActivePack() {
    const pulled = drawFiveCardsFromPack(state.activePackId);
    state.pulledCards = pulled;
    pulled.forEach(c => state.collectedIds.add(c.id));
    updateCollectionBadge();

    if (threeStage) {
      await threeStage.triggerPackRip(pulled);
    }

    state.focusedCard = pulled[0];
    renderPulledTray();
    renderRightSideCardPreview(state.focusedCard, true);
  }

  function renderPulledTray() {
    const trayEl = document.getElementById('pulled-cards-tray');
    const ripBtn = document.getElementById('btn-rip-pack');
    const freshBtn = document.getElementById('btn-fresh-pack');

    if (!trayEl) return;

    if (state.pulledCards.length === 0) {
      trayEl.innerHTML = '';
      if (ripBtn) {
        ripBtn.innerHTML = `<span>✦ Rip Open Pack (5 Cards)</span>`;
      }
      if (freshBtn) freshBtn.style.display = 'none';
      return;
    }

    if (ripBtn) {
      ripBtn.innerHTML = `<span>✦ Rip Another Pack (5 Cards)</span>`;
    }
    if (freshBtn) freshBtn.style.display = 'inline-flex';

    trayEl.innerHTML = state.pulledCards
      .map((card, idx) => {
        const isSelected = state.focusedCard && state.focusedCard.id === card.id;
        return `
          <button class="pulled-mini-pill ${isSelected ? 'selected' : ''}" data-pulled-idx="${idx}">
            <span class="rarity-dot ${card.rarity}"></span>
            <span>${card.cardNumber.split('/')[0]} · ${card.title}</span>
          </button>
        `;
      })
      .join('');

    trayEl.querySelectorAll('.pulled-mini-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.pulledIdx);
        const card = state.pulledCards[idx];
        if (!card) return;
        state.focusedCard = card;
        if (threeStage) threeStage.focusPulledCard(idx);
        renderPulledTray();
        renderRightSideCardPreview(card, true);
      });
    });
  }

  async function renderRightSideCardPreview(card, isFromPull) {
    const container = document.getElementById('counter-card-preview-box');
    if (!container || !card) return;

    const inStack = state.loadoutIds.includes(card.id);
    const statusLabel = isFromPull ? 'PULLED FROM BOOSTER PACK' : 'PACK FLAGSHIP PREVIEW';

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.55rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span style="font-family:var(--font-mono); font-size:0.64rem; color:var(--gold-300); letter-spacing:0.06em;">${statusLabel}</span>
          <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--cream-400);">${card.cardNumber}</span>
        </div>

        <div id="sidebar-live-card-slot" class="holo-card-shell rarity-${card.rarity}" style="width:100%; max-width:250px; margin: 0.25rem auto; cursor:pointer;" title="Click to open 3D Holographic Inspector">
          <div class="holo-rainbow-layer"></div>
        </div>

        <div style="width:100%; display:flex; flex-direction:column; gap:0.45rem;">
          <div style="font-family:var(--font-display); font-size:0.96rem; font-weight:700; color:var(--cream-100);">${card.title}</div>
          <div style="font-size:0.76rem; color:var(--cream-200); line-height:1.42;">${card.description}</div>

          <div style="background:rgba(10,7,5,0.88); border:1px solid var(--border-brass); border-radius:8px; padding:0.48rem 0.6rem;">
            <div style="font-family:var(--font-mono); font-size:0.62rem; color:var(--gold-300); text-transform:uppercase; margin-bottom:0.2rem;">Canonical Command</div>
            <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--teal-300); word-break:break-all;">${card.canonicalCommand}</div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.42rem; margin-top:0.15rem;">
            <button class="btn-brass btn-gold-primary" id="sidebar-btn-inspect" style="justify-content:center; padding:0.48rem 0.55rem; font-size:0.74rem;">
              3D Holo Inspect
            </button>
            <button class="btn-brass" id="sidebar-btn-stack" style="justify-content:center; padding:0.48rem 0.55rem; font-size:0.74rem;">
              ${inStack ? '✓ In Stack' : '+ Add to Stack'}
            </button>
          </div>
          <a href="${card.perplexityUrl}" target="_blank" rel="noopener noreferrer" class="btn-brass btn-teal-action" style="justify-content:center; text-decoration:none; padding:0.48rem 0.55rem; font-size:0.74rem;">
            Install / Open on Perplexity ↗
          </a>
        </div>
      </div>
    `;

    const slot = document.getElementById('sidebar-live-card-slot');
    if (slot) {
      const canvas = await forge.renderCardFrontTexture(card);
      const clone = document.createElement('canvas');
      clone.width = canvas.width;
      clone.height = canvas.height;
      clone.getContext('2d').drawImage(canvas, 0, 0);
      slot.prepend(clone);
      bindInteractive3DTilt(slot);
      slot.addEventListener('click', () => openCardInspector(card));
    }

    const inspectBtn = document.getElementById('sidebar-btn-inspect');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', () => openCardInspector(card));
    }

    const stackBtn = document.getElementById('sidebar-btn-stack');
    if (stackBtn) {
      stackBtn.addEventListener('click', () => {
        toggleCardInLoadout(card.id);
        renderRightSideCardPreview(card, isFromPull);
      });
    }
  }

  function bindInteractive3DTilt(cardShellEl) {
    cardShellEl.addEventListener('pointermove', e => {
      const rect = cardShellEl.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const rotY = (nx - 0.5) * 20;
      const rotX = (0.5 - ny) * 18;
      cardShellEl.style.transform = `perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-4px)`;
    });
    cardShellEl.addEventListener('pointerleave', () => {
      cardShellEl.style.transform = '';
    });
  }

  // =========================================================================
  // VIEW 2: ILLUMINATED GLASS DISPLAY CASES
  // =========================================================================
  async function renderGlassDisplayCases() {
    const container = document.getElementById('display-cases-container');
    if (!container) return;

    const filterBar = document.getElementById('cases-rarity-filters');
    if (filterBar) {
      filterBar.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rarity === state.casesFilterRarity);
      });
    }

    container.innerHTML = '';

    for (const pack of catalog.packs) {
      let packCards = catalog.cards.filter(c => c.packId === pack.id);
      if (state.casesFilterRarity !== 'all') {
        packCards = packCards.filter(c => c.rarity === state.casesFilterRarity);
      }
      if (packCards.length === 0) continue;

      const featuredCards = packCards.slice(0, 6);

      const sectionEl = document.createElement('section');
      sectionEl.className = 'glass-cabinet';
      sectionEl.innerHTML = `
        <div class="cabinet-header">
          <div>
            <span class="cabinet-series">${pack.series} · ${pack.number}</span>
            <h3 class="cabinet-title">${pack.name}</h3>
            <p style="font-size:0.8rem; color:var(--cream-400); margin-top:0.15rem;">${pack.description}</p>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <button class="btn-brass" data-goto-pack="${pack.id}">
              Rip ${pack.name} ↗
            </button>
          </div>
        </div>
        <div class="cabinet-shelf-grid" id="shelf-${pack.id}"></div>
      `;
      container.appendChild(sectionEl);

      const gotoBtn = sectionEl.querySelector('[data-goto-pack]');
      if (gotoBtn) {
        gotoBtn.addEventListener('click', () => {
          selectBoosterPack(pack.id, true);
          switchView('counter');
        });
      }

      const shelfGrid = sectionEl.querySelector(`#shelf-${pack.id}`);
      for (const card of featuredCards) {
        const cardShell = document.createElement('div');
        cardShell.className = `holo-card-shell rarity-${card.rarity}`;
        cardShell.innerHTML = `<div class="holo-rainbow-layer"></div>`;
        shelfGrid.appendChild(cardShell);

        forge.renderCardFrontTexture(card).then(srcCanvas => {
          const c = document.createElement('canvas');
          c.width = srcCanvas.width;
          c.height = srcCanvas.height;
          c.getContext('2d').drawImage(srcCanvas, 0, 0);
          cardShell.prepend(c);
        });

        bindInteractive3DTilt(cardShell);
        cardShell.addEventListener('click', () => openCardInspector(card));
      }
    }
  }

  // =========================================================================
  // VIEW 3: COMPLETE 72-CARD COLLECTOR BINDER
  // =========================================================================
  function renderCollectorBinder() {
    const gridEl = document.getElementById('binder-cards-grid');
    const countLabel = document.getElementById('binder-match-count');
    if (!gridEl) return;

    const q = state.binderSearch.trim().toLowerCase();
    const filtered = catalog.cards.filter(card => {
      if (state.binderPack !== 'all' && card.packId !== state.binderPack) return false;
      if (state.binderKind !== 'all') {
        const k = card.kind.toLowerCase();
        if (state.binderKind === 'skill' && k !== 'skill') return false;
        if (state.binderKind === 'plugin' && !k.includes('plugin')) return false;
        if (state.binderKind === 'connector' && !k.includes('connector')) return false;
      }
      if (state.binderRarity !== 'all' && card.rarity !== state.binderRarity) return false;
      if (q) {
        const hay = `${card.title} ${card.slug} ${card.publisher} ${card.kind} ${card.description} ${card.canonicalCommand} ${(card.triggers || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} of ${catalog.cards.length} verified cards`;
    }

    gridEl.innerHTML = '';

    filtered.forEach(card => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '0.45rem';

      const cardShell = document.createElement('div');
      cardShell.className = `holo-card-shell rarity-${card.rarity}`;
      cardShell.innerHTML = `<div class="holo-rainbow-layer"></div>`;
      wrapper.appendChild(cardShell);

      const quickFooter = document.createElement('div');
      quickFooter.style.display = 'flex';
      quickFooter.style.justifyContent = 'space-between';
      quickFooter.style.alignItems = 'center';
      quickFooter.style.padding = '0 0.2rem';
      quickFooter.innerHTML = `
        <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--gold-300);">${card.cardNumber} · ${card.kind.toUpperCase()}</span>
        <a href="${card.perplexityUrl}" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-mono); font-size:0.68rem; color:var(--teal-300); text-decoration:none;">Perplexity ↗</a>
      `;
      wrapper.appendChild(quickFooter);

      gridEl.appendChild(wrapper);

      forge.renderCardFrontTexture(card).then(srcCanvas => {
        const c = document.createElement('canvas');
        c.width = srcCanvas.width;
        c.height = srcCanvas.height;
        c.getContext('2d').drawImage(srcCanvas, 0, 0);
        cardShell.prepend(c);
      });

      bindInteractive3DTilt(cardShell);
      cardShell.addEventListener('click', () => openCardInspector(card));
    });
  }

  // =========================================================================
  // VIEW 4: LOADOUT DECK BUILDER ("BUILD MY COMPUTER STACK")
  // =========================================================================
  function toggleCardInLoadout(cardId) {
    const idx = state.loadoutIds.indexOf(cardId);
    if (idx >= 0) {
      state.loadoutIds.splice(idx, 1);
      showToast('Removed card from Loadout Stack');
    } else {
      if (state.loadoutIds.length >= 6) {
        state.loadoutIds.shift();
      }
      state.loadoutIds.push(cardId);
      audio.playHoloChime('gold-connector');
      showToast('Added card to Loadout Stack (6-Card Deck)');
    }
    updateCollectionBadge();
    if (state.activeView === 'deck') {
      renderLoadoutDeckBuilder();
    }
  }

  function applyPresetDeck(presetKey) {
    const presets = {
      wallstreet: ['finance', 'carbon-arc', 'daloopa', 'factset', 'company-comps', 'pplx-document'],
      studio: ['website-building', 'taste-skill', 'impeccable', 'science-explainer-video', 'media', 'brickify'],
      security: ['security-audit', 'php2shell-exposure-check', 'graphify', 'github', 'datadog', 'advance-pr'],
      dealdesk: ['partner-proposal-review', 'contract-review', 'supplier-risk-concentration-scan', 'dun-and-bradstreet', 'demo-org-setup', 'automations']
    };
    if (presets[presetKey]) {
      state.loadoutIds = presets[presetKey].filter(id => cardById.has(id)).slice(0, 6);
      audio.playHoloChime('mythic-holo');
      updateCollectionBadge();
      renderLoadoutDeckBuilder();
      showToast('Loaded curated 6-card Computer Stack preset');
    }
  }

  function renderLoadoutDeckBuilder() {
    const slotsEl = document.getElementById('deck-slots-grid');
    const summaryEl = document.getElementById('deck-summary-card');
    if (!slotsEl || !summaryEl) return;

    const stackCards = state.loadoutIds.map(id => cardById.get(id)).filter(Boolean);

    slotsEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const card = stackCards[i];
      const slotDiv = document.createElement('div');
      slotDiv.className = `deck-slot ${card ? 'filled' : ''}`;

      if (!card) {
        slotDiv.innerHTML = `
          <div style="font-family:var(--font-mono); font-size:0.75rem; margin-bottom:0.35rem; color:var(--gold-300);">SLOT 0${i + 1}</div>
          <div style="font-size:0.8rem;">Empty Collector Slot</div>
          <button class="btn-brass" style="margin-top:0.65rem; font-size:0.72rem;" data-browse-slot="${i}">+ Browse Binder</button>
        `;
        slotDiv.querySelector('[data-browse-slot]').addEventListener('click', () => switchView('binder'));
      } else {
        slotDiv.innerHTML = `
          <button class="deck-slot-remove" title="Remove from Stack" data-remove-id="${card.id}">✕</button>
          <div class="holo-card-shell rarity-${card.rarity}" id="deck-card-slot-${i}" style="width:100%; cursor:pointer;">
            <div class="holo-rainbow-layer"></div>
          </div>
        `;
        slotDiv.querySelector('[data-remove-id]').addEventListener('click', e => {
          e.stopPropagation();
          toggleCardInLoadout(card.id);
        });
        const shell = slotDiv.querySelector(`#deck-card-slot-${i}`);
        forge.renderCardFrontTexture(card).then(srcCanvas => {
          const c = document.createElement('canvas');
          c.width = srcCanvas.width;
          c.height = srcCanvas.height;
          c.getContext('2d').drawImage(srcCanvas, 0, 0);
          shell.prepend(c);
        });
        bindInteractive3DTilt(shell);
        shell.addEventListener('click', () => openCardInspector(card));
      }

      slotsEl.appendChild(slotDiv);
    }

    const avgAlpha = stackCards.length
      ? Math.round(stackCards.reduce((acc, c) => acc + (c.stats?.alpha || 92), 0) / stackCards.length)
      : 0;
    const avgDepth = stackCards.length
      ? Math.round(stackCards.reduce((acc, c) => acc + (c.stats?.depth || 92), 0) / stackCards.length)
      : 0;
    const avgSpeed = stackCards.length
      ? Math.round(stackCards.reduce((acc, c) => acc + (c.stats?.speed || 92), 0) / stackCards.length)
      : 0;

    const commands = stackCards.map(c => c.canonicalCommand);

    const combinedPrompt = stackCards.length
      ? [
          `# Perplexity Computer Supercharge Stack (${stackCards.length} Cards)`,
          `Invoke Stack: ${commands.join(' + ')}`,
          '',
          `Chained Workflow Plan:`,
          ...stackCards.map((c, idx) => `${idx + 1}. [${c.title} (${c.cardNumber})] — ${c.prompt}`)
        ].join('\n')
      : 'Add cards from any Booster Pack or the Collector Binder to generate your multi-skill Computer workflow prompt.';

    summaryEl.innerHTML = `
      <div class="sidebar-title">Active Stack Synergy</div>
      <h3 style="font-family:var(--font-display); font-size:1.18rem; color:var(--cream-100);">
        ${stackCards.length} / 6 Supercharge Cards Equipped
      </h3>

      <div class="stat-bars-grid">
        <div class="stat-bar-row">
          <span class="stat-bar-label">ALPHA</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${avgAlpha}%"></div></div>
          <span class="stat-bar-val">${avgAlpha}</span>
        </div>
        <div class="stat-bar-row">
          <span class="stat-bar-label">DEPTH</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${avgDepth}%"></div></div>
          <span class="stat-bar-val">${avgDepth}</span>
        </div>
        <div class="stat-bar-row">
          <span class="stat-bar-label">VELOCITY</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${avgSpeed}%"></div></div>
          <span class="stat-bar-val">${avgSpeed}</span>
        </div>
      </div>

      <div class="prompt-code-box" style="margin-top:0.2rem;">
        <div class="prompt-code-header">
          <span>Combined Computer Stack Prompt</span>
          <button class="btn-brass" id="btn-copy-stack-prompt" style="padding:0.22rem 0.55rem; font-size:0.68rem;">Copy Stack Prompt</button>
        </div>
        <pre class="prompt-code-text" style="white-space:pre-wrap; max-height:210px; overflow-y:auto;">${combinedPrompt}</pre>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.45rem; margin-top:0.25rem;">
        <a href="https://www.perplexity.ai/computer/skills" target="_blank" rel="noopener noreferrer" class="btn-brass btn-gold-primary" style="justify-content:center; text-decoration:none;">
          Open Skills &amp; Plugins Directory on Perplexity ↗
        </a>
        <a href="https://www.perplexity.ai/computer/connectors" target="_blank" rel="noopener noreferrer" class="btn-brass btn-teal-action" style="justify-content:center; text-decoration:none;">
          Configure Connected Sources on Perplexity ↗
        </a>
      </div>
    `;

    const copyBtn = document.getElementById('btn-copy-stack-prompt');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(combinedPrompt);
        showToast('Copied Combined 6-Card Computer Stack Prompt');
      });
    }
  }

  // =========================================================================
  // 3D HOLOGRAPHIC CARD INSPECTOR MODAL
  // =========================================================================
  async function openCardInspector(card) {
    if (!card) return;
    state.inspectorCard = card;
    state.inspectorFlipped = false;
    state.collectedIds.add(card.id);
    updateCollectionBadge();
    audio.playHoloChime(card.rarity);

    const backdrop = document.getElementById('card-inspector-modal');
    const bodyEl = document.getElementById('card-inspector-body');
    if (!backdrop || !bodyEl) return;

    const pack = packById.get(card.packId);
    const inStack = state.loadoutIds.includes(card.id);
    const subItems = (card.triggers || []).concat(card.connectors || []);

    bodyEl.innerHTML = `
      <div class="modal-card-stage">
        <div id="modal-3d-card-holder" class="modal-3d-card-wrapper holo-card-shell rarity-${card.rarity}">
          <div class="holo-rainbow-layer" style="opacity:0.75;"></div>
        </div>
        <div style="display:flex; gap:0.55rem; width:100%; justify-content:center;">
          <button class="btn-brass" id="modal-btn-flip">↻ Flip Card (Front / Back)</button>
          <button class="btn-brass" id="modal-btn-stack">${inStack ? '✓ Equipped in Stack' : '+ Equip in Loadout Stack'}</button>
        </div>
      </div>

      <div class="modal-details-col">
        <div class="modal-kicker-row">
          <span class="modal-badge-pill gold">${card.cardNumber} · ${card.rarityLabel}</span>
          <span class="modal-badge-pill teal">${card.kind.toUpperCase()} · ${card.scope.toUpperCase()}</span>
          <span class="modal-badge-pill">${card.publisher}</span>
          <span class="modal-badge-pill">${pack ? pack.name : card.packId}</span>
        </div>

        <div>
          <h2 class="modal-card-title">${card.title}</h2>
          <div class="modal-canonical-id">${card.canonicalCommand}</div>
        </div>

        <p class="modal-description">${card.description}</p>

        ${
          subItems.length > 0
            ? `
          <div>
            <div style="font-family:var(--font-mono); font-size:0.68rem; color:var(--gold-300); text-transform:uppercase; margin-bottom:0.35rem;">
              Trigger Phrases &amp; Connected Sources
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:0.38rem;">
              ${subItems.map(item => `<span class="modal-badge-pill teal">${item}</span>`).join('')}
            </div>
          </div>
        `
            : ''
        }

        <div class="stat-bars-grid">
          <div class="stat-bar-row">
            <span class="stat-bar-label">ALPHA</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${card.stats.alpha}%"></div></div>
            <span class="stat-bar-val">${card.stats.alpha}</span>
          </div>
          <div class="stat-bar-row">
            <span class="stat-bar-label">DEPTH</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${card.stats.depth}%"></div></div>
            <span class="stat-bar-val">${card.stats.depth}</span>
          </div>
          <div class="stat-bar-row">
            <span class="stat-bar-label">VELOCITY</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${card.stats.speed}%"></div></div>
            <span class="stat-bar-val">${card.stats.speed}</span>
          </div>
        </div>

        <div class="prompt-code-box">
          <div class="prompt-code-header">
            <span>Invocation &amp; Flagship Prompt</span>
            <button class="btn-brass" id="modal-btn-copy-prompt" style="padding:0.2rem 0.55rem; font-size:0.68rem;">Copy Prompt</button>
          </div>
          <div class="prompt-code-text" style="margin-bottom:0.35rem; color:var(--gold-200);">${card.canonicalCommand}</div>
          <div class="prompt-code-text">${card.prompt}</div>
        </div>

        <div class="modal-actions-row">
          <a href="${card.perplexityUrl}" target="_blank" rel="noopener noreferrer" class="btn-brass btn-gold-primary" style="text-decoration:none;">
            Install / View on Perplexity ↗
          </a>
          <button class="btn-brass btn-teal-action" id="modal-btn-copy-trigger">
            Copy Trigger Command
          </button>
          <a href="${card.tryInComputerUrl || 'https://www.perplexity.ai/computer'}" target="_blank" rel="noopener noreferrer" class="btn-brass" style="text-decoration:none;">
            Try This Skill in Computer ↗
          </a>
        </div>
      </div>
    `;

    backdrop.classList.add('open');

    const holder = document.getElementById('modal-3d-card-holder');
    const frontCanvas = await forge.renderCardFrontTexture(card);
    const backCanvas = forge.renderCardBackTexture();

    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = frontCanvas.width;
    displayCanvas.height = frontCanvas.height;
    displayCanvas.getContext('2d').drawImage(frontCanvas, 0, 0);
    holder.prepend(displayCanvas);
    bindInteractive3DTilt(holder);

    const flipBtn = document.getElementById('modal-btn-flip');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        state.inspectorFlipped = !state.inspectorFlipped;
        audio.playCardFlip();
        const ctx = displayCanvas.getContext('2d');
        ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        ctx.drawImage(state.inspectorFlipped ? backCanvas : frontCanvas, 0, 0);
      });
    }

    const stackBtn = document.getElementById('modal-btn-stack');
    if (stackBtn) {
      stackBtn.addEventListener('click', () => {
        toggleCardInLoadout(card.id);
        const nowIn = state.loadoutIds.includes(card.id);
        stackBtn.textContent = nowIn ? '✓ Equipped in Stack' : '+ Equip in Loadout Stack';
      });
    }

    const copyPromptBtn = document.getElementById('modal-btn-copy-prompt');
    if (copyPromptBtn) {
      copyPromptBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(`${card.canonicalCommand}\n${card.prompt}`);
        showToast(`Copied ${card.title} prompt to clipboard`);
      });
    }

    const copyTriggerBtn = document.getElementById('modal-btn-copy-trigger');
    if (copyTriggerBtn) {
      copyTriggerBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(card.canonicalCommand);
        showToast(`Copied command: ${card.canonicalCommand}`);
      });
    }
  }

  function closeCardInspector() {
    const backdrop = document.getElementById('card-inspector-modal');
    if (backdrop) backdrop.classList.remove('open');
    state.inspectorCard = null;
  }

  // =========================================================================
  // INITIALIZATION & EVENT BINDINGS
  // =========================================================================
  async function init() {
    updateCollectionBadge();
    renderPackDispenserList();

    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    const audioBtn = document.getElementById('btn-audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const enabled = audio.toggle();
        audioBtn.textContent = enabled ? '♫ SFX: ON' : '♫ SFX: OFF';
        showToast(enabled ? 'Synthesized Web Audio SFX Enabled' : 'Audio Muted');
      });
    }

    const stageContainer = document.getElementById('three-stage-canvas');
    if (stageContainer && window.THREE && window.ThreePackStage) {
      threeStage = new window.ThreePackStage(stageContainer, forge, audio, {
        onSeamProgress: pct => {
          const seamEl = document.getElementById('hud-seam-pct');
          if (seamEl) seamEl.textContent = `SEAM ${pct}%`;
        },
        onRequestRip: () => {
          ripActivePack();
        },
        onCardSelect: card => {
          state.focusedCard = card;
          renderPulledTray();
          renderRightSideCardPreview(card, true);
          openCardInspector(card);
        }
      });
    }

    await selectBoosterPack(state.activePackId, true);

    const ripBtn = document.getElementById('btn-rip-pack');
    if (ripBtn) {
      ripBtn.addEventListener('click', () => ripActivePack());
    }

    const freshBtn = document.getElementById('btn-fresh-pack');
    if (freshBtn) {
      freshBtn.addEventListener('click', () => {
        selectBoosterPack(state.activePackId, true);
        showToast('Placed fresh foil booster pack on counter');
      });
    }

    const inspectFocusedBtn = document.getElementById('btn-inspect-focused');
    if (inspectFocusedBtn) {
      inspectFocusedBtn.addEventListener('click', () => {
        if (state.focusedCard) openCardInspector(state.focusedCard);
      });
    }

    const casesFilterBar = document.getElementById('cases-rarity-filters');
    if (casesFilterBar) {
      casesFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          state.casesFilterRarity = btn.dataset.rarity;
          renderGlassDisplayCases();
        });
      });
    }

    const searchInput = document.getElementById('binder-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        state.binderSearch = e.target.value;
        renderCollectorBinder();
      });
    }

    const packSelect = document.getElementById('binder-pack-select');
    if (packSelect) {
      packSelect.innerHTML =
        `<option value="all">All 6 Booster Packs (72 Cards)</option>` +
        catalog.packs.map(p => `<option value="${p.id}">${p.name} (${p.cardCount})</option>`).join('');
      packSelect.addEventListener('change', e => {
        state.binderPack = e.target.value;
        renderCollectorBinder();
      });
    }

    document.querySelectorAll('[data-binder-kind]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.binderKind = btn.dataset.binderKind;
        document.querySelectorAll('[data-binder-kind]').forEach(b =>
          b.classList.toggle('active', b.dataset.binderKind === state.binderKind)
        );
        renderCollectorBinder();
      });
    });

    document.querySelectorAll('[data-binder-rarity]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.binderRarity = btn.dataset.binderRarity;
        document.querySelectorAll('[data-binder-rarity]').forEach(b =>
          b.classList.toggle('active', b.dataset.binderRarity === state.binderRarity)
        );
        renderCollectorBinder();
      });
    });

    const unlockAllBtn = document.getElementById('btn-unlock-all');
    if (unlockAllBtn) {
      unlockAllBtn.addEventListener('click', () => {
        catalog.cards.forEach(c => state.collectedIds.add(c.id));
        updateCollectionBadge();
        audio.playHoloChime('mythic-holo');
        showToast('Unlocked all 72 Collector Cards in your Emporium Ledger');
      });
    }

    document.querySelectorAll('[data-preset-deck]').forEach(btn => {
      btn.addEventListener('click', () => applyPresetDeck(btn.dataset.presetDeck));
    });

    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeCardInspector);
    const modalBackdrop = document.getElementById('card-inspector-modal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', e => {
        if (e.target === modalBackdrop) closeCardInspector();
      });
    }
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeCardInspector();
    });

    window.SUPERCHARGE_APP = {
      switchView,
      selectBoosterPack,
      ripActivePack,
      openCardInspectorById: id => openCardInspector(cardById.get(id)),
      closeCardInspector,
      applyPresetDeck,
      getState: () => state,
      getThreeStage: () => threeStage
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
