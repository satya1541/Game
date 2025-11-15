import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import SearchFilter from "@/components/search-filter";
import FileGrid from "@/components/file-grid";
import Footer from "@/components/footer";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const handleFolderSelect = (folderName: string | null) => {
    setSelectedFolder(folderName);
  };

  const { data: statsData } = useQuery({
    queryKey: ["/api/stats"],
    staleTime: 60000,
  });

  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col"
         style={{ background: 'transparent' }}>

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
