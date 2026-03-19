import React, { useRef, useEffect } from 'react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type SimulationMode = 'normal' | 'malleable' | 'electrical' | 'heat' | 'circuit';

interface CoreElectron {
  angle: number;
  orbitRadius: number;
  angularVelocity: number;
}

interface Cation {
  id: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  row: number;
  col: number;
  temp: number;
  isAlloyB: boolean; 
  coreElectrons: CoreElectron[]; // Bound to the nucleus
}

interface Electron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number; 
  ay: number; 
  state: 'metal'; // Delocalized conduction electrons
}

interface Props {
  mode: SimulationMode;
  isRecording?: boolean;
  animationSpeed: number;
  autoMalleable?: boolean;
  autoDemoSpeed?: number;
  onRecordingComplete?: (blob: Blob) => void;
  onRecordingProgress?: (progress: number) => void;
  temperature?: number;
  voltage?: number;
  showTrails?: boolean;
  particleSpawner?: boolean;
  crystalStructure?: 'square' | 'hexagonal' | 'fcc';
  alloyMix?: number;
  singleLayerMode?: boolean; 
  onParticleSpawn?: () => void;
  onLayerSlide?: () => void;
  theme?: 'light' | 'dark';
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const MAX_RECORD_FRAMES = 480; 
const CATION_RADIUS = 22;
const ELECTRON_RADIUS = 4;
const ROWS = 5;
const COLS = 8;

// Scientific proportion scaling (e.g., representing Copper Z=29)
// Scaled 1:4 to maintain performance while preserving mathematical ratios
// 1 valence electron : 7 core electrons (representing the 28 bound electrons)
const DELOCALIZED_ELECTRONS_PER_CATION = 1;
const CORE_ELECTRONS_PER_CATION = 7;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Bounding box logic to guarantee scaling constraints (60-70% volume utilization in circuit mode)
function getSimulationBounds(mode: SimulationMode) {
  const isCircuit = mode === 'circuit';
  
  if (isCircuit) {
    const circuitMarginX = CANVAS_WIDTH * 0.075;
    const circuitMarginY = CANVAS_HEIGHT * 0.075;
    const availableW = CANVAS_WIDTH - (circuitMarginX * 2);
    const availableH = CANVAS_HEIGHT - (circuitMarginY * 2);
    
    // Metal sample occupies roughly 65% of the inner circuit space
    const sampleW = availableW * 0.65;
    const sampleH = availableH * 0.60;
    
    return { 
      x: CANVAS_WIDTH / 2 - sampleW / 2, 
      y: circuitMarginY, 
      w: sampleW, 
      h: sampleH 
    };
  }
  
  return { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
}

// Visual mapping strictly adhering to the requirements
function getCoreElectronColor(theme: 'light' | 'dark') {
  return theme === 'dark' ? '#ffffff' : '#22c55e'; // White in dark mode, Green in light mode
}

function getDelocalizedElectronColor() {
  return '#38bdf8'; // Always Light Blue (Tailwind sky-400)
}

function getDelocalizedElectronGlowColor() {
  return 'rgba(56, 189, 248, 0.4)'; // Light Blue Glow
}

function spawnMetalElectron(bounds: { x: number; y: number; w: number; h: number }, cations: Cation[]) {
  if (cations.length === 0) {
    return {
      x: bounds.x + Math.random() * bounds.w,
      y: bounds.y + Math.random() * bounds.h,
    };
  }

  // Free electron gas: randomly spawn in interstitial space near cations
  const cation = cations[Math.floor(Math.random() * cations.length)];
  const angle = Math.random() * Math.PI * 2;
  const radius = CATION_RADIUS * (0.8 + Math.random() * 1.5);

  return {
    x: clamp(cation.baseX + Math.cos(angle) * radius, bounds.x + 8, bounds.x + bounds.w - 8),
    y: clamp(cation.baseY + Math.sin(angle) * radius, bounds.y + 8, bounds.y + bounds.h - 8),
  };
}

export default function MetalSimulation({ 
  mode, 
  isRecording, 
  animationSpeed, 
  autoMalleable, 
  autoDemoSpeed = 2, 
  onRecordingComplete, 
  onRecordingProgress,
  temperature = 0,
  voltage = 50,
  showTrails = false,
  particleSpawner = false,
  crystalStructure = 'square',
  alloyMix = 0,
  singleLayerMode = false,
  onParticleSpawn,
  onLayerSlide,
  theme = 'dark'
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cationsRef = useRef<Cation[]>([]);
  const electronsRef = useRef<Electron[]>([]);
  const requestRef = useRef<number>();
  const lastLayoutRef = useRef<'circuit' | 'malleable' | 'normal' | null>(null);
  const autoMalleableTime = useRef<number>(0);
  const heatTimeRef = useRef<number>(0);
  const camRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, zoom: 1 });
  const electronTrailsRef = useRef<{x: number, y: number}[][]>([]);
  const lastCrystalStructureRef = useRef<string>('');
  const animationProgressRef = useRef<number>(1); 
  
  const dragState = useRef({
    isDragging: false,
    dragRow: -1,
    dragStartX: 0
  });

  const gifState = useRef({
    encoder: null as any,
    frameCount: 0
  });

  // Physics Initialization
  useEffect(() => {
    const isCircuit = mode === 'circuit';
    const layoutType = isCircuit ? 'circuit' : (mode === 'malleable' ? 'malleable' : 'normal');
    
    if (cationsRef.current.length === 0 || lastLayoutRef.current !== layoutType) {
      lastLayoutRef.current = layoutType;
      const bounds = getSimulationBounds(mode);
      
      // Determine optimal grid density based on sample volume
      const rows = isCircuit ? 4 : ROWS;
      const cols = isCircuit ? 9 : COLS;
      const spacingX = bounds.w / (cols + 1);
      const spacingY = bounds.h / (rows + 1);

      const cations: Cation[] = [];
      let id = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const baseX = bounds.x + (c + 1) * spacingX;
          const baseY = bounds.y + (r + 1) * spacingY;
          
          // Generate Core Electrons bound to this specific nucleus
          const coreElectrons: CoreElectron[] = [];
          for (let ce = 0; ce < CORE_ELECTRONS_PER_CATION; ce++) {
             coreElectrons.push({
               angle: Math.random() * Math.PI * 2,
               orbitRadius: (CATION_RADIUS * 0.3) + Math.random() * (CATION_RADIUS * 0.5),
               angularVelocity: (Math.random() - 0.5) * 10 + 2
             });
          }

          cations.push({
            id: id++,
            baseX: baseX,
            baseY: baseY,
            targetX: baseX,
            targetY: baseY,
            x: baseX,
            y: baseY,
            row: r,
            col: c,
            temp: 0,
            isAlloyB: false,
            coreElectrons
          });
        }
      }
      cationsRef.current = cations;

      if (alloyMix > 0) {
        const numAlloyB = Math.floor(cations.length * (alloyMix / 100));
        const shuffledIndices = [...Array(cations.length).keys()].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numAlloyB; i++) {
          cationsRef.current[shuffledIndices[i]].isAlloyB = true;
        }
      }

      // Generate Delocalized Electron Gas
      const electrons: Electron[] = [];
      const metalElectronCount = Math.max(
        cations.length,
        Math.round(cations.length * DELOCALIZED_ELECTRONS_PER_CATION)
      );

      for (let i = 0; i < metalElectronCount; i++) {
        const pos = spawnMetalElectron(bounds, cations);
        const vFermi = 200; // High baseline Fermi velocity 
        const angle = Math.random() * Math.PI * 2;
        electrons.push({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(angle) * vFermi,
          vy: Math.sin(angle) * vFermi,
          ax: 0,
          ay: 0,
          state: 'metal',
        });
      }
      electronsRef.current = electrons;
    }
  }, [mode, alloyMix]);

  // Crystal Structure Transitions
  useEffect(() => {
    if (cationsRef.current.length === 0) return;
    
    const isCircuit = mode === 'circuit';
    const bounds = getSimulationBounds(mode);
    const rows = isCircuit ? 4 : ROWS;
    const cols = isCircuit ? 9 : COLS;
    
    const spacingX = bounds.w / (cols + 1);
    const spacingY = bounds.h / (rows + 1);
    
    if (lastCrystalStructureRef.current !== crystalStructure) {
      lastCrystalStructureRef.current = crystalStructure;
      animationProgressRef.current = 0; 
    }
    
    cationsRef.current.forEach(c => {
      const r = c.row;
      const col = c.col;
      
      if (crystalStructure === 'hexagonal') {
        const offset = r % 2 === 1 ? spacingX / 2 : 0;
        c.targetX = bounds.x + (col + 1) * spacingX + offset;
        c.targetY = bounds.y + (r + 1) * spacingY * 0.866; 
      } else if (crystalStructure === 'fcc') {
        const stagger = (r % 2) * (spacingX * 0.25);
        const verticalStagger = (col % 2) * (spacingY * 0.25);
        c.targetX = bounds.x + (col + 1) * spacingX + stagger;
        c.targetY = bounds.y + (r + 1) * spacingY + verticalStagger;
      } else {
        c.targetX = bounds.x + (col + 1) * spacingX;
        c.targetY = bounds.y + (r + 1) * spacingY;
      }
    });
    
    if (alloyMix > 0) {
      const numAlloyB = Math.floor(cationsRef.current.length * (alloyMix / 100));
      cationsRef.current.forEach(c => c.isAlloyB = false);
      const shuffledIndices = [...Array(cationsRef.current.length).keys()].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numAlloyB; i++) {
        cationsRef.current[shuffledIndices[i]].isAlloyB = true;
      }
    } else {
      cationsRef.current.forEach(c => c.isAlloyB = false);
    }
  }, [crystalStructure, mode, alloyMix]);

  // Recording State Handlers
  useEffect(() => {
    if (isRecording && !gifState.current.encoder) {
      gifState.current.encoder = GIFEncoder();
      gifState.current.frameCount = 0;
      onRecordingProgress?.(0);
      
      if (mode === 'heat') {
        heatTimeRef.current = 0;
        cationsRef.current.forEach(c => c.temp = 0);
      }
    } else if (!isRecording && gifState.current.encoder) {
      gifState.current.encoder.finish();
      const buffer = gifState.current.encoder.bytesView();
      const blob = new Blob([buffer], { type: 'image/gif' });
      onRecordingComplete?.(blob);
      gifState.current.encoder = null;
    }
  }, [isRecording, onRecordingComplete, onRecordingProgress, mode]);

  // Main Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (time: number) => {
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;
      const safeDelta = isNaN(deltaSec) ? 0.016 : Math.min(deltaSec, 0.1);

      const cations = cationsRef.current;
      const electrons = electronsRef.current;
      const isCircuit = mode === 'circuit';
      const bounds = getSimulationBounds(mode);

      let targetZoom = 1;
      let targetCamX = CANVAS_WIDTH / 2;
      let targetCamY = CANVAS_HEIGHT / 2;
      let overlayTitle = "";
      let overlayText = "";

      if (mode === 'heat') {
        heatTimeRef.current += safeDelta;
        const totalDuration = 24;
        if (heatTimeRef.current > totalDuration) {
          heatTimeRef.current = 0;
          cations.forEach(c => c.temp = 0);
        }

        const t = heatTimeRef.current;
        if (t < 4) {
          overlayTitle = "1. Heat Source Applied";
          overlayText = "Heat energy is applied to the left side of the metal.";
        } else if (t < 9) {
          targetZoom = 3.5;
          targetCamX = cations[0].x;
          targetCamY = cations[0].y;
          overlayTitle = "2. Metal Cations Vibrate";
          overlayText = "Cations absorb energy and vibrate vigorously in their fixed lattice positions.";
        } else if (t < 14) {
          targetZoom = 4;
          targetCamX = cations[0].x + SPACING_X / 2;
          targetCamY = cations[0].y + (bounds.h / (ROWS + 1)) / 2;
          overlayTitle = "3. Delocalized Electrons";
          overlayText = "Free electrons gain kinetic energy and zip around much faster.";
        } else if (t < 19) {
          targetZoom = 1.8;
          targetCamX = CANVAS_WIDTH / 2;
          targetCamY = CANVAS_HEIGHT / 2;
          overlayTitle = "4. Energy Transfer";
          overlayText = "Fast electrons collide with other particles, rapidly spreading heat across the metal.";
        } else {
          overlayTitle = "High Heat Conductivity";
          overlayText = "This dual-action (vibrating cations + mobile electrons) makes metals excellent conductors.";
        }
      } else {
        heatTimeRef.current = 0;
        targetZoom = 1;
        targetCamX = CANVAS_WIDTH / 2;
        targetCamY = CANVAS_HEIGHT / 2;
      }

      camRef.current.x += (targetCamX - camRef.current.x) * 0.05;
      camRef.current.y += (targetCamY - camRef.current.y) * 0.05;
      camRef.current.zoom += (targetZoom - camRef.current.zoom) * 0.05;

      // Substitutional Solid Solution Strengthening Logic
      // Radius mismatch increases layer friction
      const alloyFrictionFactor = 1 - (alloyMix / 100) * 0.50; // up to 50% slowdown

      if (mode === 'malleable' && autoMalleable) {
        autoMalleableTime.current += 0.02 * Math.max(0.5, Math.min(autoDemoSpeed, 5)) * alloyFrictionFactor;
        const shift = Math.sin(autoMalleableTime.current) * 60;
        
        cations.forEach(c => {
          const originalBaseX = (c.col + 1) * (bounds.w / (COLS + 1));
          if (c.row <= 1) {
            c.baseX = originalBaseX + shift;
          } else if (c.row === 2) {
            c.baseX = originalBaseX + shift * 0.5;
          } else {
            c.baseX = originalBaseX;
          }
        });
      }

      // Physics Iteration
      const dt = safeDelta * animationSpeed;
      const isElectric = (mode === 'electrical' || mode === 'circuit');
      
      let avgTemp = 0;
      cations.forEach(c => avgTemp += c.temp);
      avgTemp /= cations.length || 1;
      const globalBaseTemp = temperature / 100;

      const circuitResistance = 10 + ((mode === 'heat' ? avgTemp : globalBaseTemp) * 25); 
      const currentMagnitude = isElectric ? (voltage / circuitResistance) : 0; 
      const eFieldForceX = isElectric ? (voltage / 50) * 1500 : 0; 

      cations.forEach(c => {
        const lerpSpeed = 0.08;
        c.baseX += (c.targetX - c.baseX) * lerpSpeed;
        c.baseY += (c.targetY - c.baseY) * lerpSpeed;
        
        const localTemp = mode === 'heat' ? c.temp : globalBaseTemp;
        const amplitude = 1.5 + localTemp * 8;
        
        // Cation Vibration
        c.x = c.baseX + (Math.random() - 0.5) * amplitude * Math.min(safeDelta * 10, 5);
        c.y = c.baseY + (Math.random() - 0.5) * amplitude * Math.min(safeDelta * 10, 5);
        
        // Update Core Electrons
        c.coreElectrons.forEach(ce => {
            ce.angle += ce.angularVelocity * dt;
        });

        if (mode === 'heat') {
          const t = heatTimeRef.current;
          const delay = c.col * 1.5; 
          if (t > delay) {
              c.temp = Math.min(1, (t - delay) / 4); 
          } else {
              c.temp = 0;
          }
        } else {
          c.temp *= Math.pow(0.95, safeDelta); 
        }
      });

      // Drude Model Implementation for Delocalized Electron Gas
      const baseTau = 0.08; 

      electrons.forEach(e => {
        let localTemp = globalBaseTemp;
        if (mode === 'heat') {
          let minDist = Infinity;
          cations.forEach(c => {
            const dist = Math.hypot(e.x - c.x, e.y - c.y);
            if (dist < minDist) { minDist = dist; localTemp = c.temp; }
          });
        }

        const tau = baseTau / (1 + localTemp * 5); 
        const collisionProb = 1 - Math.exp(-dt / tau);

        // Velocity Verlet Integration
        e.x += e.vx * dt + 0.5 * e.ax * dt * dt;
        e.y += e.vy * dt + 0.5 * e.ay * dt * dt;

        const newAx = eFieldForceX;
        const newAy = 0;

        e.vx += 0.5 * (e.ax + newAx) * dt;
        e.vy += 0.5 * (e.ay + newAy) * dt;

        e.ax = newAx;
        e.ay = newAy;

        // Electron-Lattice Scattering
        if (Math.random() < collisionProb) {
          const vFermi = 200; 
          const vThermal = vFermi + localTemp * 400; 
          const angle = Math.random() * Math.PI * 2;
          
          e.vx = Math.cos(angle) * vThermal;
          e.vy = Math.sin(angle) * vThermal;
        }

        // Circuit Boundary Wrapping vs Box Collision
        if (mode === 'circuit') {
          if (e.x > bounds.x + bounds.w) e.x -= bounds.w;
          if (e.x < bounds.x) e.x += bounds.w;
          if (e.y > bounds.y + bounds.h) { e.y = bounds.y + bounds.h; e.vy *= -1; }
          if (e.y < bounds.y) { e.y = bounds.y; e.vy *= -1; }
        } else {
          if (e.x > bounds.x + bounds.w) { e.x = bounds.x + bounds.w; e.vx *= -1; }
          if (e.x < bounds.x) { e.x = bounds.x; e.vx *= -1; }
          if (e.y > bounds.y + bounds.h) { e.y = bounds.y + bounds.h; e.vy *= -1; }
          if (e.y < bounds.y) { e.y = bounds.y; e.vy *= -1; }
        }
      });

      // --- RENDERING ---
      const isLight = theme === 'light';
      ctx.fillStyle = isLight ? '#f1f5f9' : '#1e293b'; 
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(camRef.current.zoom, camRef.current.zoom);
      ctx.translate(-camRef.current.x, -camRef.current.y);

      if (mode === 'heat') {
        const gradient = ctx.createLinearGradient(0, 0, 220, 0);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
        gradient.addColorStop(0.3, 'rgba(239, 68, 68, 0.25)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 220, CANVAS_HEIGHT);
      }

      if (isCircuit) {
        const circuitMarginX = CANVAS_WIDTH * 0.075;
        const circuitMarginY = CANVAS_HEIGHT * 0.075;
        
        const wireTopY = bounds.y + bounds.h / 2;
        const wireBottomY = CANVAS_HEIGHT - circuitMarginY;
        const wireLeftX = circuitMarginX;
        const wireRightX = CANVAS_WIDTH - circuitMarginX;

        // Current Density Field Gradient
        const currentActiveColor = isLight ? 'rgba(56, 189, 248, 0.9)' : 'rgba(125, 211, 252, 0.9)'; // Sky blue current line
        const wireColor = isLight ? '#cbd5e1' : '#475569';

        // Draw solid wire casing
        ctx.strokeStyle = wireColor; 
        ctx.lineWidth = 14;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        // Right wire path
        ctx.moveTo(bounds.x + bounds.w, wireTopY);
        ctx.lineTo(wireRightX, wireTopY);
        ctx.lineTo(wireRightX, wireBottomY);
        ctx.lineTo(CANVAS_WIDTH / 2 + 50, wireBottomY);
        
        // Left wire path
        ctx.moveTo(CANVAS_WIDTH / 2 - 50, wireBottomY);
        ctx.lineTo(wireLeftX, wireBottomY);
        ctx.lineTo(wireLeftX, wireTopY);
        ctx.lineTo(bounds.x, wireTopY);
        ctx.stroke();

        // Draw Current Vector Field Overlay (Glowing Solid Line indicating flow strength)
        if (voltage > 0) {
            ctx.strokeStyle = currentActiveColor;
            ctx.lineWidth = 4 + (currentMagnitude * 1.5); // Thickness indicates strength
            ctx.lineJoin = 'round';
            ctx.shadowColor = getDelocalizedElectronColor();
            ctx.shadowBlur = 10 + currentMagnitude * 20;

            ctx.beginPath();
            ctx.moveTo(bounds.x + bounds.w, wireTopY);
            ctx.lineTo(wireRightX, wireTopY);
            ctx.lineTo(wireRightX, wireBottomY);
            ctx.lineTo(CANVAS_WIDTH / 2 + 50, wireBottomY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(CANVAS_WIDTH / 2 - 50, wireBottomY);
            ctx.lineTo(wireLeftX, wireBottomY);
            ctx.lineTo(wireLeftX, wireTopY);
            ctx.lineTo(bounds.x, wireTopY);
            ctx.stroke();
            
            ctx.shadowBlur = 0; // Reset
        }

        // Electrodes
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(bounds.x - 4, bounds.y, 8, bounds.h);
        ctx.fillRect(bounds.x + bounds.w - 4, bounds.y, 8, bounds.h);

        // Battery
        ctx.fillStyle = '#334155';
        ctx.fillRect(CANVAS_WIDTH / 2 - 50, wireBottomY - 20, 100, 40); 
        ctx.fillStyle = '#ef4444'; 
        ctx.fillRect(CANVAS_WIDTH / 2 + 50, wireBottomY - 10, 10, 20);
        ctx.fillStyle = '#cbd5e1'; 
        ctx.fillRect(CANVAS_WIDTH / 2 - 60, wireBottomY - 10, 10, 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BATTERY', CANVAS_WIDTH / 2, wireBottomY);
        ctx.font = 'bold 18px Inter';
        ctx.fillText('+', CANVAS_WIDTH / 2 + 40, wireBottomY);
        ctx.fillText('-', CANVAS_WIDTH / 2 - 40, wireBottomY);

        // Light Bulb
        const bulbIntensity = Math.min(1, currentMagnitude / 3.5); 
        ctx.fillStyle = `rgba(251, 191, 36, ${0.1 + bulbIntensity * 0.9})`; 
        ctx.beginPath();
        ctx.arc(wireRightX, wireTopY + (wireBottomY - wireTopY) / 2, 28, 0, Math.PI * 2); 
        ctx.fill();
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10 + bulbIntensity * 50;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#64748b';
        ctx.fillRect(wireRightX - 12, wireTopY + (wireBottomY - wireTopY) / 2 + 28, 24, 20);
      }

      // Draw Metal Box Background
      const metalBgColor = isLight ? '#e2e8f0' : '#0f172a';
      ctx.fillStyle = metalBgColor;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

      // Draw Cations and Core Electrons
      const coreFill = getCoreElectronColor(theme);

      cations.forEach(c => {
        let cationRadius = CATION_RADIUS;
        let fillColor = '#ef4444'; 
        let strokeColor = '#991b1b';
        let labelText = '+';
        
        // Substitutional Alloy logic (15% radius variance)
        if (c.isAlloyB) {
          cationRadius = CATION_RADIUS * 1.15; 
          if (c.temp > 0.01) {
            const r = 245;
            const g = Math.floor(158 + c.temp * 97);
            const b = Math.floor(58 + c.temp * 197);
            fillColor = `rgb(${r}, ${g}, ${b})`;
          } else {
            fillColor = '#f59e0b'; 
          }
          strokeColor = '#b45309';
        } else if (c.temp > 0.01) {
          const r = 239;
          const g = Math.floor(68 + c.temp * 180);
          const b = Math.floor(68 + c.temp * 180);
          fillColor = `rgb(${r}, ${g}, ${b})`;
        }
        
        // Nucleus
        ctx.beginPath();
        ctx.arc(c.x, c.y, cationRadius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${cationRadius * 0.9}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, c.x, c.y);

        // Core Electrons
        c.coreElectrons.forEach(ce => {
            const cx = c.x + Math.cos(ce.angle) * ce.orbitRadius;
            const cy = c.y + Math.sin(ce.angle) * ce.orbitRadius;
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = coreFill;
            ctx.fill();
        });
      });

      // Draw Delocalized Electron Trails
      if (showTrails && electronTrailsRef.current.length !== electrons.length) {
        electronTrailsRef.current = electrons.map(() => []);
      }
      
      if (showTrails) {
        electrons.forEach((e, i) => {
          if (!electronTrailsRef.current[i]) electronTrailsRef.current[i] = [];
          electronTrailsRef.current[i].push({ x: e.x, y: e.y });
          if (electronTrailsRef.current[i].length > 15) {
            electronTrailsRef.current[i].shift();
          }
          
          const trail = electronTrailsRef.current[i];
          if (trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let j = 1; j < trail.length; j++) {
              ctx.lineTo(trail[j].x, trail[j].y);
            }
            ctx.strokeStyle = getElectronTrailColor(theme);
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      } else {
        electronTrailsRef.current = [];
      }
      
      // Draw Delocalized Electrons (Electron Gas)
      const delocFillColor = getDelocalizedElectronColor();
      const delocGlowColor = getDelocalizedElectronGlowColor();

      electrons.forEach((e) => {
        ctx.save();
        ctx.shadowColor = delocGlowColor;
        ctx.shadowBlur = 12;

        // Inner Glow
        ctx.beginPath();
        ctx.fillStyle = delocGlowColor;
        ctx.arc(e.x, e.y, ELECTRON_RADIUS + 4, 0, Math.PI * 2);
        ctx.fill();

        // Core Body
        ctx.beginPath();
        ctx.arc(e.x, e.y, ELECTRON_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = delocFillColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(12, 74, 110, 0.9)'; // Dark slate border for contrast
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#0f172a';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('-', e.x, e.y);
        ctx.restore();
      });

      ctx.restore();

      // Overlay text for Heat Mode
      if (mode === 'heat' && overlayTitle) {
        ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(20, CANVAS_HEIGHT - 80, CANVAS_WIDTH - 40, 60);  
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, CANVAS_HEIGHT - 80, CANVAS_WIDTH - 40, 60);

        ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(overlayTitle, 40, CANVAS_HEIGHT - 70);

        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8'; 
        ctx.font = '13px Inter, sans-serif';
        ctx.fillText(overlayText, 40, CANVAS_HEIGHT - 48, CANVAS_WIDTH - 80);
        
        const totalDuration = 24; 
        const progress = (heatTimeRef.current % totalDuration) / totalDuration;
        ctx.fillStyle = '#ef4444'; 
        ctx.fillRect(20, CANVAS_HEIGHT - 20, (CANVAS_WIDTH - 40) * progress, 3);
      }

      // Handle GIF Recording
      if (isRecording && gifState.current.encoder) {
        if (gifState.current.frameCount % 2 === 0) {
          const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          const palette = quantize(imageData.data, 256);
          const index = applyPalette(imageData.data, palette);
          gifState.current.encoder.writeFrame(index, CANVAS_WIDTH, CANVAS_HEIGHT, { palette, delay: 33 });
          
          const maxRecordFrames = mode === 'heat' ? 1440 : MAX_RECORD_FRAMES;
          const recordedFrames = gifState.current.frameCount / 2;
          onRecordingProgress?.(recordedFrames / (maxRecordFrames / 2));
          
          if (gifState.current.frameCount >= maxRecordFrames) {
            gifState.current.encoder.finish();
            const buffer = gifState.current.encoder.bytesView();
            const blob = new Blob([buffer], { type: 'image/gif' });
            onRecordingComplete?.(blob);
            gifState.current.encoder = null;
          }
        }
        gifState.current.frameCount++;
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mode, isRecording, animationSpeed, autoMalleable, autoDemoSpeed, singleLayerMode, onRecordingComplete, onRecordingProgress, onLayerSlide, temperature, voltage, showTrails, particleSpawner, crystalStructure, alloyMix, theme]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'malleable' || autoMalleable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const clickedCation = cationsRef.current.find(c => Math.hypot(c.x - x, c.y - y) < CATION_RADIUS * 1.5);
    if (clickedCation) {
      dragState.current.isDragging = true;
      dragState.current.dragRow = clickedCation.row;
      dragState.current.dragStartX = x;
      if (!autoMalleable) {
        onLayerSlide?.();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.current.isDragging || mode !== 'malleable' || autoMalleable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    
    const x = (e.clientX - rect.left) * scaleX;
    
    // Substitutional Solid Solution Strengthening Logic
    const alloyFrictionFactor = 1 - (alloyMix / 100) * 0.50; // Harder to move based on mismatch
    const dx = (x - dragState.current.dragStartX) * alloyFrictionFactor;
    dragState.current.dragStartX = x;
    
    cationsRef.current.forEach(c => {
      if (singleLayerMode) {
        if (c.row === dragState.current.dragRow) {
          c.baseX += dx;
          c.targetX += dx;
        }
      } else {
        if (c.row <= dragState.current.dragRow) {
          c.baseX += dx;
          c.targetX += dx;
        }
      }
    });
  };

  const handleMouseUp = () => {
    dragState.current.isDragging = false;
    dragState.current.dragRow = -1;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!particleSpawner) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const adjustedX = (x - CANVAS_WIDTH / 2) / camRef.current.zoom + camRef.current.x;
    const adjustedY = (y - CANVAS_HEIGHT / 2) / camRef.current.zoom + camRef.current.y;
    
    electronsRef.current.push({
      x: clamp(adjustedX, 8, CANVAS_WIDTH - 8),
      y: clamp(adjustedY, 8, CANVAS_HEIGHT - 8),
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      ax: 0,
      ay: 0,
      state: 'metal',
    });
    
    if (showTrails) {
      electronTrailsRef.current.push([]);
    }
    
    onParticleSpawn?.();
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className={`w-full max-w-full rounded-xl shadow-lg border border-slate-700 ${mode === 'malleable' && !autoMalleable ? 'cursor-grab active:cursor-grabbing' : ''} ${particleSpawner ? 'cursor-crosshair' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as any);
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as any);
      }}
      onTouchEnd={handleMouseUp}
    />
  );
}