import { TrendingUp, Upload, Home, Menu, X, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "@assets/image_1759215892166.png";

export default function Header() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { data: stats } = useQuery<{
    totalFiles: number;
    totalDownloads: number;
    activeUsers: number;
    totalStorage: string;
    categoryStats: Record<string, number>;
  }>({
    queryKey: ["/api/stats"],
    staleTime: 60000,
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "premium-glass-heavy shadow-lg"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-primary rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                  <img
                    src={logoImage}
                    alt="H4VX Logo"
                    className="w-10 h-10 md:w-12 md:h-12 object-contain relative z-10 transition-transform duration-300 group-hover:scale-110"
                  />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl md:text-2xl font-bold font-display text-gradient">
                    H4VX
                  </h1>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Gaming File Hub
                  </p>
                </div>
              </motion.div>
            </Link>

            <div className="hidden md:flex items-center gap-2">
              {stats && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-3 mr-4"
                >
                  <div className="stat-card flex items-center gap-2 !p-2.5 !rounded-xl">
                    <div className="p-1.5 rounded-lg bg-gradient-primary">
                      <TrendingUp className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {formatNumber(stats.totalDownloads || 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground -mt-0.5">Downloads</p>
                    </div>
                  </div>
                  <div className="stat-card flex items-center gap-2 !p-2.5 !rounded-xl">
                    <div className="p-1.5 rounded-lg bg-gradient-accent">
                      <Upload className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {formatNumber(stats.totalFiles || 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground -mt-0.5">Files</p>
                    </div>
                  </div>
                </motion.div>
              )}

              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`premium-button flex items-center gap-2 !py-2.5 !px-5 ${
                    location === "/" ? "ring-2 ring-white/20" : ""
                  }`}
                  data-testid="button-home"
                >
                  <Home className="w-4 h-4" />
                  <span className="font-semibold">Home</span>
                </motion.button>
              </Link>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden icon-button"
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-40 md:hidden"
          >
            <div className="premium-glass-heavy m-4 rounded-2xl p-4 space-y-4">
              {stats && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="stat-card !p-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-primary">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">
                          {formatNumber(stats.totalDownloads || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Downloads</p>
                      </div>
                    </div>
                  </div>
                  <div className="stat-card !p-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-accent">
                        <Upload className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">
                          {formatNumber(stats.totalFiles || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Files</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="premium-button flex items-center gap-2 !py-2.5 w-full justify-center"
                  data-testid="button-home-mobile"
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </motion.button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-16 md:h-20" />
    </>
  );
}
