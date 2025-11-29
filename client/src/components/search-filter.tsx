import { Search, Filter, Sparkles, ChevronLeft, ArrowUpDown, X } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import heroBackground from "@assets/generated_images/futuristic_digital_hero_background.png";

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFolder?: string | null;
}

export default function SearchFilter({ 
  searchQuery, 
  onSearchChange,
  selectedFolder
}: SearchFilterProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroBackground}
          alt=""
          className="hero-bg-image"
        />
        <div className="hero-overlay" />
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              x: [0, 30, 0],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-20 right-20 w-96 h-96 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -20, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-gradient-to-tr from-accent/20 to-primary/20 blur-3xl"
          />
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {!selectedFolder && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="max-w-3xl mx-auto"
            >
              <div className={`search-bar flex items-center gap-2 p-1.5 md:p-2 transition-all duration-300 ${
                isFocused ? 'ring-2 ring-primary/30 scale-[1.02]' : ''
              }`}>
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="p-1.5 rounded-lg bg-gradient-primary text-white shrink-0"
                >
                  <Search className="w-4 h-4 md:w-5 md:h-5" />
                </motion.div>
                <input
                  type="text"
                  placeholder="Search for games, tools, scripts, configs..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base md:text-lg py-1.5"
                  data-testid="search-input"
                />
                {searchQuery && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onSearchChange('')}
                    className="icon-button shrink-0"
                    data-testid="button-clear-search"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="icon-button icon-button-primary shrink-0"
                  data-testid="button-filter"
                >
                  <Filter className="w-4 h-4" />
                </motion.button>
              </div>

              {searchQuery && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-3 text-sm text-muted-foreground"
                >
                  Searching for "<span className="text-primary font-medium">{searchQuery}</span>"
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex justify-center mt-4"
            >
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex flex-col items-center gap-1 text-muted-foreground"
              >
                <span className="text-xs uppercase tracking-wider">Scroll to explore</span>
                <ArrowUpDown className="w-3 h-3" />
              </motion.div>
            </motion.div>
          </>
        )}

        {selectedFolder && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 text-muted-foreground mb-4">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">
                Browsing folder
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-display text-gradient">
              {selectedFolder}
            </h2>
            
            <div className="max-w-xl mx-auto mt-6">
              <div className={`search-bar flex items-center gap-3 p-2 transition-all duration-300 ${
                isFocused ? 'ring-2 ring-primary/30' : ''
              }`}>
                <div className="p-2 rounded-xl bg-gradient-primary text-white shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search in this folder..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base py-1"
                  data-testid="search-input-folder"
                />
                {searchQuery && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onSearchChange('')}
                    className="icon-button shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
