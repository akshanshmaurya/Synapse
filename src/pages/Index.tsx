import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/AmbientBackground";
import { AuthForm } from "@/components/AuthForm";
import { ConversationSpace } from "@/components/ConversationSpace";

const Index = () => {
  const { user, isLoading, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadOrCreateConversation();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (data?.name) {
      setProfileName(data.name);
    }
  };

  const loadOrCreateConversation = async () => {
    if (!user) return;

    // Try to get existing conversation
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setActiveConversationId(existing.id);
    } else {
      // Create new conversation
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: "My Journey" })
        .select()
        .single();

      if (newConvo) {
        setActiveConversationId(newConvo.id);
      }
    }
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AmbientBackground />
        <div className="animate-breathe">
          <span className="font-serif text-2xl text-muted-foreground">...</span>
        </div>
      </div>
    );
  }

  // Show conversation space when logged in and conversation is ready
  if (user && activeConversationId) {
    return (
      <ConversationSpace
        conversationId={activeConversationId}
        onBack={async () => {
          await signOut();
          setActiveConversationId(null);
          setShowAuth(false);
        }}
      />
    );
  }

  // Show auth form
  if (showAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <AmbientBackground />
        <div className="relative z-10 w-full max-w-md">
          <button
            onClick={() => setShowAuth(false)}
            className="mb-8 text-sm text-muted-foreground hover:text-foreground transition-gentle font-serif"
          >
            ← Back
          </button>
          <AuthForm onSuccess={handleAuthSuccess} />
        </div>
      </div>
    );
  }

  // Landing page
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <AmbientBackground />
      
      <main className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Main message */}
        <h1 
          className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight mb-8 animate-fade-in-up"
        >
          You don't have to have it all figured out.
        </h1>
        
        <p 
          className="font-serif text-xl md:text-2xl text-muted-foreground mb-16 animate-fade-in-up"
          style={{ animationDelay: "0.2s", animationFillMode: "both" }}
        >
          Let's explore together.
        </p>

        {/* Gentle invitation */}
        <button
          onClick={() => setShowAuth(true)}
          className="group relative animate-fade-in-up"
          style={{ animationDelay: "0.4s", animationFillMode: "both" }}
        >
          <span className="font-serif text-lg text-muted-foreground group-hover:text-foreground transition-gentle">
            Begin your journey
          </span>
          <span className="block h-px w-0 group-hover:w-full bg-lumina-gold/50 transition-all duration-500 ease-out mt-1" />
        </button>
      </main>

      {/* Subtle footer */}
      <footer className="absolute bottom-6 left-0 right-0 text-center">
        <p className="font-serif text-sm text-muted-foreground/60 animate-fade-in-up" style={{ animationDelay: "0.6s", animationFillMode: "both" }}>
          Lumina — Your AI mentor for career guidance
        </p>
      </footer>
    </div>
  );
};

export default Index;
