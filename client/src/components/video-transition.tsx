import { useEffect, useState, useRef } from "react";
import videoSrc from "@assets/sachiro-dark-nights.1920x1080_1759228053157.mp4";

interface VideoTransitionProps {
  isPlaying: boolean;
  onComplete: () => void;
}

export default function VideoTransition({ isPlaying, onComplete }: VideoTransitionProps) {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isPlaying) {
      setShow(true);
      setFadeOut(false);
      
      // Start fade out after 2.7 seconds
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, 2700);
      
      // Complete transition after fade out (3 seconds total)
      const completeTimer = setTimeout(() => {
        setShow(false);
        setFadeOut(false);
        onComplete();
      }, 3000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [isPlaying, onComplete]);

  if (!show) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
        data-testid="video-transition"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
    </div>
  );
}
