import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AuthFormProps {
  onSuccess: () => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });

        if (error) throw error;
        
        toast({
          title: "Welcome to Lumina",
          description: "Your journey begins now.",
        });
        onSuccess();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        toast({
          title: "Welcome back",
          description: "It's good to see you again.",
        });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Something went wrong",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto animate-fade-in-up" style={{ animationDelay: "0.4s", animationFillMode: "both" }}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {isSignUp && (
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-serif text-muted-foreground">
              What should I call you?
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="bg-card border-border/50 rounded-xl h-12 px-4 text-base placeholder:text-muted-foreground/50 focus:ring-lumina-gold/30 transition-gentle"
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-serif text-muted-foreground">
            {isSignUp ? "So I can remember our conversations" : "Your email"}
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="bg-card border-border/50 rounded-xl h-12 px-4 text-base placeholder:text-muted-foreground/50 focus:ring-lumina-gold/30 transition-gentle"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-serif text-muted-foreground">
            {isSignUp ? "Create a password" : "Your password"}
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-card border-border/50 rounded-xl h-12 px-4 text-base placeholder:text-muted-foreground/50 focus:ring-lumina-gold/30 transition-gentle"
            required
            minLength={6}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-xl bg-lumina-gold hover:bg-lumina-gold/90 text-white font-medium transition-gentle shadow-gentle hover:shadow-warm"
        >
          {isLoading ? (
            <span className="animate-pulse">...</span>
          ) : isSignUp ? (
            "Begin my journey"
          ) : (
            "Continue my journey"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground font-serif">
        {isSignUp ? "Already started your journey?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-foreground underline underline-offset-4 hover:text-lumina-gold transition-gentle"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
