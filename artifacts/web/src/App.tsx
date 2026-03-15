import { Switch, Route, Router as WouterRouter, Link, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import UserAnalysisPage from "@/pages/user-analysis";
import NotFound from "@/pages/not-found";
import { Activity, Search, User } from "lucide-react";

const queryClient = new QueryClient();

function NavTab({ href, children }: { href: string; children: React.ReactNode }) {
  const [isActive] = useRoute(href === "/" ? "/" : `${href}/:rest*`);
  const exactActive = href === "/" ? isActive : useRoute(href)[0] || isActive;
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        exactActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </Link>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex h-screen flex-col">
        <header className="flex items-center gap-4 px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2 mr-4">
            <Activity className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg">Tweet Pulse</h1>
          </div>
          <nav className="flex items-center gap-1">
            <NavTab href="/">
              <Search className="w-3.5 h-3.5" />
              Keyword Search
            </NavTab>
            <NavTab href="/user-analysis">
              <User className="w-3.5 h-3.5" />
              User Analysis
            </NavTab>
          </nav>
        </header>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/user-analysis" component={UserAnalysisPage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
