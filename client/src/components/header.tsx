import { Gamepad2, Download, Upload, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Notifications from "./notifications";

export default function Header() {
  const [location] = useLocation();
  
  // Fetch stats data
  const { data: stats } = useQuery<{
    totalFiles: number;
    totalDownloads: number;
    activeUsers: number;
    totalStorage: string;
    categoryStats: Record<string, number>;
  }>({
    queryKey: ["/api/stats"],
    staleTime: 60000, // Cache for 1 minute
  });
  
  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="relative z-50 border-b border-border/50 backdrop-blur-lg bg-background/80 shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center animate-pulse-glow">
                <Gamepad2 className="text-background text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-gaming font-bold text-primary">
                  H4VX
                </h1>
                <p className="text-xs text-muted-foreground">Gaming File Hub</p>
              </div>
            </div>
          </Link>

          {/* Navigation - Centered */}
          <div className="hidden md:flex items-center space-x-6 flex-1 justify-center">
            <Link href="/">
              <div className={`transition-colors duration-200 cursor-pointer ${isActive('/') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`} data-testid="nav-home">
                <Download className="inline mr-2 w-4 h-4" />Home
              </div>
            </Link>
          </div>

          {/* User Actions and Stats - Right Aligned */}
          <div className="flex items-center space-x-4 ml-auto">
            <Notifications />
            {/* Stats */}
            {stats && (
              <div className="hidden md:flex items-center space-x-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span>{stats.totalDownloads || 0}</span>
                  <span className="text-primary">downloads</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Upload className="w-3 h-3 text-accent" />
                  <span>{stats.totalFiles || 0}</span>
                  <span className="text-accent">uploads</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
