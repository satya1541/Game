import { Sparkles, Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border/50">
      <div className="absolute inset-0 bg-gradient-to-t from-secondary/50 to-transparent pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-primary">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold font-display text-gradient">H4VX</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {currentYear} H4VX. <Heart className="w-3 h-3 text-red-500 fill-red-500 inline" />
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
