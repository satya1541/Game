import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/components/notifications";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { motion } from "framer-motion";

const Home = lazy(() => import("@/pages/home"));
const Upload = lazy(() => import("@/pages/upload"));
const AllFiles = lazy(() => import("@/pages/all-files"));
const DownloadPage = lazy(() => import("@/pages/download"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="loader-ring" />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground text-sm"
        >
          Loading...
        </motion.p>
      </motion.div>
    </div>
  );
}

function InnerRouter() {
  return (
    <Switch>
      <Route path="/">
        <Suspense fallback={<LoadingFallback />}>
          <Home />
        </Suspense>
      </Route>
      <Route path="/u">
        <Suspense fallback={<LoadingFallback />}>
          <Upload />
        </Suspense>
      </Route>
      <Route path="/404">
        <Suspense fallback={<LoadingFallback />}>
          <AllFiles />
        </Suspense>
      </Route>
      <Route path="/download/:id">
        <Suspense fallback={<LoadingFallback />}>
          <DownloadPage />
        </Suspense>
      </Route>
      <Route>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <h1 className="text-6xl font-bold font-display text-gradient mb-4">404</h1>
            <p className="text-muted-foreground">Page Not Found</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <TooltipProvider>
              <div className="min-h-screen bg-background text-foreground">
                <Toaster />
                <InnerRouter />
              </div>
            </TooltipProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
