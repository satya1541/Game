import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/components/notifications";
import Home from "@/pages/home";
import Upload from "@/pages/upload";
import Admin from "@/pages/admin";
import backgroundImage from "@assets/man-neon-suit-sits-chair-with-neon-sign-that-says-word-it_1757669717794.jpg";

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

function BackgroundImage() {
  return (
    <div className="fixed inset-0 z-0">
      <img
        src={backgroundImage}
        alt="Gaming background"
        className="w-full h-full object-cover"
        style={{
          filter: 'brightness(0.4)',
        }}
      />
      <div className="absolute inset-0 bg-black/30"></div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <TooltipProvider>
          <BackgroundImage />
          
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
