import React, { useRef, useEffect, useState } from 'react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type SimulationMode = 'normal' | 'malleable' | 'electrical' | 'heat' | 'circuit';

interface Cation {
  id: number;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  row: number;
  col: number;
  temp: number;
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
  isRecording: boolean;
  animationSpeed: number;
  autoMalleable?: boolean;
  onRecordingComplete: (blob: Blob) => void;
  onRecordingProgress: (progress: number) => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const CATION_RADIUS = 20;
const ELECTRON_RADIUS = 5;
const ROWS = 5;
const COLS = 8;
const SPACING_X = CANVAS_WIDTH / (COLS + 1);
const SPACING_Y = CANVAS_HEIGHT / (ROWS + 1);
const MAX_RECORD_FRAMES = 480; // 240 frames at 30fps = 8 seconds.

// Mathematically perfect tracking of the visually drawn wire route
function getWirePos(progress: number, exitY: number, entryY: number) {
  const d1 = Math.abs(175 - exitY);
  
  // Slide along right electrode to wire connection
  if (progress < d1) {
    const dir = 175 > exitY ? 1 : -1;
    return { x: 450, y: exitY + dir * progress };
  }
  progress -= d1;
  
  if (progress < 70) return { x: 450 + progress, y: 175 }; // Right corner
  progress -= 70;
  if (progress < 145) return { x: 520, y: 175 + progress }; // Down to bottom line
  progress -= 145;
  if (progress < 170) return { x: 520 - progress, y: 320 }; // Left to battery positive
  progress -= 170;
  if (progress < 100) return { x: 350 - progress, y: 320 }; // Through battery
  progress -= 100;
  if (progress < 170) return { x: 250 - progress, y: 320 }; // Left to corner
  progress -= 170;
  if (progress < 145) return { x: 80, y: 320 - progress }; // Up to top line
  progress -= 145;
  if (progress < 70) return { x: 80 + progress, y: 175 }; // Right to metal connection
  progress -= 70;
  
  // Slide along left electrode to entry point
  const d9 = Math.abs(entryY - 175);
  if (progress < d9) {
    const dir = entryY > 175 ? 1 : -1;
    return { x: 150, y: 175 + dir * progress };
  }
  
  return { x: 150, y: entryY };
}

export default function MetalSimulation({ mode, isRecording, animationSpeed, autoMalleable, onRecordingComplete, onRecordingProgress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cationsRef = useRef<Cation[]>([]);
  const electronsRef = useRef<Electron[]>([]);
  const requestRef = useRef<number>();
  const lastLayoutRef = useRef<'circuit' | 'malleable' | 'normal' | null>(null);
  const autoMalleableTime = useRef<number>(0);
  const heatTimeRef = useRef<number>(0);
  const camRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, zoom: 1 });
  
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
          cations.push({
            id: id++,
            baseX: bounds.x + (c + 1) * spacingX,
            baseY: bounds.y + (r + 1) * spacingY,
            x: bounds.x + (c + 1) * spacingX,
            y: bounds.y + (r + 1) * spacingY,
            row: r,
            col: c,
            temp: 0,
          });
        }
      }
      cationsRef.current = cations;

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
          const exitY = bounds.y + Math.random() * bounds.h;
          const entryY = bounds.y + Math.random() * bounds.h;
          const d1 = Math.abs(175 - exitY);
          const d9 = Math.abs(entryY - 175);
          const totalDist = 870 + d1 + d9;
          
          const progress = Math.random() * totalDist;
          const pos = getWirePos(progress, exitY, entryY);
          
          electrons.push({
            x: pos.x, y: pos.y, vx: 0, vy: 0, speedMultiplier: 1, 
            state: 'wire', 
            wireProgress: progress,
            exitY,
            entryY
          });
        }
      }
      electronsRef.current = electrons;
    }
  }, [mode]);

  // Handle Recording State Changes
  useEffect(() => {
    if (isRecording && !gifState.current.encoder) {
      gifState.current.encoder = GIFEncoder();
      gifState.current.frameCount = 0;
      onRecordingProgress(0);
      
      // Reset heat animation if we are in heat mode to capture the full tour
      if (mode === 'heat') {
        heatTimeRef.current = 0;
        cationsRef.current.forEach(c => c.temp = 0);
      }
    } else if (!isRecording && gifState.current.encoder) {
      gifState.current.encoder.finish();
      const buffer = gifState.current.encoder.bytesView();
      const blob = new Blob([buffer], { type: 'image/gif' });
      onRecordingComplete(blob);
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
        autoMalleableTime.current += 0.02 * Math.min(animationSpeed, 5);
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
          // Vibration amplitude based on temperature
          const amplitude = mode === 'heat' ? 1 + c.temp * 8 : 1.5;
          
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
             // Move along wire perfectly tracking total distance
             e.wireProgress! += 150 * dt; 
             
             const d1 = Math.abs(175 - e.exitY!);
             const d9 = Math.abs(e.entryY! - 175);
             const totalDist = d1 + 870 + d9; // 870 is exact pixel length of constant wiring
             
             if (e.wireProgress! >= totalDist) {
                e.state = 'metal';
                e.x = 150;
                e.y = e.entryY!;
                e.vx = 4; // Firm push right into metal to avoid bounce-back
                e.vy = (Math.random() - 0.5) * 4;
             } else {
                const pos = getWirePos(e.wireProgress!, e.exitY!, e.entryY!);
                e.x = pos.x;
                e.y = pos.y;
             }
             return; // skip metal physics
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
            // Strong electric field pull (force to the right)
            e.vx += 10.0 * dt; 
            
            // Random thermal scatter inside the lattice
            e.vx += (Math.random() - 0.5) * 15 * dt; 
            e.vy += (Math.random() - 0.5) * 15 * dt; 
            
            // Simulate lattice collisions (dampening)
            e.vx *= Math.pow(0.5, dt);
            e.vy *= Math.pow(0.5, dt);
            
            const currentSpeed = Math.hypot(e.vx, e.vy);
            const maxSpeed = 4;
            if (currentSpeed > maxSpeed) {
              e.vx = (e.vx / currentSpeed) * maxSpeed;
              e.vy = (e.vy / currentSpeed) * maxSpeed;
            }
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
            // Entering the wire
            if (e.x >= bounds.x + bounds.w - 5) {
               e.state = 'wire';
               e.wireProgress = 0;
               e.exitY = e.y;
               e.entryY = bounds.y + Math.random() * bounds.h;
            }
            // Firm bounce on the left wall to prevent exiting backwards
            if (e.x < bounds.x) { e.x = bounds.x + 1; e.vx = Math.abs(e.vx) + 0.5; }
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
        ctx.beginPath();
        ctx.arc(c.x, c.y, CATION_RADIUS, 0, Math.PI * 2);
        
        if (c.temp > 0.01) {
          // Interpolate from red to yellow/white based on temp
          const r = 239;
          const g = Math.floor(68 + c.temp * 180);
          const b = Math.floor(68 + c.temp * 180);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        } else {
          ctx.fillStyle = '#ef4444'; // red-500
        }
        
        ctx.fill();
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', c.x, c.y);
      });

      // Draw Electrons
      electrons.forEach(e => {
        ctx.fillStyle = '#60a5fa'; // blue-400
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
          onRecordingProgress(recordedFrames / (maxRecordFrames / 2));
          
          if (gifState.current.frameCount >= maxRecordFrames) {
            // Auto-stop
            gifState.current.encoder.finish();
            const buffer = gifState.current.encoder.bytesView();
            const blob = new Blob([buffer], { type: 'image/gif' });
            onRecordingComplete(blob);
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
  }, [mode, isRecording, animationSpeed, autoMalleable, onRecordingComplete, onRecordingProgress]);

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
      // Move the clicked row and all rows above it to simulate sliding layers
      if (c.row <= dragState.current.dragRow) {
        c.baseX += dx;
      }
    });
  };

  const handleMouseUp = () => {
    dragState.current.isDragging = false;
    dragState.current.dragRow = -1;
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className={`w-full max-w-full rounded-xl shadow-lg border border-slate-700 ${mode === 'malleable' && !autoMalleable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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