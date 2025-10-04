import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/components/notifications";
import WaterEffects from "@/components/water-effects";
import LoadingScreen from "@/components/loading-screen";
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

function AnimatedFishBackground() {
  return (
    <div className="fixed inset-0 z-0 fish-background">
      <div className="fish">
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
      </div>
      <div className="fish">
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
        <div className="koiCoil"></div>
      </div>
      <div className="seaLevel"></div>
    </div>
  );
}

function App() {
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <TooltipProvider>
          {!isLoadingComplete && (
            <LoadingScreen onComplete={() => setIsLoadingComplete(true)} />
          )}
          
          <AnimatedFishBackground />
          <WaterEffects />
          
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
