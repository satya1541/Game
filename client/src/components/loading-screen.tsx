import { useState, useEffect } from "react";
import loadingGif from "@assets/pattern-18045_512_1759572396270.gif";

interface LoadingScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export default function LoadingScreen({ onComplete, minDuration = 2000 }: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, minDuration - 500);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, minDuration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [minDuration, onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[10000] bg-gradient-to-br from-background via-background/95 to-primary/10 flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      data-testid="loading-screen"
    >
      <div className="text-center">
        <div className="mb-6">
          <img 
            src={loadingGif} 
            alt="Loading..." 
            className="w-32 h-32 mx-auto"
          />
        </div>
        <h2 className="text-2xl font-gaming font-bold text-primary animate-pulse">
          H4VX Gaming File Hub
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Loading your gaming experience...
        </p>
      </div>
    </div>
  );
}
