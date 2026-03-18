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
  autoDemoSpeed?: number;
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
  theme?: 'light' | 'dark'; // Theme prop for canvas colors
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const MAX_RECORD_FRAMES = 480; // 240 frames at 30fps = 8 seconds.
const CATION_RADIUS = 20;
const ELECTRON_RADIUS = 5;
const ROWS = 5;
const COLS = 8;
const SPACING_X = CANVAS_WIDTH / (COLS + 1);
const SPACING_Y = CANVAS_HEIGHT / (ROWS + 1);

function getWirePos(progress: number, exitY: number, entryY: number) {
  // Circuit path: Metal sample on left, battery at bottom center, bulb at top right
  // Metal sample: x=200-480, y=300-400 (horizontal)
  // Wire exits at top of metal (y=280) and enters at bottom of metal (y=420)
  // Path: Metal Right Top (480, 280) -> Up (480, 100) -> Right (900, 100) -> Down (900, 700) -> Left (700, 700) [Battery+]
  //       Battery- (500, 700) -> Left (200, 700) -> Up (200, 420) [Metal Left Bottom]
  //       Then through metal: (200, 420) -> (200, 280)

  // 1. Move Up from Metal Right to top
  if (progress < 180) return { x: 480, y: 280 - progress }; // 280 - 100 = 180
  progress -= 180;

  // 2. Move Right from top corner to bulb position
  if (progress < 420) return { x: 480 + progress, y: 100 }; // 480 to 900 = 420
  progress -= 420;

  // 3. Move Down from bulb to battery level
  if (progress < 600) return { x: 900, y: 100 + progress }; // 100 to 700 = 600
  progress -= 600;

  // 4. Move Left to Battery (+)
  if (progress < 200) return { x: 900 - progress, y: 700 };
  progress -= 200;

  // 5. Through Battery (Teleport/Fast)
  if (progress < 200) return { x: 700 - progress, y: 700 };
  progress -= 200;

  // 6. Move Left from Battery (-) to metal left bottom
  if (progress < 300) return { x: 500 - progress, y: 700 }; // 500 to 200 = 300
  progress -= 300;

  // 7. Move Up from bottom to metal connection point
  const distUp = 700 - 420; // 280
  if (progress < distUp) return { x: 200, y: 700 - progress };
  progress -= distUp;

  // 8. Move through metal (from bottom connection to top connection)
  // Metal goes from y=420 to y=280, so distance is 140
  const distThroughMetal = 140;
  if (progress < distThroughMetal) return { x: 200, y: 420 - progress };
  
  return { x: 200, y: 280 };
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
      
      const bounds = isCircuit ? { x: 200, y: 300, w: 280, h: 100 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
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
          const progress = Math.random() * 2120;
          electrons.push({
            x: 0, y: 0, vx: 0, vy: 0, speedMultiplier: 1, 
            state: 'wire', 
            wireProgress: progress,
            exitY: 280, // Top of horizontal metal
            entryY: 420, // Bottom of horizontal metal
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
    const bounds = isCircuit ? { x: 200, y: 300, w: 280, h: 100 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
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
      const bounds = isCircuit ? { x: 200, y: 300, w: 280, h: 100 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };

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
        autoMalleableTime.current += 0.02 * Math.max(0.5, Math.min(autoDemoSpeed, 5));
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
             // Speed depends on voltage (min speed 2, max speed 8)
             const wireSpeed = 2 + (voltage / 100) * 6;
             e.wireProgress! += wireSpeed * dt; 
             
             // Calculate total path length for new horizontal metal layout
             // Path segments: 
             // 1. Metal to Right Corner: 230
             // 2. Down to Bottom: (600 - exitY)
             // 3. Right to Battery: 200
             // 4. Through Battery: 200
             // 5. Left from Battery: 200
             // 6. Up to Top: (600 - entryY)
             // 7. Right to Metal: 230
             const totalPathLength = 180 + 420 + 600 + 200 + 200 + 300 + 280 + 140;

             if (e.wireProgress! >= totalPathLength) {
                e.state = 'metal';
                e.x = bounds.x + Math.random() * bounds.w; // Enter at left edge
                e.y = bounds.y + Math.random() * bounds.h;
                e.vx = 2 + (voltage / 50); // Initial velocity based on voltage
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
               e.entryY = 420; // Bottom of horizontal metal
            }
            if (e.x < bounds.x) {
               // Re-enter from wire - move to left side of metal
               e.x = bounds.x;
               e.vx *= -1;
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
      const isLight = theme === 'light';
      ctx.fillStyle = isLight ? '#f1f5f9' : '#1e293b'; // slate-50 for light, slate-800 for dark
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(camRef.current.zoom, camRef.current.zoom);
      ctx.translate(-camRef.current.x, -camRef.current.y);

      if (mode === 'heat') {
        // Heat source gradient - wider for better visualization
        const gradient = ctx.createLinearGradient(0, 0, 220, 0);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); // red-500
        gradient.addColorStop(0.3, 'rgba(239, 68, 68, 0.25)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 220, CANVAS_HEIGHT);
      }

      if (isCircuit) {
        // Draw wires - Circuit Loop
        // Wire path: from metal right (top) -> up -> right -> down -> battery -> left -> up -> metal left (bottom) -> through metal
        // Metal sample is horizontal at y=300-400, wires connect at top (y=280) and bottom (y=420)
        ctx.strokeStyle = '#94a3b8'; // slate-400
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        // Wire from metal right side (going up to bulb)
        // Metal extends from x=200 to x=480 (width 280), so right edge is 480
        ctx.moveTo(480, 280); // Metal Right Top - goes up
        ctx.lineTo(480, 100); // Up to top corner
        ctx.lineTo(900, 100); // Right to bulb position
        ctx.lineTo(900, 700); // Down to battery level
        ctx.lineTo(700, 700); // To Battery Positive
        
        // Wire from Battery Negative (going to metal left)
        ctx.moveTo(500, 700); // Battery Negative
        ctx.lineTo(200, 700); // Left to metal left bottom
        ctx.lineTo(200, 420); // Up to metal left bottom connection
        
        // Wire connecting metal left to metal right (through metal)
        // This is inside the metal - horizontal wire from left edge to right edge
        ctx.moveTo(200, 350); // Metal Left center-left
        ctx.lineTo(480, 350); // Metal Right center-right
        ctx.stroke();

        // Draw Bus Bars (Horizontal connectors at top and bottom of metal)
        ctx.fillStyle = '#64748b'; // slate-500
        // Top Bus Bar
        ctx.fillRect(200, 275, 280, 10);
        // Bottom Bus Bar
        ctx.fillRect(200, 415, 280, 10);

        // Draw Electrodes (inside the metal area - top and bottom contacts)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.3)'; // faint slate
        ctx.fillRect(220, 280, 240, 5);  // Top inner contact
        ctx.fillRect(220, 415, 240, 5);  // Bottom inner contact

        // Draw Battery at bottom center
        ctx.fillStyle = '#334155';
        ctx.fillRect(500, 670, 200, 60);  // Battery Body
        
        // Battery Terminals
        ctx.fillStyle = '#ef4444'; // Positive (Right)
        ctx.fillRect(680, 690, 15, 20);
        ctx.fillStyle = '#cbd5e1'; // Negative (Left)
        ctx.fillRect(505, 690, 15, 20);
        
        // Battery Labels
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BATTERY', 600, 700);
        ctx.font = 'bold 24px Inter';
        ctx.fillText('+', 670, 700);
        ctx.fillText('-', 530, 700);

        // Draw Light Bulb (On Right Wire at top)
        const bulbX = 900;
        const bulbY = 150;
        
        // Bulb brightness depends on voltage
        const brightness = Math.max(0.2, voltage / 100);
        const glowSize = 20 + (voltage / 100) * 40;
        
        // Bulb Glass
        ctx.fillStyle = `rgba(251, 191, 36, ${brightness})`; // amber-400 with variable opacity
        ctx.beginPath();
        ctx.arc(bulbX, bulbY, 40, 0, Math.PI * 2);
        ctx.fill();
        
        // Bulb Glow (Outer)
        if (voltage > 10) {
          const gradient = ctx.createRadialGradient(bulbX, bulbY, 30, bulbX, bulbY, 30 + glowSize);
          gradient.addColorStop(0, `rgba(251, 191, 36, ${brightness * 0.6})`);
          gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(bulbX, bulbY, 30 + glowSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Bulb Base
        ctx.fillStyle = '#64748b';
        ctx.fillRect(bulbX - 15, bulbY + 35, 30, 25);
        
        // Filament (Brightens with voltage)
        ctx.strokeStyle = voltage > 20 ? '#fff' : '#fcd34d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bulbX - 10, bulbY + 35);
        ctx.lineTo(bulbX - 5, bulbY + 10);
        ctx.lineTo(bulbX + 5, bulbY + 10);
        ctx.lineTo(bulbX + 10, bulbY + 35);
        ctx.stroke();

        // Draw Metal Background
        const metalBgColor = isLight ? '#e2e8f0' : '#0f172a';
        ctx.fillStyle = metalBgColor;
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 3;
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
        
        // Label
        ctx.fillStyle = isLight ? '#475569' : '#64748b';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('METAL SAMPLE', bounds.x + bounds.w / 2, bounds.y - 15);
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
      
      // Draw electrons
      electrons.forEach((e, i) => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, ELECTRON_RADIUS, 0, Math.PI * 2);
        // White for dark mode, teal for light mode (not blue to avoid conflict)
        ctx.fillStyle = isLight ? '#0d9488' : '#ffffff';
        ctx.fill();
        
        // Use darker color for light theme visibility
        ctx.fillStyle = isLight ? '#0f766e' : '#e2e8f0';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('-', e.x, e.y);
      });

      ctx.restore();

      // Draw Overlay Text for Heat Mode - larger info panel for better readability
      if (mode === 'heat' && overlayTitle) {
        ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.85)'; // slate-50 for light, slate-900 for dark
        ctx.fillRect(20, CANVAS_HEIGHT - 130, CANVAS_WIDTH - 40, 100);  // taller panel for better readability
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, CANVAS_HEIGHT - 130, CANVAS_WIDTH - 40, 100);

        ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc'; // slate-900 for light, slate-50 for dark
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(overlayTitle, 40, CANVAS_HEIGHT - 118);

        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8'; // slate-500 for light, slate-400 for dark
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText(overlayText, 40, CANVAS_HEIGHT - 88, CANVAS_WIDTH - 80);
        
        // Progress bar
        const totalDuration = 24; // 24 seconds total loop
        const progress = (heatTimeRef.current % totalDuration) / totalDuration;
        ctx.fillStyle = '#ef4444'; // red-500
        ctx.fillRect(20, CANVAS_HEIGHT - 30, (CANVAS_WIDTH - 40) * progress, 4);  // progress bar at bottom
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
  }, [mode, isRecording, animationSpeed, autoMalleable, autoDemoSpeed, singleLayerMode, onRecordingComplete, onRecordingProgress, onLayerSlide]);

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
