import { useEffect } from 'react';

interface WaterRipple {
  id: string;
  x: number;
  y: number;
  size: number;
}

export default function WaterEffects() {
  useEffect(() => {
    let rippleId = 0;

    const createRipple = (e: MouseEvent) => {
      // Don't create ripples on form inputs or buttons to avoid interference
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA') {
        return;
      }

      const ripple = document.createElement('div');
      const size = Math.random() * 100 + 50; // Random size between 50-150px
      
      ripple.className = 'water-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - size / 2}px`;
      ripple.style.top = `${e.clientY - size / 2}px`;
      
      document.body.appendChild(ripple);

      // Remove ripple after animation completes
      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 800);
    };

    // Create cursor wave effect
    const cursor = document.createElement('div');
    cursor.className = 'water-wave-cursor';
    document.body.appendChild(cursor);

    const updateCursor = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    };

    const showCursor = () => {
      cursor.classList.add('active');
    };

    const hideCursor = () => {
      cursor.classList.remove('active');
    };

    // Add event listeners
    document.addEventListener('click', createRipple);
    document.addEventListener('mousemove', updateCursor);
    document.addEventListener('mouseenter', showCursor);
    document.addEventListener('mouseleave', hideCursor);

    // Cleanup
    return () => {
      document.removeEventListener('click', createRipple);
      document.removeEventListener('mousemove', updateCursor);
      document.removeEventListener('mouseenter', showCursor);
      document.removeEventListener('mouseleave', hideCursor);
      
      if (cursor.parentNode) {
        cursor.parentNode.removeChild(cursor);
      }
      
      // Remove any existing ripples
      const existingRipples = document.querySelectorAll('.water-ripple');
      existingRipples.forEach(ripple => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      });
    };
  }, []);

  return null;
}