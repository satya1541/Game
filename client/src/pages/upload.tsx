import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import Header from "@/components/header";
import Footer from "@/components/footer";

const UploadZone = lazy(() => import("@/components/upload-zone"));

export default function Upload() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-background text-foreground flex flex-col"
    >
      <Header />
      
      <main className="flex-grow">
        <Suspense fallback={
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-display font-bold mb-6"
              >
                <span className="text-gradient">Upload Your Files</span>
              </motion.h2>
              <div className="premium-card rounded-2xl p-12 mb-8">
                <div className="relative z-10">
                  <div className="loader-ring mx-auto mb-6" />
                  <div className="h-6 bg-muted rounded w-48 mx-auto mb-4 animate-pulse" />
                  <div className="h-4 bg-muted/50 rounded w-64 mx-auto animate-pulse" />
                </div>
              </div>
            </div>
          </section>
        }>
          <UploadZone />
        </Suspense>
      </main>

      <Footer />
    </motion.div>
  );
}
