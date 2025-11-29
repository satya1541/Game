import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-background text-foreground flex flex-col"
    >
      <Header />
      
      <main className="flex-grow">
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
    </motion.div>
  );
}
