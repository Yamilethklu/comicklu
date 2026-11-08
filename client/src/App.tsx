import { Route, Switch, Redirect, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { isNative } from "@/lib/native";
import { Loader2 } from "lucide-react";
import { useMe } from "@/lib/hooks";
import { ToastProvider } from "@/components/Toast";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Explorar from "@/pages/Explorar";
import Notifications from "@/pages/Notifications";
const Creador = lazy(() => import("@/pages/Creador"));
const Studio = lazy(() => import("@/pages/Studio"));
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import { ForgotPassword, ResetPassword } from "@/pages/Recover";
import NotFound from "@/pages/NotFound";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense, type ReactNode, useState, useEffect } from "react";
import { getSavedTheme, applyTheme } from "@/lib/theme";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useMe();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin" aria-label="Cargando" /></div>;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

export default function App() {
  const [, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = getSavedTheme();
    applyTheme(saved);
    
  }, []);

  return (
    <ToastProvider>
      <ErrorBoundary>
        <Router hook={isNative ? useHashLocation : undefined}>
        <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin" aria-label="Cargando" /></div>}>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/login"><AuthPage mode="login" /></Route>
          <Route path="/registro"><AuthPage mode="register" /></Route>
          <Route path="/olvide" component={ForgotPassword} />
          <Route path="/restablecer" component={ResetPassword} />
          <Route path="/explorar" component={Explorar} />
          <Route path="/precios" component={Pricing} />
          <Route path="/pricing"><Redirect to="/precios" /></Route>
          <Route path="/creador/:userId"><Creador /></Route>
          <Route path="/dashboard"><Protected><Dashboard /></Protected></Route>
          <Route path="/account"><Protected><Account /></Protected></Route>
          <Route path="/notifications"><Protected><Notifications /></Protected></Route>
          <Route path="/studio/:id">{ (p) => <Protected><Studio id={Number(p.id)} /></Protected> }</Route>
          <Route component={NotFound} />
        </Switch>
        </Suspense>
        </Router>
      </ErrorBoundary>
    </ToastProvider>
  );
}
