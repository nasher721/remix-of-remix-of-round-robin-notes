import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import rollingRoundsLogo from "@/assets/rolling-rounds-logo.png";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === "email") fieldErrors.email = err.message;
          if (err.path[0] === "password") fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const validateField = (field: "email" | "password", value: string) => {
    try {
      if (field === "email") {
        z.string().email("Please enter a valid email address").parse(value);
        setErrors((prev) => ({ ...prev, email: undefined }));
      } else {
        z.string().min(6, "Password must be at least 6 characters").parse(value);
        setErrors((prev) => ({ ...prev, password: undefined }));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: error.errors[0]?.message }));
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Login failed",
            description: error.message.includes("Invalid login credentials")
              ? "Invalid email or password. Please try again."
              : error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back",
            description: "You have successfully logged in.",
          });
          navigate("/");
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast({
            title: "Sign up failed",
            description: error.message.includes("already registered")
              ? "This email is already registered. Please sign in instead."
              : error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Account created",
            description: "You can now sign in with your credentials.",
          });
          navigate("/");
        }
      }
    } catch (error) {
      toast({
        title: "Authentication error",
        description: "Something went wrong while processing your request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    const setProviderLoading = provider === "google" ? setGoogleLoading : setAppleLoading;
    const label = provider === "google" ? "Google" : "Apple";
    setProviderLoading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({
          title: `${label} sign-in failed`,
          description: error.message || `Could not sign in with ${label}. Please try again.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: `${label} sign-in failed`,
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProviderLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f7f9fb] px-4 py-6 text-slate-950 sm:px-6 lg:px-8" aria-labelledby="auth-heading">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <img src={rollingRoundsLogo} alt="" className="h-7 w-auto" aria-hidden="true" />
          Rolling Rounds
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:py-24">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Protected clinical workspace
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
              Sign in, then get straight to the patient list.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
              Rolling Rounds keeps authentication quiet and the workspace practical: notes, tasks, handoffs, and exports stay close.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Team sync", "Field history", "Print export"].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-950">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgb(15_23_42_/_0.08)] sm:p-8">
          <div className="mb-7">
            <h2 id="auth-heading" className="text-2xl font-semibold tracking-tight text-slate-950">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isLogin
                ? "Use your email and password to open the workspace."
                : "Create an account to start a workspace."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-800">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => e.target.value && validateField("email", e.target.value)}
                disabled={loading}
                startIcon={<Mail className="h-4 w-4" />}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                showSuccess={!errors.email && email.length > 0}
                className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-800">
                Password
              </Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={(e) => e.target.value && validateField("password", e.target.value)}
                disabled={loading}
                startIcon={<Lock className="h-4 w-4" />}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                showSuccess={!errors.password && password.length > 0}
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="rounded-md text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full rounded-lg font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Signing in" : "Creating account"}
                </>
              ) : isLogin ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase text-slate-500">Or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-lg border-slate-300 bg-white hover:bg-slate-50"
              onClick={() => handleOAuthSignIn("google")}
              disabled={loading || googleLoading || appleLoading}
            >
              {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-lg border-slate-300 bg-white hover:bg-slate-50"
              onClick={() => handleOAuthSignIn("apple")}
              disabled={loading || googleLoading || appleLoading}
            >
              {appleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue with Apple
            </Button>
          </div>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-600">
              {isLogin ? "Need an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Auth;
