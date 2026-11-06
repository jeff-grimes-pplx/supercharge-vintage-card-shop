/* ==========================================================================
   SUPERCHARGE — CARD TEXTURE FORGE & WEB AUDIO SYNTHESIS ENGINE
   Renders 1999 Wizards-of-the-Coast / Upper Deck Holo Collector Cards,
   Booster Foil Wrappers, and Procedural Web Audio Foil Crinkle / Tear / Chime
   ========================================================================== */

class SuperchargeAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.ensureContext();
      this.playHoloChime('prismatic-skill');
    }
    return this.enabled;
  }

  playFoilCrinkle(intensity = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 0.065 + intensity * 0.05;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      // Crackle envelope with micro-spikes
      const env = Math.sin((i / bufSize) * Math.PI);
      const spike = Math.random() > 0.86 ? 2.2 : 0.45;
      data[i] = (Math.random() * 2 - 1) * env * spike;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200 + Math.random() * 2800, now);
    filter.Q.setValueAtTime(3.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);
  }

  playPackRip() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Metallic foil tear sweep (0.42s)
    const tearDur = 0.42;
    const bufSize = Math.floor(ctx.sampleRate * tearDur);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const t = i / bufSize;
      const env = Math.pow(Math.sin(t * Math.PI), 0.7);
      const grain = Math.sin(i * 0.15) * 0.5 + 0.5;
      data[i] = (Math.random() * 2 - 1) * env * (0.6 + 0.6 * grain);
    }

    const tearSrc = ctx.createBufferSource();
    tearSrc.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, now);
    bp.frequency.exponentialRampToValueAtTime(7600, now + tearDur);
    bp.Q.setValueAtTime(2.2, now);

    const tearGain = ctx.createGain();
    tearGain.gain.setValueAtTime(0.22, now);
    tearGain.gain.exponentialRampToValueAtTime(0.002, now + tearDur);

    tearSrc.connect(bp);
    bp.connect(tearGain);
    tearGain.connect(ctx.destination);
    tearSrc.start(now);
    tearSrc.stop(now + tearDur);

    // 2. Holographic 1999 Collector Fan Reveal Chord Arpeggio
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98]; // C5 E5 G5 B5 D6 G6
    notes.forEach((freq, idx) => {
      const start = now + 0.18 + idx * 0.065;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = 'triangle';
      osc2.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc2.frequency.setValueAtTime(freq * 2.0, start);

      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.085, start + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0008, start + 0.95);

      osc.connect(g);
      osc2.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc2.start(start);
      osc.stop(start + 1.0);
      osc2.stop(start + 1.0);
    });
  }

  playCardFlip() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.075);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playHoloChime(rarity = 'mythic-holo') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chords = {
      'mythic-holo': [587.33, 880.0, 1174.66, 1479.98],
      'gold-connector': [523.25, 659.25, 783.99, 1046.5],
      'prismatic-skill': [440.0, 659.25, 880.0],
      'collector-rare': [392.0, 587.33, 783.99]
    };
    const freqs = chords[rarity] || chords['prismatic-skill'];
    freqs.forEach((f, i) => {
      const t0 = now + i * 0.045;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.055, t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.55);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.6);
    });
  }
}

class CardTextureForge {
  constructor() {
    this.imageCache = new Map();
    this.cardCanvasCache = new Map();
    this.packCanvasCache = new Map();
    this.backCanvas = null;
  }

  preloadAll(catalog) {
    const urls = new Set();
    (catalog.packs || []).forEach(p => { if (p.art) urls.add(p.art); });
    (catalog.cards || []).forEach(c => {
      if (c.art) urls.add(c.art);
      if (c.publisherLogo) urls.add(c.publisherLogo);
    });
    const promises = Array.from(urls).map(u => this.loadImage(u));
    return Promise.allSettled(promises);
  }

  loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (this.imageCache.has(src)) return this.imageCache.get(src);
    const p = new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    this.imageCache.set(src, p);
    return p;
  }

  getRarityPalette(rarity) {
    switch (rarity) {
      case 'mythic-holo':
        return {
          outer: '#3a174d',
          frameStart: '#f5b8ff',
          frameMid: '#c663f2',
          frameEnd: '#6b2294',
          badgeBg: '#2b0d3b',
          badgeText: '#f7d4ff',
          glow: '#d87df7'
        };
      case 'gold-connector':
        return {
          outer: '#3d2a08',
          frameStart: '#fff0b3',
          frameMid: '#e5b84b',
          frameEnd: '#8c6210',
          badgeBg: '#2e1f05',
          badgeText: '#fce08b',
          glow: '#f5c451'
        };
      case 'prismatic-skill':
        return {
          outer: '#0b3633',
          frameStart: '#a8fff7',
          frameMid: '#3fe0d0',
          frameEnd: '#0f6e65',
          badgeBg: '#072624',
          badgeText: '#9efcf2',
          glow: '#3fe0d0'
        };
      default:
        return {
          outer: '#3b1c12',
          frameStart: '#ffc9b5',
          frameMid: '#e87a54',
          frameEnd: '#7d3118',
          badgeBg: '#291109',
          badgeText: '#ffcab8',
          glow: '#f0825b'
        };
    }
  }

  drawMotifEngraving(ctx, motif, cx, cy, radius, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.42;

    // Outer engraved astrolabe ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();

    // Tick marks
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r1 = i % 3 === 0 ? radius * 0.76 : radius * 0.82;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
    }

    // Motif-specific geometric sigil
    const h = (motif || 'sigil').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const points = 5 + (h % 4);
    ctx.beginPath();
    for (let i = 0; i <= points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? radius * 0.68 : radius * 0.32;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  async renderPackTexture(pack) {
    if (this.packCanvasCache.has(pack.id)) {
      return this.packCanvasCache.get(pack.id);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 920;
    const ctx = canvas.getContext('2d');

    // Metallic dark base
    const bgGrad = ctx.createLinearGradient(0, 0, 640, 920);
    bgGrad.addColorStop(0, '#1e1610');
    bgGrad.addColorStop(0.5, '#0f0b08');
    bgGrad.addColorStop(1, '#1a120b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 640, 920);

    // Top and bottom foil crimp ridges
    ctx.fillStyle = '#3b2c1a';
    ctx.fillRect(0, 0, 640, 68);
    ctx.fillRect(0, 852, 640, 68);
    for (let x = 0; x < 640; x += 8) {
      ctx.fillStyle = x % 16 === 0 ? 'rgba(252,224,139,0.28)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, 0, 4, 68);
      ctx.fillRect(x, 852, 4, 68);
    }

    // Glowing tear-line seam at y = 84
    ctx.strokeStyle = pack.accent || '#e5b84b';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(24, 84);
    ctx.lineTo(616, 84);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ornate outer gold border
    ctx.strokeStyle = pack.accent || '#e5b84b';
    ctx.lineWidth = 5;
    ctx.strokeRect(26, 102, 588, 728);
    ctx.strokeStyle = 'rgba(252,224,139,0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(36, 112, 568, 708);

    // Draw pack emblem art
    const artImg = await this.loadImage(pack.art);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(54, 210, 532, 430, 14);
    ctx.clip();
    if (artImg) {
      try {
        ctx.drawImage(artImg, 54, 210, 532, 430);
      } catch (_) {}
    }
    this.drawMotifEngraving(ctx, pack.id, 320, 425, 175, pack.accent || '#fce08b');
    ctx.restore();

    // Gold frame around art
    ctx.strokeStyle = '#fce08b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(54, 210, 532, 430, 14);
    ctx.stroke();

    // Header Banner
    ctx.fillStyle = '#fce08b';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${pack.number} • PERPLEXITY COMPUTER`, 320, 148);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 36px "Boska", Georgia, serif';
    ctx.fillText(pack.name.replace(' Pack', '').toUpperCase(), 320, 190);

    // Bottom plaque
    ctx.fillStyle = 'rgba(14, 10, 7, 0.9)';
    ctx.beginPath();
    ctx.roundRect(54, 658, 532, 140, 10);
    ctx.fill();
    ctx.strokeStyle = pack.accent || '#e5b84b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = pack.accent || '#fce08b';
    ctx.font = '700 22px "Boska", Georgia, serif';
    ctx.fillText(pack.subtitle.toUpperCase(), 320, 694);

    ctx.fillStyle = '#e5dccb';
    ctx.font = '600 16px "Satoshi", sans-serif';
    ctx.fillText(`${pack.cardCount || 12} COLLECTIBLE CARDS IN SET • 5 PER BOOSTER`, 320, 728);

    ctx.fillStyle = '#fce08b';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText('1ST EDITION HOLOGRAPHIC FOIL GUARANTEED', 320, 766);

    this.packCanvasCache.set(pack.id, canvas);
    return canvas;
  }

  async renderCardFrontTexture(card) {
    if (this.cardCanvasCache.has(card.id)) {
      return this.cardCanvasCache.get(card.id);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1008;
    const ctx = canvas.getContext('2d');
    const pal = this.getRarityPalette(card.rarity);

    // 1. Outer Collector Border (Embossed Metallic Gradient)
    const borderGrad = ctx.createLinearGradient(0, 0, 720, 1008);
    borderGrad.addColorStop(0, pal.frameStart);
    borderGrad.addColorStop(0.35, pal.frameMid);
    borderGrad.addColorStop(0.7, pal.frameEnd);
    borderGrad.addColorStop(1, pal.frameMid);
    ctx.fillStyle = borderGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 720, 1008, 28);
    ctx.fill();

    // 2. Inner Dark Velvet Card Body
    ctx.fillStyle = '#130e0a';
    ctx.beginPath();
    ctx.roundRect(22, 22, 676, 964, 18);
    ctx.fill();

    // Subtle filigree inner border
    ctx.strokeStyle = pal.frameMid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(30, 30, 660, 948, 14);
    ctx.stroke();

    // 3. Top Title Bar
    ctx.fillStyle = pal.badgeBg;
    ctx.beginPath();
    ctx.roundRect(44, 44, 632, 68, 10);
    ctx.fill();
    ctx.strokeStyle = pal.frameStart;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Kind pill + Card Title
    ctx.fillStyle = pal.badgeText;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${card.kind.toUpperCase()} • ${card.cardNumber}`, 62, 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 27px "Boska", Georgia, serif';
    ctx.fillText(card.title.slice(0, 32), 62, 99);

    // Alpha Score Orb on Top Right
    ctx.fillStyle = pal.frameMid;
    ctx.beginPath();
    ctx.arc(636, 78, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120d09';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(card.stats.alpha), 636, 85);

    // 4. Illustration Frame (44, 124, 632, 412)
    const artImg = await this.loadImage(card.art);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(44, 124, 632, 412, 12);
    ctx.clip();

    const artBg = ctx.createRadialGradient(360, 330, 30, 360, 330, 340);
    artBg.addColorStop(0, pal.outer);
    artBg.addColorStop(1, '#090604');
    ctx.fillStyle = artBg;
    ctx.fillRect(44, 124, 632, 412);

    if (artImg) {
      try {
        ctx.drawImage(artImg, 44, 124, 632, 412);
      } catch (_) {}
    }

    // Bespoke engraved collector sigil over illustration
    this.drawMotifEngraving(ctx, card.motif, 360, 330, 155, pal.frameStart);
    ctx.restore();

    // Illustration gold bezel
    ctx.strokeStyle = pal.frameStart;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(44, 124, 632, 412, 12);
    ctx.stroke();

    // Publisher & Rarity Ribbon below art (y = 548)
    ctx.fillStyle = '#1d150e';
    ctx.beginPath();
    ctx.roundRect(44, 548, 632, 44, 8);
    ctx.fill();
    ctx.strokeStyle = pal.frameMid;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = pal.badgeText;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`PUBLISHER: ${card.publisher.toUpperCase()}`, 60, 575);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fce08b';
    ctx.fillText(`★ ${card.rarityLabel.toUpperCase()}`, 660, 575);

    // 5. Canonical Command Spell Box (y = 604)
    ctx.fillStyle = '#091713';
    ctx.beginPath();
    ctx.roundRect(44, 604, 632, 52, 8);
    ctx.fill();
    ctx.strokeStyle = '#3fe0d0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#8efcf1';
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(card.canonicalCommand.slice(0, 48), 60, 636);

    // 6. Lore / Capability Description Box (y = 668)
    ctx.fillStyle = '#18110b';
    ctx.beginPath();
    ctx.roundRect(44, 668, 632, 178, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(229, 184, 75, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wrap description text cleanly
    ctx.fillStyle = '#f2eadc';
    ctx.font = '500 19px "Satoshi", sans-serif';
    this.wrapText(ctx, card.description, 62, 702, 596, 26, 3);

    // Trigger chips inside box
    ctx.fillStyle = pal.badgeText;
    ctx.font = '700 14px "JetBrains Mono", monospace';
    const trigLine = 'TRIGGERS: ' + (card.triggers || []).slice(0, 3).join(' • ');
    ctx.fillText(trigLine.slice(0, 56), 62, 824);

    // 7. Bottom Collector Stat Medallions (y = 860)
    const stats = [
      { label: 'ALPHA', val: card.stats.alpha },
      { label: 'DEPTH', val: card.stats.depth },
      { label: 'VELOCITY', val: card.stats.speed }
    ];
    stats.forEach((st, idx) => {
      const bx = 44 + idx * 216;
      ctx.fillStyle = pal.badgeBg;
      ctx.beginPath();
      ctx.roundRect(bx, 860, 200, 72, 10);
      ctx.fill();
      ctx.strokeStyle = pal.frameStart;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = pal.badgeText;
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(st.label, bx + 100, 884);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 26px "Boska", Georgia, serif';
      ctx.fillText(String(st.val), bx + 100, 918);
    });

    // Edition footer stamp
    ctx.fillStyle = '#b5a48b';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${card.editionStamp} • PERPLEXITY.AI/COMPUTER`, 360, 958);

    this.cardCanvasCache.set(card.id, canvas);
    return canvas;
  }

  renderCardBackTexture() {
    if (this.backCanvas) return this.backCanvas;
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1008;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 720, 1008);
    grad.addColorStop(0, '#e5b84b');
    grad.addColorStop(0.5, '#9c6f16');
    grad.addColorStop(1, '#fce08b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 720, 1008, 28);
    ctx.fill();

    ctx.fillStyle = '#120d09';
    ctx.beginPath();
    ctx.roundRect(24, 24, 672, 960, 18);
    ctx.fill();

    // Astrolabe mandala on card back
    this.drawMotifEngraving(ctx, 'supercharge-emporium-back', 360, 504, 250, '#e5b84b');
    this.drawMotifEngraving(ctx, 'supercharge-inner', 360, 504, 140, '#3fe0d0');

    ctx.fillStyle = '#fce08b';
    ctx.font = '700 42px "Boska", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUPERCHARGE', 360, 170);

    ctx.fillStyle = '#c2b39b';
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText('THE PERPLEXITY COMPUTER EMPORIUM', 360, 205);
    ctx.fillText('1ST EDITION • SKILLS • PLUGINS • CONNECTORS', 360, 860);

    this.backCanvas = canvas;
    return canvas;
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = (text || '').split(' ');
    let line = '';
    let lines = 0;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines++;
        if (lines >= maxLines) {
          ctx.fillText(line.trim() + '…', x, y);
          return;
        }
        ctx.fillText(line.trim(), x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), x, y);
    }
  }
}

window.SuperchargeAudioEngine = SuperchargeAudioEngine;
window.CardTextureForge = CardTextureForge;
