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
  isAlloyB: boolean;
}

interface Electron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speedMultiplier: number;
  state: 'metal' | 'wire';
  wireTargetIdx?: number;
  wireTargetY?: number;
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
const MAX_RECORD_FRAMES = 480; // 240 frames at 30fps = 8 seconds.
const CATION_RADIUS = 20;
const ELECTRON_RADIUS = 5;
const ROWS = 5;
const COLS = 8;
const SPACING_X = CANVAS_WIDTH / (COLS + 1);
const SPACING_Y = CANVAS_HEIGHT / (ROWS + 1);

function getInitialWirePos(dist: number) {
  if (dist <= 140) return { x: 900 + dist, y: 350, targetIdx: 2 };
  dist -= 140;
  if (dist <= 200) return { x: 1040, y: 350 + dist, targetIdx: 3 };
  dist -= 200;
  if (dist <= 275) return { x: 1040 - dist, y: 550, targetIdx: 4 };
  dist -= 275;
  if (dist <= 250) return { x: 765 - dist, y: 550, targetIdx: 5 };
  dist -= 250;
  if (dist <= 215) return { x: 515 - dist, y: 550, targetIdx: 6 };
  dist -= 215;
  if (dist <= 200) return { x: 300, y: 550 - dist, targetIdx: 7 };
  return { x: 300, y: 350, targetIdx: 8 };
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

  useEffect(() => {
    const isCircuit = mode === 'circuit';
    const layoutType = isCircuit ? 'circuit' : (mode === 'malleable' ? 'malleable' : 'normal');
    
    if (cationsRef.current.length === 0 || lastLayoutRef.current !== layoutType) {
      lastLayoutRef.current = layoutType;
      
      const bounds = isCircuit ? { x: 300, y: 200, w: 600, h: 300 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
      const rows = isCircuit ? 3 : ROWS;
      const cols = isCircuit ? 6 : COLS;
      const spacingX = bounds.w / (cols + 1);
      const spacingY = bounds.h / (rows + 1);
      const cationOffsetY = isCircuit ? (350 - (bounds.y + 2 * spacingY)) : 0;

      const cations: Cation[] = [];
      let id = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const baseX = bounds.x + (c + 1) * spacingX;
          const baseY = bounds.y + (r + 1) * spacingY + (isCircuit ? cationOffsetY : 0);
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
          const progress = Math.random() * 1280;
          const pos = getInitialWirePos(progress);
          electrons.push({
            x: pos.x, y: pos.y, vx: 0, vy: 0, speedMultiplier: 1,
            state: 'wire',
            wireTargetIdx: pos.targetIdx,
            wireTargetY: 200 + Math.random() * 300,
          });
        }
      }
      electronsRef.current = electrons;
    }
  }, [mode]);

  useEffect(() => {
    if (cationsRef.current.length === 0) return;
    
    const isCircuit = mode === 'circuit';
    const bounds = isCircuit ? { x: 300, y: 200, w: 600, h: 300 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
    const rows = isCircuit ? 3 : ROWS;
    const cols = isCircuit ? 6 : COLS;
    
    const spacingX = bounds.w / (cols + 1);
    const spacingY = bounds.h / (rows + 1);
    
    const structureChanged = lastCrystalStructureRef.current !== crystalStructure;
    if (structureChanged) {
      lastCrystalStructureRef.current = crystalStructure;
      animationProgressRef.current = 0;
    }
    
    cationsRef.current.forEach((c) => {
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
      const bounds = isCircuit ? { x: 300, y: 200, w: 600, h: 300 } : { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };

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
          targetCamX = cations[0].x + (CANVAS_WIDTH / (COLS + 1)) / 2;
          targetCamY = cations[0].y + (CANVAS_HEIGHT / (ROWS + 1)) / 2;
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

      if (mode === 'malleable' && autoMalleable) {
        autoMalleableTime.current += 0.02 * Math.max(0.5, Math.min(autoDemoSpeed, 5));
        const shift = Math.sin(autoMalleableTime.current) * 60;
        
        cations.forEach(c => {
          const originalBaseX = (c.col + 1) * (CANVAS_WIDTH / (COLS + 1));
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
        cations.forEach(c => {
          const lerpSpeed = 0.08;
          c.baseX += (c.targetX - c.baseX) * lerpSpeed;
          c.baseY += (c.targetY - c.baseY) * lerpSpeed;
          
          const globalTemp = temperature / 100;
          const amplitude = mode === 'heat' ? 1 + c.temp * 8 : 1.5 + globalTemp * 8;
          
          c.x = c.baseX + (Math.random() - 0.5) * amplitude * Math.min(dt, 5);
          c.y = c.baseY + (Math.random() - 0.5) * amplitude * Math.min(dt, 5);
          
          if (mode === 'heat') {
            const t = heatTimeRef.current;
            const delay = c.col * 1.5; 
            if (t > delay) {
               c.temp = Math.min(1, (t - delay) / 4); 
            } else {
               c.temp = 0;
            }
          } else {
            c.temp *= Math.pow(0.95, dt);
          }
        });

        electrons.forEach(e => {
          let currentSpeedMult = dt;
          
          if (e.state === 'wire') {
             const voltageMultiplier = voltage / 100;
             const wireSpeed = 20 + voltageMultiplier * 400; // Base speed + active speed based on voltage
             let speed = wireSpeed * dt;
             
             const waypoints = [
               { x: e.x, y: e.y }, // 0
               { x: 900, y: 350 }, // 1
               { x: 1040, y: 350 }, // 2
               { x: 1040, y: 550 }, // 3
               { x: 765, y: 550 }, // 4
               { x: 515, y: 550 }, // 5
               { x: 300, y: 550 }, // 6
               { x: 300, y: 350 }, // 7
               { x: 300, y: e.wireTargetY! } // 8
             ];
             
             while (speed > 0 && e.wireTargetIdx! <= 8) {
               const target = waypoints[e.wireTargetIdx!];
               const dx = target.x - e.x;
               const dy = target.y - e.y;
               const dist = Math.hypot(dx, dy);
               
               if (dist <= speed) {
                 e.x = target.x;
                 e.y = target.y;
                 speed -= dist;
                 e.wireTargetIdx!++;
               } else {
                 e.x += (dx / dist) * speed;
                 e.y += (dy / dist) * speed;
                 speed = 0;
               }
             }
             
             if (e.wireTargetIdx! > 8) {
                e.state = 'metal';
                e.vx = 2 + (voltage / 50); 
                e.vy = (Math.random() - 0.5) * 2;
             }
             return; 
          }

          if (mode === 'heat') {
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
            const voltageMultiplier = voltage / 50; // 0-2 range
            e.vx += 0.5 * dt * voltageMultiplier;
            e.vx += (Math.random() - 0.5) * 1.5 * dt; 
            e.vy += (Math.random() - 0.5) * 1.5 * dt; 
            
            const currentSpeed = Math.hypot(e.vx, e.vy);
            const maxSpeed = 3 + 5 * voltageMultiplier;
            if (currentSpeed > maxSpeed) {
              e.vx = (e.vx / currentSpeed) * maxSpeed;
              e.vy = (e.vy / currentSpeed) * maxSpeed;
            }
          } else {
            e.vx += (Math.random() - 0.5) * 1.5 * dt;
            e.vy += (Math.random() - 0.5) * 1.5 * dt;
            
            const currentSpeed = Math.hypot(e.vx, e.vy);
            const maxSpeed = 3;
            if (currentSpeed > maxSpeed) {
              e.vx = (e.vx / currentSpeed) * maxSpeed;
              e.vy = (e.vy / currentSpeed) * maxSpeed;
            }
          }

          e.x += e.vx * currentSpeedMult;
          e.y += e.vy * currentSpeedMult;

          if (mode === 'electrical') {
            if (e.x > bounds.x + bounds.w) e.x = bounds.x + (e.x % bounds.w);
            if (e.x < bounds.x) e.x = bounds.x + bounds.w + (e.x % bounds.w);
            if (e.y > bounds.y + bounds.h) { e.y = bounds.y + bounds.h; e.vy *= -1; }
            if (e.y < bounds.y) { e.y = bounds.y; e.vy *= -1; }
          } else if (mode === 'circuit') {
            if (e.x >= bounds.x + bounds.w - 5) {
               e.state = 'wire';
               e.wireTargetIdx = 1;
               e.wireTargetY = 200 + Math.random() * 300; 
               e.x = bounds.x + bounds.w; 
            }
            if (e.x < bounds.x) { e.x = bounds.x; e.vx = Math.abs(e.vx); }
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

      let remainingSpeed = animationSpeed;
      while (remainingSpeed > 0) {
        const step = Math.min(remainingSpeed, 2);
        updatePhysics(step);
        remainingSpeed -= step;
      }

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
        const metalBgColor = isLight ? '#e2e8f0' : '#0f172a';
        ctx.fillStyle = metalBgColor;
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 3;
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
        
        ctx.fillStyle = isLight ? '#475569' : '#64748b';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('METAL WIRE / MATERIAL', bounds.x + bounds.w / 2, bounds.y - 15);
        
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        // Right wire
        ctx.moveTo(900, 350);
        ctx.lineTo(1040, 350);
        ctx.lineTo(1040, 550);
        ctx.lineTo(765, 550);
        
        // Left wire
        ctx.moveTo(515, 550);
        ctx.lineTo(300, 550);
        ctx.lineTo(300, 350);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.fillRect(295, 200, 10, 300); 
        ctx.fillRect(895, 200, 10, 300); 

        const bulbX = 1040;
        const bulbY = 450;
        
        const brightness = Math.max(0.2, voltage / 100);
        const glowSize = 40 + (voltage / 100) * 80;
        
        ctx.fillStyle = `rgba(251, 191, 36, ${brightness})`; 
        ctx.beginPath();
        ctx.arc(bulbX, bulbY, 50, 0, Math.PI * 2);
        ctx.fill();
        
        if (voltage > 10) {
          const gradient = ctx.createRadialGradient(bulbX, bulbY, 40, bulbX, bulbY, 40 + glowSize);
          gradient.addColorStop(0, `rgba(251, 191, 36, ${brightness * 0.6})`);
          gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(bulbX, bulbY, 40 + glowSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.fillStyle = '#64748b';
        ctx.fillRect(bulbX - 20, bulbY + 45, 40, 30);
        
        ctx.strokeStyle = voltage > 20 ? '#fff' : '#fcd34d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bulbX - 15, bulbY + 45);
        ctx.lineTo(bulbX - 8, bulbY + 15);
        ctx.lineTo(bulbX + 8, bulbY + 15);
        ctx.lineTo(bulbX + 15, bulbY + 45);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.fillRect(520, 510, 240, 80);
        
        ctx.fillStyle = '#ef4444'; 
        ctx.fillRect(740, 530, 25, 40);
        ctx.fillStyle = '#cbd5e1'; 
        ctx.fillRect(515, 530, 25, 40);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BATTERY', 640, 550);
        ctx.font = 'bold 36px Inter';
        ctx.fillText('+', 752, 550);
        ctx.fillText('-', 527, 550);
      }

      cations.forEach(c => {
        let cationRadius = CATION_RADIUS;
        let fillColor = '#ef4444'; 
        let strokeColor = '#991b1b';
        let labelText = '+';
        
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

      if (showTrails && electronTrailsRef.current.length !== electrons.length) {
        electronTrailsRef.current = electrons.map(() => []);
      }
      
      if (showTrails) {
        electrons.forEach((e, i) => {
          if (e.state === 'metal') {
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
              ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          } else {
             if (electronTrailsRef.current[i]) electronTrailsRef.current[i] = [];
          }
        });
      } else {
        electronTrailsRef.current = [];
      }
      
      electrons.forEach((e, i) => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, ELECTRON_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#0d9488' : '#ffffff';
        ctx.fill();
        
        ctx.fillStyle = isLight ? '#0f766e' : '#e2e8f0';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('-', e.x, e.y);
      });

      ctx.restore();

      if (mode === 'heat' && overlayTitle) {
        ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.85)'; 
        ctx.fillRect(20, CANVAS_HEIGHT - 130, CANVAS_WIDTH - 40, 100);  
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, CANVAS_HEIGHT - 130, CANVAS_WIDTH - 40, 100);

        ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc'; 
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(overlayTitle, 40, CANVAS_HEIGHT - 118);

        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8'; 
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText(overlayText, 40, CANVAS_HEIGHT - 88, CANVAS_WIDTH - 80);
        
        const totalDuration = 24; 
        const progress = (heatTimeRef.current % totalDuration) / totalDuration;
        ctx.fillStyle = '#ef4444'; 
        ctx.fillRect(20, CANVAS_HEIGHT - 30, (CANVAS_WIDTH - 40) * progress, 4);  
      }

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
  }, [mode, isRecording, animationSpeed, autoMalleable, autoDemoSpeed, singleLayerMode, onRecordingComplete, onRecordingProgress, onLayerSlide, voltage, showTrails, theme]);

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
    const dx = x - dragState.current.dragStartX;
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
      x: adjustedX,
      y: adjustedY,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      speedMultiplier: 1,
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