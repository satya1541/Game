import { TrendingUp, Upload, Home } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import logoImage from "@assets/image_1759215892166.png";

export default function Header() {
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

  return (
    <header className="glass-header sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer">
              <img src={logoImage} alt="H4VX Logo" className="w-8 h-8 sm:w-12 sm:h-12 object-contain" />
              <div>
                <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  H4VX
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Gaming File Hub</p>
              </div>
            </div>
          </Link>

          {/* Home Button - Visible on all devices */}
          <div className="flex-shrink-0">
            <Link href="/">
              <button 
                className="glass-button flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary to-accent text-white font-medium hover:shadow-xl hover:shadow-primary/30 hover:scale-105"
                data-testid="button-home"
              >
                <Home className="w-4 h-4" />
                <span className="text-sm sm:text-base">Home</span>
              </button>
            </Link>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto">
              <div className="bg-white/20 dark:bg-black/30 backdrop-blur-xl px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/30 dark:border-white/20 shadow-lg shadow-black/10 dark:shadow-black/30 flex items-center gap-1 sm:gap-2 hover:bg-white/30 dark:hover:bg-black/40 transition-all">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                <span className="font-bold text-base sm:text-xl text-slate-900 dark:text-white">{stats.totalDownloads || 0}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white hidden sm:inline">downloads</span>
              </div>
              <div className="bg-white/20 dark:bg-black/30 backdrop-blur-xl px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/30 dark:border-white/20 shadow-lg shadow-black/10 dark:shadow-black/30 flex items-center gap-1 sm:gap-2 hover:bg-white/30 dark:hover:bg-black/40 transition-all">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                <span className="font-bold text-base sm:text-xl text-slate-900 dark:text-white">{stats.totalFiles || 0}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white hidden sm:inline">files</span>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}