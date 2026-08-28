import confetti from 'canvas-confetti';

export function triggerConfetti() {
  // Create a burst of confetti from both sides
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // First burst
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    origin: { x: 0.2, y: 0.7 },
  });

  fire(0.2, {
    spread: 60,
    origin: { x: 0.8, y: 0.7 },
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    origin: { x: 0.5, y: 0.6 },
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    origin: { x: 0.3, y: 0.5 },
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    origin: { x: 0.7, y: 0.5 },
  });

  // Second wave with golden/celebratory colors
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'],
      zIndex: 9999,
    });
  }, 250);

  // Stars burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 100,
      origin: { x: 0.5, y: 0.3 },
      shapes: ['star'],
      colors: ['#FFD700', '#FFC107', '#FFEB3B'],
      scalar: 1.5,
      zIndex: 9999,
    });
  }, 400);
}

export function triggerSubtleConfetti() {
  // Lighter celebration for smaller wins
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#10B981', '#34D399', '#6EE7B7'],
    zIndex: 9999,
  });
}
