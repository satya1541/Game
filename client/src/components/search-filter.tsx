import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function SearchFilter({ 
  searchQuery, 
  onSearchChange
}: SearchFilterProps) {

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-center mb-8">
          {/* Search Input */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-12 bg-input border-border focus:ring-ring"
              data-testid="search-input"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
