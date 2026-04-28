import { useEffect, useState } from "react";
import { TopBar } from "@/components/runner/TopBar";
import { RepoInputBar } from "@/components/runner/RepoInputBar";
import { StepsRail } from "@/components/runner/StepsRail";
import { LogsPanel } from "@/components/runner/LogsPanel";
import { PreviewPanel } from "@/components/runner/PreviewPanel";
import { StatusBar } from "@/components/runner/StatusBar";
import { HistoryPanel } from "@/components/runner/HistoryPanel";
import { SmartExecutionCard } from "@/components/runner/SmartExecutionCard";
import { useRunner } from "@/hooks/useRunner";
import { cn } from "@/lib/utils";

const Index = () => {
  const runner = useRunner();
  const [showPreview, setShowPreview] = useState(true);

  // SEO
  useEffect(() => {
    document.title = "RepoXpose — Paste. Run. Reveal.";
    const meta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    meta("description", "Paste a GitHub repo URL and run it instantly inside an isolated Docker container with live logs and preview.");
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <RepoInputBar
        onRun={runner.run}
        onStop={runner.stop}
        onRetry={runner.retry}
        status={runner.status}
        currentUrl={runner.repoUrl}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(s => !s)}
      />
      <StepsRail steps={runner.steps} />

      <main className="flex-1 container py-4">
        <div className="grid grid-cols-12 gap-3 h-[calc(100vh-13.5rem)] min-h-[520px]">
          {/* Left panel: History + Smart Execution */}
          <aside className="hidden xl:flex xl:flex-col col-span-2 gap-3 min-h-0">
            <div className="flex-shrink-0 h-[208px]">
              <HistoryPanel history={runner.history} onSelect={runner.run} />
            </div>
            {runner.executionInfo && (
              <SmartExecutionCard info={runner.executionInfo} onRetry={runner.retry} />
            )}
          </aside>

          {/* Logs */}
          <section
            className={cn(
              "col-span-12 min-h-[400px] lg:min-h-0",
              showPreview
                ? "lg:col-span-6 xl:col-span-5"
                : "lg:col-span-12 xl:col-span-10"
            )}
          >
            <LogsPanel logs={runner.logs} status={runner.status} onClear={runner.clearLogs} />
          </section>

          {/* Preview */}
          {showPreview && (
            <section className="col-span-12 lg:col-span-6 xl:col-span-5 min-h-[400px] lg:min-h-0">
              <PreviewPanel
                status={runner.status}
                projectType={runner.projectType}
                repoName={runner.repoName}
                onClose={() => setShowPreview(false)}
              />
            </section>
          )}
        </div>
      </main>

      <StatusBar
        status={runner.status}
        projectType={runner.projectType}
        repoName={runner.repoName}
        elapsedMs={runner.elapsedMs}
      />
    </div>
  );
};

export default Index;
