'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadConfettiPreset } from "@tsparticles/preset-confetti";
import type { Engine } from "@tsparticles/engine";

interface EndOfDayMessageProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EndOfDayMessage({ isOpen, onClose }: EndOfDayMessageProps) {
  const [init, setInit] = React.useState(false);

  useEffect(() => {
      initParticlesEngine(async (engine: Engine) => {
          await loadConfettiPreset(engine);
      }).then(() => {
          setInit(true);
      });
  }, []);

  const particlesOptions = {
    preset: "confetti",
    particles: {
      move:{
        speed: 10,
        gravity: {
          acceleration: 15
        },
        decay: 0.05
        }
      },
      emitters: [
        {
          position: {
            x: 50,
            y: -10 },
            rate: {
              delay: 0.2,
              quantity: 8
            },
          particules: {
            move:{
              direction: "bottom"
            }
          }
        }
      ]
    };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden p-0 ">
        <div className="relative">
            {init && (
            <Particles
                id="tsparticles"
                options={particlesOptions}
                className="absolute inset-0 z-0"
            />
            )}
            <div className="relative z-10 p-6">
                <DialogHeader>
                  <DialogTitle className="text-center text-4xl font-bold text-red-800 animate-bounce">
                      Félicitations !
                  </DialogTitle>
                  <DialogDescription className="py-6 text-center">
                    <span className="block text-xl font-medium">La journée est terminée.</span>
                    <span className="block text-lg text-white-600">On se retrouve demain !!</span>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                <Button onClick={onClose} className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3">
                    Fermer
                </Button>
                </DialogFooter>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
