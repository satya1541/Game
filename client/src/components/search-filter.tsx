import { Waves, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import searchIcon from "@assets/search-unscreen_1759214410641.gif";
import filterIcon from "@assets/filter_1759214880410.gif";

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
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Search Hero Section - Only show on main page */}
        {!selectedFolder && (
          <div className="text-center mb-10 space-y-4">
            <div className="relative inline-block">
              {/* Glow effect background */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 via-blue-400/30 to-purple-400/30 blur-2xl animate-pulse"></div>
              
              {/* Main title */}
              <div className="relative flex items-center justify-center gap-3">
                <Waves className="w-9 h-9 text-cyan-400 animate-bounce" style={{ animationDuration: '2s' }} />
                <h1 className="text-5xl md:text-6xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
                    Dive into Files
                  </span>
                </h1>
                <Waves className="w-9 h-9 text-cyan-400 animate-bounce" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
              </div>
            </div>
            
            <p className="text-muted-foreground/90 text-xl max-w-3xl mx-auto font-light">
              Explore our ocean of gaming files, tools, and treasures
            </p>
          </div>
        )}

        {/* Enhanced Search Container - Only show on main page */}
        {!selectedFolder && (
        <div className="flex justify-center mb-12">
          <div className={`relative w-full max-w-2xl transition-all duration-500 ${
            isFocused ? 'scale-105' : 'scale-100'
          }`}>
            {/* Floating Background with Glass Effect */}
            <div className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
              isFocused 
                ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 shadow-2xl shadow-cyan-500/25' 
                : 'bg-white/10 shadow-lg'
            } backdrop-blur-md border border-white/20`}></div>
            
            {/* Animated Border Glow */}
            <div className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
              isFocused 
                ? 'bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 p-0.5' 
                : 'p-0'
            }`}>
              <div className="w-full h-full bg-transparent rounded-2xl"></div>
            </div>

            {/* Search Input Container */}
            <div className="relative z-10 p-2">
              <div className="relative">
                {/* Search Icon */}
                <div className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-all duration-300 z-20 ${
                  isFocused ? 'scale-110' : 'scale-100'
                }`}>
                  <img src={searchIcon} alt="Search" className="w-10 h-10 object-contain" />
                </div>

                {/* Main Search Input */}
                <Input
                  type="text"
                  placeholder="Search for games, tools, scripts, configs..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className={`pl-16 pr-16 py-6 text-lg rounded-xl border-0 bg-transparent focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none focus:border-transparent focus-visible:border-transparent placeholder:text-muted-foreground/70 transition-all duration-300 ${
                    isFocused ? 'placeholder:text-cyan-300/50' : ''
                  }`}
                  data-testid="search-input"
                />

                {/* Filter Icon */}
                <div className={`absolute right-6 top-1/2 transform -translate-y-1/2 transition-all duration-300 z-20 ${
                  isFocused ? 'scale-110' : 'scale-100'
                }`}>
                  <img src={filterIcon} alt="Filter" className="w-8 h-8 object-contain" />
                </div>
              </div>
            </div>

            {/* Floating Particles Effect */}
            {isFocused && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-8 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute top-8 right-12 w-1 h-1 bg-blue-400 rounded-full animate-ping opacity-50 animation-delay-300"></div>
                <div className="absolute bottom-6 left-16 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping opacity-60 animation-delay-700"></div>
                <div className="absolute bottom-4 right-8 w-1 h-1 bg-cyan-300 rounded-full animate-ping opacity-40 animation-delay-1000"></div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Search Stats/Suggestions with Back Button */}
        {!selectedFolder && searchQuery && (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground animate-fade-in">
              <span className="text-cyan-400 font-medium">Searching</span> for "{searchQuery}"
            </p>
            <Button
              onClick={() => onSearchChange('')}
              variant="outline"
              className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border-cyan-400/50 text-cyan-500 font-semibold hover:text-cyan-400 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25"
              data-testid="button-clear-search"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Clear Search
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
