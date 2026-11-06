/* ==========================================================================
   SUPERCHARGE — THREE.JS 3D FOIL PACK RIPPING STAGE & GLSL HOLO SHADERS
   ========================================================================== */

class ThreePackStage {
  constructor(containerEl, forge, audio, callbacks = {}) {
    this.container = containerEl;
    this.forge = forge;
    this.audio = audio;
    this.callbacks = callbacks;

    this.state = 'PACK_READY'; // PACK_READY | RIPPING | FAN_REVEALED
    this.activePack = null;
    this.pulledCards = [];
    this.selectedCardIndex = -1;

    this.ripProgress = 0;
    this.ripAnimTime = 0;
    this.ripStartedAt = 0;
    this.isDraggingSeam = false;
    this.isPointerOverCanvas = false;
    this.dragStartX = 0;
    this.lastCrinkleAt = 0;

    this.pointer = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.hoveredCardIdx = -1;
    this.clock = new THREE.Clock();

    this.cardEntries = [];
    this.confettiMesh = null;
    this.confettiData = [];

    this.initScene();
    this.initTableAndLights();
    this.initPackMesh();
    this.initConfetti();
    this.bindEvents();
    this.animate();
  }

  initScene() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || (window.innerHeight - 60);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b0806, 0.045);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    this.camera.position.set(0, 0.25, 7.6);
    this.camera.lookAt(0, 0.05, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x0b0806, 1);
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
  }

  initTableAndLights() {
    const ambient = new THREE.AmbientLight(0xffeacc, 0.85);
    this.scene.add(ambient);

    const keyLight = new THREE.PointLight(0xffd27d, 1.8, 25);
    keyLight.position.set(2.5, 4.2, 5.5);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x3fe0d0, 1.1, 20);
    rimLight.position.set(-4.0, 2.5, 3.5);
    this.scene.add(rimLight);

    // Vintage Collector Table Surface
    const tableCanvas = document.createElement('canvas');
    tableCanvas.width = 1024;
    tableCanvas.height = 1024;
    const tctx = tableCanvas.getContext('2d');

    const grad = tctx.createRadialGradient(512, 512, 60, 512, 512, 500);
    grad.addColorStop(0, '#162920');
    grad.addColorStop(0.58, '#120e0a');
    grad.addColorStop(1, '#090705');
    tctx.fillStyle = grad;
    tctx.fillRect(0, 0, 1024, 1024);

    // Astrolabe brass rings on felt counter
    tctx.strokeStyle = 'rgba(229, 184, 75, 0.28)';
    tctx.lineWidth = 3;
    [180, 280, 390, 440].forEach(r => {
      tctx.beginPath();
      tctx.arc(512, 512, r, 0, Math.PI * 2);
      tctx.stroke();
    });

    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      tctx.beginPath();
      tctx.moveTo(512 + Math.cos(a) * 370, 512 + Math.sin(a) * 370);
      tctx.lineTo(512 + Math.cos(a) * 435, 512 + Math.sin(a) * 435);
      tctx.stroke();
    }

    const tableTex = new THREE.CanvasTexture(tableCanvas);
    const tableGeo = new THREE.PlaneGeometry(18, 14);
    const tableMat = new THREE.MeshStandardMaterial({
      map: tableTex,
      roughness: 0.75,
      metalness: 0.15
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.rotation.x = -Math.PI * 0.43;
    tableMesh.position.set(0, -2.35, -1.2);
    this.scene.add(tableMesh);
  }

  initPackMesh() {
    this.packGroup = new THREE.Group();
    this.packGroup.position.set(0, -0.08, 0.25);
    this.packGroup.scale.setScalar(0.9);
    this.scene.add(this.packGroup);

    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = 64;
    placeholderCanvas.height = 64;
    const defaultTex = new THREE.CanvasTexture(placeholderCanvas);

    // Custom GLSL Foil Booster Pack Shader
    const packVertexShader = `
      uniform float uTime;
      uniform float uRipProgress;
      uniform float uIsStrip;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Subtle crinkled foil surface perturbation
        float crinkle = sin(pos.x * 9.0 + pos.y * 7.0) * 0.018
                      + cos(pos.x * 17.0 - pos.y * 13.0) * 0.01;
        pos.z += crinkle;

        if (uIsStrip > 0.5) {
          // Map local x (-1.35 .. +1.35) to 0..1
          float nx = clamp((pos.x + 1.35) / 2.7, 0.0, 1.0);
          float peel = clamp((uRipProgress * 1.25) - nx * 0.55, 0.0, 1.0);
          pos.y += peel * 0.85 + pow(peel, 2.0) * 0.65;
          pos.z += sin(peel * 3.14159) * 0.65;
          pos.x += peel * 0.45;
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const packFragmentShader = `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform vec2 uPointer;
      uniform vec3 uFoilTint;
      uniform float uRipProgress;
      uniform float uIsStrip;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      vec3 rainbow(float t) {
        vec3 c = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
        return c;
      }

      void main() {
        // Sample the correct UV slice of the full pack texture
        vec2 sampleUv = vUv;
        if (uIsStrip > 0.5) {
          sampleUv.y = mix(0.89, 1.0, vUv.y);
        } else {
          sampleUv.y = mix(0.0, 0.89, vUv.y);
        }

        vec4 texColor = texture2D(uMap, sampleUv);

        // Crinkled foil normal perturbation + rainbow diffraction
        float facet = sin(vUv.x * 42.0 + uPointer.x * 6.0) * cos(vUv.y * 36.0 + uPointer.y * 6.0);
        float angleShift = dot(normalize(vNormal), normalize(vViewPos)) + uPointer.x * 0.45 + uPointer.y * 0.35;
        vec3 holo = rainbow(angleShift * 1.8 + vUv.x * 0.9 + vUv.y * 0.7 + uTime * 0.12 + facet * 0.08);

        // Metallic specular sweep
        float specBand = pow(max(0.0, sin((vUv.x + vUv.y * 0.6 - uPointer.x * 0.9 + uTime * 0.25) * 6.28318)), 6.0);
        vec3 foilCol = mix(texColor.rgb, holo * uFoilTint * 1.35, 0.22) + vec3(1.0, 0.92, 0.72) * specBand * 0.28;

        // Glowing top tear-seam indicator on main body
        if (uIsStrip < 0.5 && vUv.y > 0.965) {
          float pulse = 0.55 + 0.45 * sin(uTime * 5.0 + vUv.x * 10.0);
          vec3 seamCol = mix(vec3(0.98, 0.82, 0.35), vec3(0.25, 0.95, 0.88), float(vUv.x < uRipProgress));
          foilCol = mix(foilCol, seamCol, 0.65 * pulse);
        }

        gl_FragColor = vec4(foilCol, 1.0);
      }
    `;

    this.packUniformsMain = {
      uMap: { value: defaultTex },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uFoilTint: { value: new THREE.Vector3(0.95, 0.78, 0.28) },
      uRipProgress: { value: 0 },
      uIsStrip: { value: 0.0 }
    };

    this.packUniformsStrip = {
      uMap: { value: defaultTex },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uFoilTint: { value: new THREE.Vector3(0.95, 0.78, 0.28) },
      uRipProgress: { value: 0 },
      uIsStrip: { value: 1.0 }
    };

    const bodyGeo = new THREE.PlaneGeometry(2.7, 3.45, 36, 48);
    const bodyMat = new THREE.ShaderMaterial({
      vertexShader: packVertexShader,
      fragmentShader: packFragmentShader,
      uniforms: this.packUniformsMain,
      side: THREE.DoubleSide
    });
    this.packBodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.packBodyMesh.position.set(0, -0.2, 0);
    this.packGroup.add(this.packBodyMesh);

    const stripGeo = new THREE.PlaneGeometry(2.7, 0.44, 36, 12);
    const stripMat = new THREE.ShaderMaterial({
      vertexShader: packVertexShader,
      fragmentShader: packFragmentShader,
      uniforms: this.packUniformsStrip,
      side: THREE.DoubleSide
    });
    this.packStripMesh = new THREE.Mesh(stripGeo, stripMat);
    this.packStripMesh.position.set(0, 1.75, 0.01);
    this.packGroup.add(this.packStripMesh);

    // Subtle volumetric gold backplate for thickness
    const backPlateGeo = new THREE.BoxGeometry(2.68, 3.86, 0.14);
    const backPlateMat = new THREE.MeshStandardMaterial({
      color: 0x2e2010,
      metalness: 0.75,
      roughness: 0.35
    });
    this.packThicknessMesh = new THREE.Mesh(backPlateGeo, backPlateMat);
    this.packThicknessMesh.position.set(0, -0.02, -0.15);
    this.packGroup.add(this.packThicknessMesh);
  }

  initConfetti() {
    const count = 140;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0xfce08b),
      new THREE.Color(0xd87df7),
      new THREE.Color(0x3fe0d0),
      new THREE.Color(0xf0825b)
    ];

    this.confettiData = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
      const col = palette[i % palette.length];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      this.confettiData.push({
        vx: (Math.random() - 0.5) * 0.02,
        vy: Math.random() * 0.015 + 0.004,
        vz: (Math.random() - 0.5) * 0.01,
        burst: false
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending
    });

    this.confettiMesh = new THREE.Points(geo, mat);
    this.scene.add(this.confettiMesh);
  }

  burstConfettiAtSeam() {
    const posAttr = this.confettiMesh.geometry.attributes.position;
    for (let i = 0; i < this.confettiData.length; i++) {
      posAttr.setXYZ(
        i,
        (Math.random() - 0.5) * 2.4,
        1.5 + (Math.random() - 0.5) * 0.3,
        0.5 + (Math.random() - 0.5) * 0.3
      );
      this.confettiData[i].vx = (Math.random() - 0.5) * 0.14;
      this.confettiData[i].vy = Math.random() * 0.12 + 0.03;
      this.confettiData[i].vz = (Math.random() - 0.5) * 0.1;
      this.confettiData[i].burst = true;
    }
    posAttr.needsUpdate = true;
  }

  createCardShaderMaterial(frontTex, rarity) {
    const rarityLevel =
      rarity === 'mythic-holo' ? 1.0 :
      rarity === 'gold-connector' ? 0.85 :
      rarity === 'prismatic-skill' ? 0.72 : 0.52;

    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `;

    const fragmentShader = `
      uniform sampler2D uFrontMap;
      uniform float uTime;
      uniform vec2 uTilt;
      uniform float uRarityLevel;
      uniform float uHovered;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      vec3 spectralRainbow(float x) {
        return 0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67)));
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec4 base = texture2D(uFrontMap, vUv);

        // Identify illustration region & outer border region for holographic foil
        bool inArtBox = (vUv.x > 0.06 && vUv.x < 0.94 && vUv.y > 0.46 && vUv.y < 0.88);
        bool inOuterBorder = (vUv.x < 0.045 || vUv.x > 0.955 || vUv.y < 0.035 || vUv.y > 0.965);

        float tiltFactor = (uTilt.x * 1.4 + uTilt.y * 1.1) + sin(uTime * 0.7) * 0.18;
        float wave = vUv.x * 2.2 + vUv.y * 1.8 + tiltFactor;
        vec3 rainbow = spectralRainbow(wave);

        // Cosmos holo starfield sparkle inside illustration window & border
        vec2 gridUv = floor((vUv + uTilt * 0.08) * 38.0);
        float starSeed = hash21(gridUv);
        float twinkle = pow(max(0.0, sin(uTime * 3.5 + starSeed * 25.0 + tiltFactor * 6.0)), 8.0);
        float cosmosSparkle = step(0.84, starSeed) * twinkle;

        float holoMask = (inArtBox ? 0.34 : 0.08) + (inOuterBorder ? 0.48 : 0.0);
        holoMask *= uRarityLevel * (0.75 + 0.45 * uHovered);

        // Diagonal specular sheen bar
        float sheenPos = fract(uTilt.x * 0.65 - uTilt.y * 0.45 + 0.5);
        float sheen = exp(-pow((vUv.x * 0.75 + vUv.y * 0.55 - sheenPos * 1.3) * 4.5, 2.0));

        vec3 col = base.rgb;
        col = mix(col, col * 0.75 + rainbow * 0.68, holoMask);
        col += rainbow * cosmosSparkle * 0.45 * uRarityLevel;
        col += vec3(1.0, 0.95, 0.82) * sheen * (0.18 + 0.22 * uHovered);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uFrontMap: { value: frontTex },
        uTime: { value: 0 },
        uTilt: { value: new THREE.Vector2(0, 0) },
        uRarityLevel: { value: rarityLevel },
        uHovered: { value: 0 }
      }
    });
  }

  async setPack(pack, resetState = true) {
    this.activePack = pack;
    const packCanvas = await this.forge.renderPackTexture(pack);
    const tex = new THREE.CanvasTexture(packCanvas);
    tex.needsUpdate = true;

    this.packUniformsMain.uMap.value = tex;
    this.packUniformsStrip.uMap.value = tex;
    if (pack.foilTint) {
      this.packUniformsMain.uFoilTint.value.set(pack.foilTint[0], pack.foilTint[1], pack.foilTint[2]);
      this.packUniformsStrip.uFoilTint.value.set(pack.foilTint[0], pack.foilTint[1], pack.foilTint[2]);
    }

    if (resetState) {
      this.resetPackToReady();
    }
  }

  resetPackToReady() {
    this.clearCardMeshes();
    this.state = 'PACK_READY';
    this.ripProgress = 0;
    this.selectedCardIndex = -1;
    this.packUniformsMain.uRipProgress.value = 0;
    this.packUniformsStrip.uRipProgress.value = 0;
    this.packGroup.visible = true;
    this.packGroup.position.set(0, -0.08, 0.25);
    this.packGroup.scale.set(0.9, 0.9, 0.9);
    this.packStripMesh.visible = true;

    if (this.callbacks.onSeamProgress) this.callbacks.onSeamProgress(0);
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(this.state, []);
  }

  clearCardMeshes() {
    this.cardEntries.forEach(entry => {
      this.scene.remove(entry.group);
    });
    this.cardEntries = [];
    this.pulledCards = [];
    this.hoveredCardIdx = -1;
  }

  async triggerPackRip(cardsToPull) {
    if (this.state === 'RIPPING') return;
    this.clearCardMeshes();
    this.pulledCards = cardsToPull || [];

    this.audio.playPackRip();
    this.burstConfettiAtSeam();

    // Build 5 3D Holographic Card Meshes ready to fan out
    const backCanvas = this.forge.renderCardBackTexture();
    const backTex = new THREE.CanvasTexture(backCanvas);

    const cardGeo = new THREE.PlaneGeometry(1.52, 2.13, 1, 1);
    const count = this.pulledCards.length;

    for (let i = 0; i < count; i++) {
      const card = this.pulledCards[i];
      const frontCanvas = await this.forge.renderCardFrontTexture(card);
      const frontTex = new THREE.CanvasTexture(frontCanvas);
      frontTex.needsUpdate = true;

      const frontMat = this.createCardShaderMaterial(frontTex, card.rarity);
      const backMat = new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: 0.4,
        metalness: 0.3
      });

      const group = new THREE.Group();
      const frontMesh = new THREE.Mesh(cardGeo, frontMat);
      frontMesh.userData = { cardIndex: i, card };

      const backMesh = new THREE.Mesh(cardGeo, backMat);
      backMesh.rotation.y = Math.PI;
      backMesh.position.z = -0.01;

      group.add(frontMesh);
      group.add(backMesh);

      // Start inside the booster pack
      group.position.set(0, -0.2, 0.1 - i * 0.03);
      group.scale.set(0.55, 0.55, 0.55);
      this.scene.add(group);

      // Target 5-Card Fan coordinates (comfortably framed inside viewport)
      const spreadIdx = i - (count - 1) / 2; // -2, -1, 0, +1, +2
      const targetPos = new THREE.Vector3(
        spreadIdx * 1.18,
        0.18 - Math.abs(spreadIdx) * 0.11,
        0.55 + (2 - Math.abs(spreadIdx)) * 0.06
      );
      const targetRotZ = -spreadIdx * 0.075;

      this.cardEntries.push({
        card,
        group,
        frontMesh,
        frontMat,
        targetPos,
        targetRotZ,
        revealDelay: 0.15 + i * 0.07
      });
    }

    this.ripStartedAt = performance.now();
    this.ripAnimTime = 0;
    this.state = 'RIPPING';

    if (this.callbacks.onSeamProgress) this.callbacks.onSeamProgress(100);
    if (this.callbacks.onStateChange) this.callbacks.onStateChange('FAN_REVEALED', this.pulledCards);
  }

  focusPulledCard(index) {
    this.selectedCardIndex = index;
    if (index >= 0 && index < this.pulledCards.length) {
      const card = this.pulledCards[index];
      this.audio.playHoloChime(card.rarity);
    }
  }

  bindEvents() {
    const dom = this.renderer.domElement;

    const updatePointer = (clientX, clientY) => {
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    dom.addEventListener('pointerdown', e => {
      updatePointer(e.clientX, e.clientY);
      if (this.state === 'PACK_READY') {
        this.isDraggingSeam = true;
        this.dragStartX = e.clientX;
        this.audio.playFoilCrinkle(0.45);
      } else if (this.state === 'FAN_REVEALED' || this.state === 'RIPPING') {
        // Check if user clicked a fanned 3D card
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const meshes = this.cardEntries.map(c => c.frontMesh);
        const hits = this.raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          const idx = hits[0].object.userData.cardIndex;
          this.focusPulledCard(idx);
          if (this.callbacks.onCardSelect) {
            this.callbacks.onCardSelect(this.pulledCards[idx], idx);
          }
        }
      }
    });

    window.addEventListener('pointermove', e => {
      updatePointer(e.clientX, e.clientY);

      if (this.isDraggingSeam && this.state === 'PACK_READY') {
        const dx = Math.abs(e.clientX - this.dragStartX);
        const step = Math.min(1, this.ripProgress + Math.max(0.02, dx / 220));
        this.ripProgress = step;
        this.dragStartX = e.clientX;
        this.packUniformsMain.uRipProgress.value = this.ripProgress;
        this.packUniformsStrip.uRipProgress.value = this.ripProgress;

        const now = performance.now();
        if (now - this.lastCrinkleAt > 85) {
          this.audio.playFoilCrinkle(0.5);
          this.lastCrinkleAt = now;
        }

        if (this.callbacks.onSeamProgress) {
          this.callbacks.onSeamProgress(Math.round(this.ripProgress * 100));
        }

        if (this.ripProgress >= 0.65) {
          this.isDraggingSeam = false;
          if (this.callbacks.onRequestRip) {
            this.callbacks.onRequestRip();
          }
        }
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingSeam = false;
    });

    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || (window.innerHeight - 60);
    if (w < 10 || h < 10) return;
    this.camera.aspect = w / h;
    // Slightly widen FOV on narrow mobile viewports so all 5 fanned cards fit
    this.camera.fov = w < 680 ? 56 : 40;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  stepSimulation(dt) {
    const elapsed = this.clock.getElapsedTime();

    // Update pack shader uniforms
    this.packUniformsMain.uTime.value = elapsed;
    this.packUniformsStrip.uTime.value = elapsed;
    this.packUniformsMain.uPointer.value.lerp(this.pointer, 0.12);
    this.packUniformsStrip.uPointer.value.lerp(this.pointer, 0.12);

    if (this.state === 'PACK_READY') {
      // Tactile floating + cursor-reactive 3D tilt on the unopened foil pack
      const targetRotY = this.pointer.x * 0.36 + Math.sin(elapsed * 1.1) * 0.06;
      const targetRotX = -this.pointer.y * 0.24 + Math.cos(elapsed * 0.9) * 0.04;
      this.packGroup.rotation.y += (targetRotY - this.packGroup.rotation.y) * 0.1;
      this.packGroup.rotation.x += (targetRotX - this.packGroup.rotation.x) * 0.1;
      this.packGroup.position.y = -0.08 + Math.sin(elapsed * 1.8) * 0.05;
    } else if (this.state === 'RIPPING' || this.state === 'FAN_REVEALED') {
      this.ripAnimTime = (performance.now() - this.ripStartedAt) / 1000;
      const ripT = Math.min(1.0, this.ripAnimTime / 0.38);
      this.packUniformsMain.uRipProgress.value = ripT;
      this.packUniformsStrip.uRipProgress.value = ripT;

      // Slide the ripped wrapper down and back so the 5 holographic cards take center stage
      const packSlide = Math.min(1.0, Math.max(0, (this.ripAnimTime - 0.18) / 0.48));
      this.packGroup.position.y = -0.08 - packSlide * 3.4;
      this.packGroup.position.z = 0.25 - packSlide * 1.6;
      this.packGroup.scale.setScalar(0.9 * (1.0 - packSlide * 0.35));
      if (packSlide >= 0.96) {
        this.packGroup.visible = false;
        this.state = 'FAN_REVEALED';
      }

      // Raycast hover over the 5 fanned cards
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const meshes = this.cardEntries.map(c => c.frontMesh);
      const hits = this.raycaster.intersectObjects(meshes, false);
      this.hoveredCardIdx = hits.length > 0 ? hits[0].object.userData.cardIndex : -1;

      // Animate the 5 pulled cards into their 3D fan arc with holographic tilt
      this.cardEntries.forEach((entry, idx) => {
        const localT = Math.max(0, Math.min(1, (this.ripAnimTime - entry.revealDelay) / 0.48));
        // Cubic ease-out
        const ease = 1 - Math.pow(1 - localT, 3);

        const isHovered = idx === this.hoveredCardIdx;
        const isSelected = idx === this.selectedCardIndex;
        const hoverBoostZ = isHovered ? 0.42 : (isSelected ? 0.18 : 0);
        const hoverBoostY = isHovered ? 0.16 : Math.sin(elapsed * 2.0 + idx) * 0.025;
        const targetScale = isHovered ? 1.09 : (isSelected ? 1.03 : 1.0);

        entry.group.position.x = THREE.MathUtils.lerp(0, entry.targetPos.x, ease);
        entry.group.position.y = THREE.MathUtils.lerp(-0.4, entry.targetPos.y + hoverBoostY, ease);
        entry.group.position.z = THREE.MathUtils.lerp(0.1, entry.targetPos.z + hoverBoostZ, ease);

        const s = THREE.MathUtils.lerp(0.45, targetScale, ease);
        entry.group.scale.setScalar(s);

        const tiltY = isHovered ? this.pointer.x * 0.32 : this.pointer.x * 0.1;
        const tiltX = isHovered ? -this.pointer.y * 0.24 : -this.pointer.y * 0.07;
        const targetZ = isHovered ? 0 : entry.targetRotZ * ease;

        entry.group.rotation.y += (tiltY - entry.group.rotation.y) * 0.2;
        entry.group.rotation.x += (tiltX - entry.group.rotation.x) * 0.2;
        entry.group.rotation.z += (targetZ - entry.group.rotation.z) * 0.2;

        entry.frontMat.uniforms.uTime.value = elapsed;
        entry.frontMat.uniforms.uTilt.value.set(
          entry.group.rotation.y + this.pointer.x * 0.5,
          entry.group.rotation.x + this.pointer.y * 0.5
        );
        entry.frontMat.uniforms.uHovered.value += ((isHovered || isSelected ? 1.0 : 0.35) - entry.frontMat.uniforms.uHovered.value) * 0.2;
      });
    }

    // Animate particles / foil confetti
    if (this.confettiMesh) {
      const posAttr = this.confettiMesh.geometry.attributes.position;
      for (let i = 0; i < this.confettiData.length; i++) {
        const d = this.confettiData[i];
        let x = posAttr.getX(i) + d.vx;
        let y = posAttr.getY(i) + d.vy;
        let z = posAttr.getZ(i) + d.vz;
        if (d.burst) {
          d.vy -= 0.0032; // gravity on foil confetti burst
          if (y < -3.0) {
            d.burst = false;
            d.vx = (Math.random() - 0.5) * 0.01;
            d.vy = Math.random() * 0.01 + 0.003;
            y = -2.2;
          }
        } else if (y > 3.2) {
          y = -2.4;
        }
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.stepSimulation(dt);
  }
}

window.ThreePackStage = ThreePackStage;
