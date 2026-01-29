interface AmbientBackgroundProps {
  className?: string;
}

export function AmbientBackground({ className }: AmbientBackgroundProps) {
  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      {/* Primary warm glow - top right */}
      <div
        className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full bg-gradient-radial from-lumina-glow/60 via-lumina-amber/20 to-transparent animate-breathe"
        style={{ filter: "blur(100px)" }}
      />
      
      {/* Secondary glow - bottom left */}
      <div
        className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-radial from-lumina-amber/40 via-lumina-cream/10 to-transparent animate-breathe"
        style={{ filter: "blur(80px)", animationDelay: "2s" }}
      />
      
      {/* Subtle center glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-radial from-lumina-gold/10 to-transparent animate-breathe"
        style={{ filter: "blur(60px)", animationDelay: "1s" }}
      />
    </div>
  );
}
