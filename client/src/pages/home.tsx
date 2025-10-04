import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import SearchFilter from "@/components/search-filter";
import FileGrid from "@/components/file-grid";
import Footer from "@/components/footer";
import VideoTransition from "@/components/video-transition";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [pendingFolder, setPendingFolder] = useState<string | null>(null);

  const handleFolderSelect = (folderName: string | null) => {
    if (folderName) {
      // Play video transition before navigating to folder
      setPendingFolder(folderName);
      setIsVideoPlaying(true);
    } else {
      // Going back to folders - no video
      setSelectedFolder(null);
    }
  };

  const handleVideoComplete = () => {
    setIsVideoPlaying(false);
    setSelectedFolder(pendingFolder);
    setPendingFolder(null);
  };

  const { data: statsData } = useQuery({
    queryKey: ["/api/stats"],
    staleTime: 60000,
  });

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col"
         style={{ background: 'transparent' }}>

      <VideoTransition isPlaying={isVideoPlaying} onComplete={handleVideoComplete} />

      <Header />
      
      <main className="relative z-10 flex-grow">
        
        <SearchFilter 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFolder={selectedFolder}
        />
        
        <FileGrid 
          category={selectedCategory}
          searchQuery={searchQuery}
          sortBy={sortBy}
          selectedFolder={selectedFolder}
          onFolderSelect={handleFolderSelect}
        />
        
      </main>

      <Footer />
    </div>
  );
}
