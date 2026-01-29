import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ConversationSpaceProps {
  conversationId: string;
  onBack: () => void;
}

export function ConversationSpace({ conversationId, onBack }: ConversationSpaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const saveMessage = async (role: "user" | "assistant", content: string) => {
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single();
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message immediately
    const tempUserId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempUserId, role: "user", content: userMessage }]);

    // Save user message
    await saveMessage("user", userMessage);

    // Prepare messages for AI
    const aiMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    // Stream AI response
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: aiMessages }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const tempAssistantId = `temp-assistant-${Date.now()}`;

      // Add empty assistant message
      setMessages((prev) => [
        ...prev,
        { id: tempAssistantId, role: "assistant", content: "" },
      ]);

      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId ? { ...m, content: assistantContent } : m
                )
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await saveMessage("assistant", assistantContent);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "I'm having trouble responding right now. Let's try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-gentle font-serif"
        >
          ← Back
        </button>
        <span className="font-serif text-lg text-foreground/80">Lumina</span>
        <div className="w-12" />
      </header>

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 md:px-8">
        <div className="max-w-2xl mx-auto py-8 space-y-8">
          {messages.length === 0 && (
            <div className="text-center py-20 animate-fade-in-up">
              <p className="font-serif text-2xl text-muted-foreground leading-relaxed">
                What's on your mind today?
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`animate-fade-in-up ${
                message.role === "user" ? "ml-8 md:ml-16" : "mr-8 md:mr-16"
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {message.role === "assistant" ? (
                <div className="space-y-4">
                  <div className="prose prose-lg max-w-none text-foreground font-serif leading-relaxed">
                    <ReactMarkdown>{message.content || "..."}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="bg-card/60 rounded-2xl p-5 shadow-gentle">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              )}
            </div>
          ))}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border/30 bg-background/80 backdrop-blur-sm">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto p-4 md:p-6"
        >
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              className="min-h-[60px] max-h-[200px] resize-none bg-card/60 border-border/50 rounded-2xl pr-14 py-4 px-5 text-base placeholder:text-muted-foreground/50 focus:ring-lumina-gold/30 transition-gentle"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="absolute bottom-3 right-3 h-10 w-10 rounded-xl bg-lumina-gold hover:bg-lumina-gold/90 text-white transition-gentle shadow-gentle disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
