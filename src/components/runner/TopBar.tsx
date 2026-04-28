import { Github, Terminal } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const TopBar = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Terminal className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-[15px] font-semibold tracking-tight">
                RepoXpose
              </h1>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
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
