import { Route, Switch, Redirect, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { isNative } from "@/lib/native";
import { Loader2 } from "lucide-react";
import { useMe } from "@/lib/hooks";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Studio from "@/pages/Studio";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import { ForgotPassword, ResetPassword } from "@/pages/Recover";
import NotFound from "@/pages/NotFound";
import type { ReactNode } from "react";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useMe();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin" aria-label="Cargando" /></div>;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router hook={isNative ? useHashLocation : undefined}>
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login"><AuthPage mode="login" /></Route>
      <Route path="/registro"><AuthPage mode="register" /></Route>
      <Route path="/olvide" component={ForgotPassword} />
      <Route path="/restablecer" component={ResetPassword} />
      <Route path="/precios" component={Pricing} />
      <Route path="/pricing"><Redirect to="/precios" /></Route>
      <Route path="/dashboard"><Protected><Dashboard /></Protected></Route>
      <Route path="/account"><Protected><Account /></Protected></Route>
      <Route path="/studio/:id">{(p) => <Protected><Studio id={Number(p.id)} /></Protected>}</Route>
      <Route component={NotFound} />
    </Switch>
    </Router>
  );
}
