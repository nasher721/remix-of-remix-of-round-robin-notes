import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import rollingRoundsLogo from "@/assets/rolling-rounds-logo.png";
import { z } from "zod";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login Failed",
              description: "Invalid email or password. Please try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Login Failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You have successfully logged in.",
          });
          navigate("/");
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account Exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Sign Up Failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Account Created!",
            description: "You can now sign in with your credentials.",
          });
          navigate("/");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Panel - Hero/Branding (Desktop only) */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 z-0" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10" />

        <div className="relative z-10 text-white space-y-6 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
              <img src={rollingRoundsLogo} alt="Logo" className="h-10 w-10 brightness-0 invert" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Rolling Rounds</h1>
          </div>
          <h2 className="text-4xl font-bold leading-tight">
            Streamline your medical rounds with intelligence.
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            The modern platform for healthcare professionals to manage patient data, track rounds, and collaborate efficiently.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <h3 className="font-semibold text-lg mb-1">Smart Tracking</h3>
              <p className="text-slate-400 text-sm">Automated patient status updates and history.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <h3 className="font-semibold text-lg mb-1">Secure & Safe</h3>
              <p className="text-slate-400 text-sm">HIPAA compliant data protection.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <img src={rollingRoundsLogo} alt="Logo" className="h-12 w-auto mx-auto lg:mx-0 lg:hidden mb-4" />
            <h2 className="text-3xl font-bold tracking-tight">
              {isLogin ? "Welcome back" : "Create an account"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin
                ? "Enter your credentials to access your account"
                : "Enter your information to get started"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  startIcon={<Mail className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.email)}
                  showSuccess={!errors.email && email.length > 0}
                  className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  startIcon={<Lock className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.password)}
                  showSuccess={!errors.password && password.length > 0}
                  endIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="focus:outline-none hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                  className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="text-primary hover:underline font-semibold"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
