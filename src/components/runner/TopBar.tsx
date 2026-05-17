import { Github, Terminal } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const TopBar = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-3 group cursor-pointer select-none">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-border shadow-sm overflow-hidden transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_12px_rgba(34,197,94,0.15)]">
            <img 
              src="/RunForge-Logo.png" 
              alt="RunForge Logo" 
              className="h-6 w-6 object-contain transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.getElementById('logo-fallback-icon');
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            <div id="logo-fallback-icon" className="hidden absolute inset-0 flex items-center justify-center bg-primary text-primary-foreground">
              <Terminal className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-[16px] font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent group-hover:to-primary transition-all duration-300">
                RunForge
              </h1>
              <span className="text-[9px] font-semibold px-1.5 py-px rounded bg-primary/10 text-primary border border-primary/20 scale-90 origin-left">
                v1.0
              </span>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wide group-hover:text-foreground/75 transition-colors">
              Paste. Run. Reveal.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border border-border text-[11px] font-medium text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span>Operational</span>
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex h-8 items-center gap-1.5 px-2.5 rounded-md border border-border text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
