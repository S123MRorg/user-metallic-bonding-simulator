import React, { useRef, useEffect, useState } from 'react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type SimulationMode = 'normal' | 'malleable' | 'electrical' | 'heat' | 'circuit';

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
  isAlloyB: boolean; // true if this is a Metal B atom in an alloy
}

interface Electron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speedMultiplier: number;
  state: 'metal' | 'wire';
  wireProgress?: number;
  exitY?: number;
  entryY?: number;
}

interface Props {
  mode: SimulationMode;
  isRecording?: boolean;
  animationSpeed: number;
  autoMalleable?: boolean;
  onRecordingComplete?: (blob: Blob) => void;
  onRecordingProgress?: (progress: number) => void;
  temperature?: number;
  voltage?: number;
  showTrails?: boolean;
  particleSpawner?: boolean;
  crystalStructure?: 'square' | 'hexagonal' | 'fcc';
  alloyMix?: number;
  singleLayerMode?: boolean; // Toggle for single vs multi-layer sliding
  onParticleSpawn?: () => void;
  onLayerSlide?: () => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const MAX_RECORD_FRAMES = 480; // 240 frames at 30fps = 8 seconds.
const CATION_RADIUS = 20;
const ELECTRON_RADIUS = 5;
const ROWS = 5;
const COLS = 8;
const SPACING_X = CANVAS_WIDTH / (COLS + 1);
const SPACING_Y = CANVAS_HEIGHT / (ROWS + 1);

function getWirePos(progress: number, exitY: number, entryY: number) {
  if (progress < 30) return { x: 450, y: exitY + (175 - exitY) * (progress / 30) };
  progress -= 30;
  
  if (progress < 70) return { x: 450 + progress, y: 175 };
  progress -= 70;
  if (progress < 145) return { x: 520, y: 175 + progress };
  progress -= 145;
  if (progress < 440) return { x: 520 - progress, y: 320 };
  progress -= 440;
  if (progress < 145) return { x: 80, y: 320 - progress };
  progress -= 145;
  if (progress < 70) return { x: 80 + progress, y: 175 };
  progress -= 70;
  
  if (progress < 30) return { x: 150, y: 175 + (entryY - 175) * (progress / 30) };
  return { x: 150, y: entryY };
}

export default function MetalSimulation({ 
  mode, 
  isRecording, 
  animationSpeed, 
  autoMalleable, 
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
  onLayerSlide
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
  const animationProgressRef = useRef<number>(1); // For smooth crystal transitions
  
  // Dragging state for malleable mode
  const dragState = useRef({
    isDragging: false,
    dragRow: -1,
    dragStartX: 0
  });

  // GIF Recording state
  const gifState = useRef({
    encoder: null as any,
    frameCount: 0
  });

  // Initialize particles
  useEffect(() => {
    const isCircuit = mode === 'circuit';
    const layoutType = isCircuit ? 'circuit' : (mode === 'malleable' ? 'malleable' : 'normal');
    
    if (cationsRef.current.length === 0 || lastLayoutRef.current !== layoutType) {
      lastLayoutRef.current = layoutType;
      
      const bounds = isCircuit ? { x: 150, y: 100, w: 300, h: 150 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
      const rows = isCircuit ? 3 : ROWS;
      const cols = isCircuit ? 6 : COLS;
      const spacingX = bounds.w / (cols + 1);
      const spacingY = bounds.h / (rows + 1);

      const cations: Cation[] = [];
      let id = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const baseX = bounds.x + (c + 1) * spacingX;
          const baseY = bounds.y + (r + 1) * spacingY;
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
          });
        }
      }
      cationsRef.current = cations;

      // Initialize alloy types based on alloyMix
      if (alloyMix > 0) {
        const numAlloyB = Math.floor(cations.length * (alloyMix / 100));
        const shuffledIndices = [...Array(cations.length).keys()].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numAlloyB; i++) {
          cationsRef.current[shuffledIndices[i]].isAlloyB = true;
        }
      }

      const electrons: Electron[] = [];
      const numElectrons = mode === 'malleable' ? 60 : 150;
      for (let i = 0; i < numElectrons; i++) {
        electrons.push({
          x: bounds.x + Math.random() * bounds.w,
          y: bounds.y + Math.random() * bounds.h,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          speedMultiplier: 1,
          state: 'metal',
        });
      }
      
      if (isCircuit) {
        for (let i = 0; i < 60; i++) {
          const progress = Math.random() * 930;
          electrons.push({
            x: 0, y: 0, vx: 0, vy: 0, speedMultiplier: 1, 
            state: 'wire', 
            wireProgress: progress,
            exitY: bounds.y + Math.random() * bounds.h,
            entryY: bounds.y + Math.random() * bounds.h
          });
        }
      }
      electronsRef.current = electrons;
    }
  }, [mode]);

  // Handle crystal structure changes with smooth transitions
  useEffect(() => {
    if (cationsRef.current.length === 0) return;
    
    const isCircuit = mode === 'circuit';
    const bounds = isCircuit ? { x: 150, y: 100, w: 300, h: 150 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
    const rows = isCircuit ? 3 : ROWS;
    const cols = isCircuit ? 6 : COLS;
    
    const spacingX = bounds.w / (cols + 1);
    const spacingY = bounds.h / (rows + 1);
    
    // Trigger animation when crystal structure changes
    const structureChanged = lastCrystalStructureRef.current !== crystalStructure;
    if (structureChanged) {
      lastCrystalStructureRef.current = crystalStructure;
      animationProgressRef.current = 0; // Start animation
    }
    
    // Update target positions based on crystal structure
    cationsRef.current.forEach((c, i) => {
      const r = c.row;
      const col = c.col;
      
      if (crystalStructure === 'hexagonal') {
        // Hexagonal close packing - offset every other row
        const offset = r % 2 === 1 ? spacingX / 2 : 0;
        c.targetX = bounds.x + (col + 1) * spacingX + offset;
        c.targetY = bounds.y + (r + 1) * spacingY * 0.866; // Close packing factor
      } else if (crystalStructure === 'fcc') {
        // Face-centered cubic - proper 2D projection
        // In FCC, atoms are at corners + face centers
        // For 2D visualization: stagger rows like a distorted square lattice
        const stagger = (r % 2) * (spacingX * 0.25);
        const verticalStagger = (col % 2) * (spacingY * 0.25);
        c.targetX = bounds.x + (col + 1) * spacingX + stagger;
        c.targetY = bounds.y + (r + 1) * spacingY + verticalStagger;
      } else {
        // Square lattice (default)
        c.targetX = bounds.x + (col + 1) * spacingX;
        c.targetY = bounds.y + (r + 1) * spacingY;
      }
    });
    
    // Handle alloy mix changes - re-randomize alloy atoms
    if (alloyMix > 0) {
      const numAlloyB = Math.floor(cationsRef.current.length * (alloyMix / 100));
      // Reset all first
      cationsRef.current.forEach(c => c.isAlloyB = false);
      // Then randomly assign
      const shuffledIndices = [...Array(cationsRef.current.length).keys()].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numAlloyB; i++) {
        cationsRef.current[shuffledIndices[i]].isAlloyB = true;
      }
    } else {
      cationsRef.current.forEach(c => c.isAlloyB = false);
    }
  }, [crystalStructure, mode, alloyMix]);

  // Handle Recording State Changes
  useEffect(() => {
    if (isRecording && !gifState.current.encoder) {
      gifState.current.encoder = GIFEncoder();
      gifState.current.frameCount = 0;
      onRecordingProgress?.(0);
      
      // Reset heat animation if we are in heat mode to capture the full tour
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
      const bounds = isCircuit ? { x: 150, y: 100, w: 300, h: 150 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };

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
          targetCamY = cations[0].y + SPACING_Y / 2;
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

      // Smooth camera interpolation
      camRef.current.x += (targetCamX - camRef.current.x) * 0.05;
      camRef.current.y += (targetCamY - camRef.current.y) * 0.05;
      camRef.current.zoom += (targetZoom - camRef.current.zoom) * 0.05;

      if (mode === 'malleable' && autoMalleable) {
        autoMalleableTime.current += 0.02 * Math.max(0.5, Math.min(animationSpeed, 5));
        const shift = Math.sin(autoMalleableTime.current) * 60;
        
        cations.forEach(c => {
          const originalBaseX = (c.col + 1) * SPACING_X;
          if (c.row <= 1) {
            c.baseX = originalBaseX + shift;
          } else if (c.row === 2) {
            c.baseX = originalBaseX + shift * 0.5;
          } else {
            c.baseX = originalBaseX;
          }
        });
      }

      const updatePhysics = (dt: number) => {
        // Update Cations
        cations.forEach(c => {
          // Smooth interpolation for crystal structure transitions
          const lerpSpeed = 0.08;
          c.baseX += (c.targetX - c.baseX) * lerpSpeed;
          c.baseY += (c.targetY - c.baseY) * lerpSpeed;
          
          // Vibration amplitude based on temperature (global + local)
          const globalTemp = temperature / 100; // 0-1 from prop
          const amplitude = mode === 'heat' ? 1 + c.temp * 8 : 1.5 + globalTemp * 8;
          
          // Return to base position slightly if not dragged
          c.x = c.baseX + (Math.random() - 0.5) * amplitude * Math.min(dt, 5);
          c.y = c.baseY + (Math.random() - 0.5) * amplitude * Math.min(dt, 5);
          
          if (mode === 'heat') {
            const t = heatTimeRef.current;
            // Heat spreads from left to right over time, perfectly synced with the tour
            const delay = c.col * 1.5; // Each column starts heating 1.5s after the previous
            if (t > delay) {
               c.temp = Math.min(1, (t - delay) / 4); // Takes 4 seconds to fully heat up
            } else {
               c.temp = 0;
            }
          } else {
            // Cool down
            c.temp *= Math.pow(0.95, dt);
          }
        });

        // Update Electrons
        electrons.forEach(e => {
          let currentSpeedMult = dt;
          
          if (e.state === 'wire') {
             // Move along wire
             e.wireProgress! += 4 * dt; // wire speed
             if (e.wireProgress! >= 930) {
                e.state = 'metal';
                e.x = 150;
                e.y = e.entryY!;
                e.vx = 2; // initial velocity entering metal
                e.vy = (Math.random() - 0.5) * 2;
             } else {
                const pos = getWirePos(e.wireProgress!, e.exitY!, e.entryY!);
                e.x = pos.x;
                e.y = pos.y;
             }
             return; // skip metal physics
          }

          if (mode === 'heat') {
            // Find nearest cation temperature to increase electron speed
            let nearestTemp = 0;
            let minDist = Infinity;
            cations.forEach(c => {
              const d = Math.hypot(c.x - e.x, c.y - e.y);
              if (d < minDist) {
                minDist = d;
                nearestTemp = c.temp;
              }
            });
            currentSpeedMult = dt * (1 + nearestTemp * 2);
          }

          if (mode === 'electrical' || mode === 'circuit') {
            // Apply electric field (force to the right) - voltage affects acceleration
            const voltageMultiplier = voltage / 50; // 0-2 range
            e.vx += 0.5 * dt * voltageMultiplier;
            if (e.vx > 8 * voltageMultiplier) e.vx = 8 * voltageMultiplier; // Terminal velocity
            e.vy += (Math.random() - 0.5) * 1 * dt; // Some random vertical movement
            
            // Dampen vertical velocity
            e.vy *= Math.pow(0.9, dt);
          } else {
            // Random walk
            e.vx += (Math.random() - 0.5) * 1.5 * dt;
            e.vy += (Math.random() - 0.5) * 1.5 * dt;
            
            // Normalize speed
            const currentSpeed = Math.hypot(e.vx, e.vy);
            const maxSpeed = 3;
            if (currentSpeed > maxSpeed) {
              e.vx = (e.vx / currentSpeed) * maxSpeed;
              e.vy = (e.vy / currentSpeed) * maxSpeed;
            }
          }

          e.x += e.vx * currentSpeedMult;
          e.y += e.vy * currentSpeedMult;

          // Boundary collision
          if (mode === 'electrical') {
            if (e.x > bounds.x + bounds.w) e.x = bounds.x + (e.x % bounds.w);
            if (e.x < bounds.x) e.x = bounds.x + bounds.w + (e.x % bounds.w);
            if (e.y > bounds.y + bounds.h) { e.y = bounds.y + bounds.h; e.vy *= -1; }
            if (e.y < bounds.y) { e.y = bounds.y; e.vy *= -1; }
          } else if (mode === 'circuit') {
            if (e.x >= bounds.x + bounds.w) {
               // Enter wire!
               e.state = 'wire';
               e.wireProgress = 0;
               e.exitY = e.y;
               e.entryY = bounds.y + Math.random() * bounds.h;
            }
            if (e.x < bounds.x) { e.x = bounds.x; e.vx *= -1; }
            if (e.y > bounds.y + bounds.h) { e.y = bounds.y + bounds.h; e.vy *= -1; }
            if (e.y < bounds.y) { e.y = bounds.y; e.vy *= -1; }
          } else {
            if (e.x > bounds.x + bounds.w) { e.x = bounds.x + bounds.w; e.vx *= -1; }
            if (e.x < bounds.x) { e.x = bounds.x; e.vx *= -1; }
            if (e.y > bounds.y + bounds.h) { e.y = bounds.y + bounds.h; e.vy *= -1; }
            if (e.y < bounds.y) { e.y = bounds.y; e.vy *= -1; }
          }
        });
      };

      // Step physics multiple times if animationSpeed is high to prevent tunneling
      let remainingSpeed = animationSpeed;
      while (remainingSpeed > 0) {
        const step = Math.min(remainingSpeed, 2);
        updatePhysics(step);
        remainingSpeed -= step;
      }

      // Draw Background
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(camRef.current.zoom, camRef.current.zoom);
      ctx.translate(-camRef.current.x, -camRef.current.y);

      if (mode === 'heat') {
        const gradient = ctx.createLinearGradient(0, 0, 150, 0);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)'); // red-500
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 150, CANVAS_HEIGHT);
      }

      if (isCircuit) {
        // Draw wires
        ctx.strokeStyle = '#94a3b8'; // slate-400
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Right wire
        ctx.moveTo(450, 175);
        ctx.lineTo(520, 175);
        ctx.lineTo(520, 320);
        ctx.lineTo(350, 320); // to battery
        // Left wire
        ctx.moveTo(250, 320); // from battery
        ctx.lineTo(80, 320);
        ctx.lineTo(80, 175);
        ctx.lineTo(150, 175);
        ctx.stroke();

        // Draw Electrodes
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(146, 100, 4, 150);
        ctx.fillRect(450, 100, 4, 150);

        // Draw Battery
        ctx.fillStyle = '#334155';
        ctx.fillRect(250, 300, 100, 40);
        ctx.fillStyle = '#ef4444'; // positive terminal
        ctx.fillRect(350, 310, 10, 20);
        ctx.fillStyle = '#cbd5e1'; // negative terminal
        ctx.fillRect(240, 310, 10, 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BATTERY', 300, 320);
        ctx.font = 'bold 20px Inter';
        ctx.fillText('+', 345, 320);
        ctx.fillText('-', 255, 320);

        // Draw Light Bulb
        ctx.fillStyle = '#fbbf24'; // amber-400 (glowing)
        ctx.beginPath();
        ctx.arc(520, 247, 20, 0, Math.PI * 2);
        ctx.fill();
        // Bulb glow
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
        
        // Bulb base
        ctx.fillStyle = '#64748b';
        ctx.fillRect(510, 267, 20, 15);

        // Draw Metal Background
        ctx.fillStyle = '#0f172a'; // darker slate for metal background
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
        
        // Label
        ctx.fillStyle = '#64748b';
        ctx.font = '12px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('METAL WIRE / MATERIAL', bounds.x + 10, bounds.y - 10);
      }

      // Draw Cations
      cations.forEach(c => {
        // Determine cation properties based on alloy type
        let cationRadius = CATION_RADIUS;
        let fillColor = '#ef4444'; // red-500 (Metal A)
        let strokeColor = '#991b1b';
        let labelText = '+';
        
        if (c.isAlloyB) {
          // Metal B in alloy - show as gold/amber color
          cationRadius = CATION_RADIUS * 1.15; // Slightly larger
          if (c.temp > 0.01) {
            // Interpolate from gold to white based on temp
            const r = 245;
            const g = Math.floor(158 + c.temp * 97);
            const b = Math.floor(58 + c.temp * 197);
            fillColor = `rgb(${r}, ${g}, ${b})`;
          } else {
            fillColor = '#f59e0b'; // amber-500 (Metal B)
          }
          strokeColor = '#b45309';
        } else if (c.temp > 0.01) {
          // Interpolate from red to yellow/white based on temp
          const r = 239;
          const g = Math.floor(68 + c.temp * 180);
          const b = Math.floor(68 + c.temp * 180);
          fillColor = `rgb(${r}, ${g}, ${b})`;
        }
        
        ctx.beginPath();
        ctx.arc(c.x, c.y, cationRadius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${cationRadius}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, c.x, c.y);
      });

      // Draw Electrons
      // Initialize trails if needed
      if (showTrails && electronTrailsRef.current.length !== electrons.length) {
        electronTrailsRef.current = electrons.map(() => []);
      }
      
      // Update and draw trails
      if (showTrails) {
        electrons.forEach((e, i) => {
          if (e.state === 'metal') {
            if (!electronTrailsRef.current[i]) electronTrailsRef.current[i] = [];
            electronTrailsRef.current[i].push({ x: e.x, y: e.y });
            if (electronTrailsRef.current[i].length > 15) {
              electronTrailsRef.current[i].shift();
            }
            
            // Draw trail
            const trail = electronTrailsRef.current[i];
            if (trail.length > 1) {
              ctx.beginPath();
              ctx.moveTo(trail[0].x, trail[0].y);
              for (let j = 1; j < trail.length; j++) {
                ctx.lineTo(trail[j].x, trail[j].y);
              }
              ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
        });
      } else {
        // Clear trails when disabled
        electronTrailsRef.current = [];
      }
      
      ctx.fillStyle = '#60a5fa'; // blue-400
      electrons.forEach((e, i) => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, ELECTRON_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('-', e.x, e.y);
      });

      ctx.restore();

      // Draw Overlay Text for Heat Mode
      if (mode === 'heat' && overlayTitle) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900 with opacity
        ctx.fillRect(20, CANVAS_HEIGHT - 90, CANVAS_WIDTH - 40, 70);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, CANVAS_HEIGHT - 90, CANVAS_WIDTH - 40, 70);

        ctx.fillStyle = '#f8fafc'; // slate-50
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(overlayTitle, 40, CANVAS_HEIGHT - 75);

        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText(overlayText, 40, CANVAS_HEIGHT - 50, CANVAS_WIDTH - 80);
        
        // Progress bar
        const totalDuration = 24; // 24 seconds total loop
        const progress = (heatTimeRef.current % totalDuration) / totalDuration;
        ctx.fillStyle = '#ef4444'; // red-500
        ctx.fillRect(20, CANVAS_HEIGHT - 20, (CANVAS_WIDTH - 40) * progress, 4);
      }

      // Handle GIF Recording
      if (isRecording && gifState.current.encoder) {
        // Record every 2nd frame (~30fps) for smoother animation
        if (gifState.current.frameCount % 2 === 0) {
          const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          const palette = quantize(imageData.data, 256);
          const index = applyPalette(imageData.data, palette);
          gifState.current.encoder.writeFrame(index, CANVAS_WIDTH, CANVAS_HEIGHT, { palette, delay: 33 });
          
          const maxRecordFrames = mode === 'heat' ? 1440 : MAX_RECORD_FRAMES; // 24s * 30fps = 720 recorded frames (1440 total frames)
          const recordedFrames = gifState.current.frameCount / 2;
          onRecordingProgress?.(recordedFrames / (maxRecordFrames / 2));
          
          if (gifState.current.frameCount >= maxRecordFrames) {
            // Auto-stop
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
  }, [mode, isRecording, animationSpeed, autoMalleable, singleLayerMode, onRecordingComplete, onRecordingProgress, onLayerSlide]);

  // Mouse Interaction for Malleable Mode
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
      // Trigger layer slide achievement when user manually drags layers (not in auto mode)
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
    const dx = x - dragState.current.dragStartX;
    dragState.current.dragStartX = x;
    
    cationsRef.current.forEach(c => {
      // Move based on mode: single layer or multi-layer (scientific)
      if (singleLayerMode) {
        // Single layer mode: only move the exact row that was clicked
        if (c.row === dragState.current.dragRow) {
          c.baseX += dx;
          c.targetX += dx;
        }
      } else {
        // Multi-layer mode (scientific): move the clicked row and all rows above it
        // This represents how shear stress causes planes to slide together in real metals
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

  // Handle click for particle spawner
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!particleSpawner) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Adjust for camera zoom and pan
    const adjustedX = (x - CANVAS_WIDTH / 2) / camRef.current.zoom + camRef.current.x;
    const adjustedY = (y - CANVAS_HEIGHT / 2) / camRef.current.zoom + camRef.current.y;
    
    // Add new electron at click position
    electronsRef.current.push({
      x: adjustedX,
      y: adjustedY,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      speedMultiplier: 1,
      state: 'metal',
    });
    
    // Initialize trail for new electron if trails are enabled
    if (showTrails) {
      electronTrailsRef.current.push([]);
    }
    
    // Notify parent component
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
