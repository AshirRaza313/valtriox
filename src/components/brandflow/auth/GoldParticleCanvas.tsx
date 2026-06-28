"use client";

import { useEffect, useRef } from "react";

interface GoldParticleCanvasProps {
  className?: string;
  particleCount?: number;
  paused?: boolean;
}

export function GoldParticleCanvas({
  className = "absolute inset-0 pointer-events-none z-0",
  particleCount = 60,
  paused = false,
}: GoldParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = container.offsetWidth;
    let height = canvas.height = container.offsetHeight;

    const handleResize = () => {
      width = canvas.width = container.offsetWidth;
      height = canvas.height = container.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      opacityDir: number;
      hue: number;
      life: number;
      maxLife: number;
      type: "dot" | "spark" | "ring";
    }

    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle());
    }

    function createParticle(): Particle {
      const type = Math.random() < 0.6 ? "dot" : Math.random() < 0.8 ? "spark" : "ring";
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.5 - 0.1,
        size: type === "ring" ? 8 + Math.random() * 20 : type === "spark" ? 1 + Math.random() * 2 : 1 + Math.random() * 3,
        opacity: Math.random() * 0.6 + 0.1,
        opacityDir: Math.random() > 0.5 ? 0.003 : -0.003,
        hue: 38 + Math.random() * 20,
        life: 0,
        maxLife: 300 + Math.random() * 500,
        type,
      };
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw radial background glows
      const glow1 = ctx.createRadialGradient(width * 0.2, height * 0.3, 0, width * 0.2, height * 0.3, width * 0.4);
      glow1.addColorStop(0, "rgba(212, 167, 58, 0.04)");
      glow1.addColorStop(1, "transparent");
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const glow2 = ctx.createRadialGradient(width * 0.8, height * 0.7, 0, width * 0.8, height * 0.7, width * 0.35);
      glow2.addColorStop(0, "rgba(184, 148, 47, 0.03)");
      glow2.addColorStop(1, "transparent");
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      const glow3 = ctx.createRadialGradient(width * 0.5, height * 0.1, 0, width * 0.5, height * 0.1, width * 0.3);
      glow3.addColorStop(0, "rgba(245, 208, 96, 0.02)");
      glow3.addColorStop(1, "transparent");
      ctx.fillStyle = glow3;
      ctx.fillRect(0, 0, width, height);

      // Draw grid dots pattern
      ctx.fillStyle = "rgba(212, 167, 58, 0.015)";
      const gridSize = 40;
      for (let gx = 0; gx < width; gx += gridSize) {
        for (let gy = 0; gy < height; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        // Oscillate opacity
        p.opacity += p.opacityDir;
        if (p.opacity > 0.7 || p.opacity < 0.05) p.opacityDir *= -1;
        p.opacity = Math.max(0.02, Math.min(0.7, p.opacity));

        // Reset if out of bounds or expired
        if (p.life > p.maxLife || p.y < -20 || p.x < -20 || p.x > width + 20) {
          particles[i] = createParticle();
          particles[i].y = height + 10;
          continue;
        }

        // Draw particle
        if (p.type === "dot") {
          // Gold dot with glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 55%, ${p.opacity})`;
          ctx.fill();

          // Outer glow
          const glowSize = p.size * 4;
          const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
          glowGrad.addColorStop(0, `hsla(${p.hue}, 80%, 55%, ${p.opacity * 0.3})`);
          glowGrad.addColorStop(1, "transparent");
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "spark") {
          // Small bright spark
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${p.opacity * 0.8})`;
          ctx.fill();
        } else if (p.type === "ring") {
          // Fading ring
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${p.hue}, 70%, 50%, ${p.opacity * 0.15})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Draw subtle connecting lines between close particles
      ctx.strokeStyle = "rgba(212, 167, 58, 0.02)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.04;
            ctx.strokeStyle = `rgba(212, 167, 58, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      if (!paused) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [particleCount, paused]);

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
