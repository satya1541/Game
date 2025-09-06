import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/components/notifications";
import { useEffect, useRef } from "react";
import Home from "@/pages/home";
import Upload from "@/pages/upload";
import Admin from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/u" component={Upload} />
      <Route path="/admin" component={Admin} />
      <Route>404 - Page Not Found</Route>
    </Switch>
  );
}

function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Force play the video
      const playVideo = async () => {
        try {
          await video.play();
        } catch (error) {
          // Retry on any user interaction
          const handleInteraction = () => {
            video.play();
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touch', handleInteraction);
          };
          document.addEventListener('click', handleInteraction);
          document.addEventListener('touch', handleInteraction);
        }
      };
      
      if (video.readyState >= 3) {
        playVideo();
      } else {
        video.addEventListener('canplay', playVideo);
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 z-0">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        style={{ 
          filter: 'brightness(0.3)',
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      >
        <source src="/background-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/40"></div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <TooltipProvider>
          <VideoBackground />
          
          {/* App Content */}
          <div className="relative z-10">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
