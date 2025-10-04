import { lazy, Suspense } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";

// Lazy load the upload zone for better performance
const UploadZone = lazy(() => import("@/components/upload-zone"));

export default function Upload() {
  return (
    <div className="min-h-screen text-foreground font-sans flex flex-col" style={{ background: 'transparent' }}>

      <Header />
      
      <main className="relative z-10 flex-grow">
        <Suspense fallback={
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl md:text-6xl font-gaming font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent animate-float">
                UPLOAD YOUR FILES
              </h2>
              <div className="upload-zone glow-border rounded-xl p-12 mb-8 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center animate-pulse">
                    <div className="w-8 h-8 bg-primary/50 rounded"></div>
                  </div>
                  <div className="h-8 bg-muted/50 rounded w-64 mx-auto mb-4 animate-pulse"></div>
                  <div className="h-4 bg-muted/30 rounded w-48 mx-auto mb-6 animate-pulse"></div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="bg-muted/40 px-3 py-1 rounded-full w-12 h-6 animate-pulse"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        }>
          <UploadZone />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}