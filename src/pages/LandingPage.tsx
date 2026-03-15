import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { LogIn, UserPlus, ArrowRight, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRef, useEffect, useState, useCallback } from "react";
import Logo from "@/components/Logo";

/* ──────────────────────────────────────────────
   Scroll-Reveal utility
   ────────────────────────────────────────────── */
function ScrollReveal({
    children,
    delay = 0,
    className = "",
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
            transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/* ──────────────────────────────────────────────
   Main Landing Page
   ────────────────────────────────────────────── */
export default function LandingPage() {
    const { isAuthenticated, onboardingComplete } = useAuth();
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const getAuthenticatedPath = () => {
        if (!onboardingComplete) return "/onboarding";
        return "/dashboard";
    };

    // Mouse parallax for monoliths (disabled on touch devices)
    const handleMouseMove = useCallback((e: MouseEvent) => {
        // Simple touch detection - don't run heavy parallax on mobile
        if (window.innerWidth < 1024) return;
        
        setMousePos({
            x: (e.clientX / window.innerWidth - 0.5) * 20,
            y: (e.clientY / window.innerHeight - 0.5) * 20,
        });
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [handleMouseMove]);

    // Scroll progress for SVG path
    const processRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({
        target: processRef,
        offset: ["start end", "end start"],
    });
    const pathLength = useTransform(scrollYProgress, [0.1, 0.9], [0, 1]);

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-x-hidden">
            {/* Grain Texture Overlay */}
            <div className="grain-overlay" />

            {/* Ambient Glow */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                aria-hidden="true"
            >
                <div className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/8 blur-[100px]" />
                <div className="absolute top-1/3 -left-32 w-[300px] md:w-[500px] h-[300px] md:h-[500px] rounded-full bg-[#D4A574]/10 blur-[80px] md:blur-[100px]" style={{ willChange: "transform" }} />
            </div>

            {/* ─── Header ─── */}
            <div className="nav-wrapper">
                <nav
                    className="custom-navbar"
                    style={{
                        transform: window.innerWidth > 900 ? `rotateY(${-(mousePos.x / 1.5)}deg) rotateX(${mousePos.y / 1.5}deg)` : 'none',
                    }}
                >
                    <Link to="/" className="nav-logo-block shrink-0">
                        <div className="nav-logo-type">Synapse</div>
                    </Link>

                    {/* Desktop Links */}
                    <div className="nav-links-container hidden lg:flex">
                        {[
                            { path: "#hero", label: "Overview", num: "01" },
                            { path: "#process", label: "How It Works", num: "02" },
                            { path: "#quarry", label: "Differentiation", num: "03" },
                            { path: "#archive", label: "Audience", num: "04" },
                        ].map((item, i) => (
                            <a
                                key={item.label}
                                href={item.path}
                                onClick={(e) => {
                                    e.preventDefault();
                                    document.querySelector(item.path)?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="nav-item-link"
                                style={{
                                    animation: `navReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.1}s backwards`,
                                }}
                            >
                                <span className="index">{item.num}</span>
                                {item.label}
                            </a>
                        ))}
                    </div>

                    <div className="nav-divider-line hidden lg:block"></div>

                    {/* Desktop Actions */}
                    <div className="nav-actions-container hidden lg:flex">
                        <div className="nav-time-display text-[#8B8178]">
                            <span style={{ letterSpacing: "0.2em" }}>SYSTEM READY</span>
                            <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })} <span className="nav-status-dot"></span></span>
                        </div>
                        {isAuthenticated ? (
                            <Link to={getAuthenticatedPath()} className="nav-cta-button whitespace-nowrap">
                                Dashboard
                            </Link>
                        ) : (
                            <Link to="/signin" className="nav-cta-button whitespace-nowrap">
                                Sign In
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex lg:hidden items-center ml-auto pr-6">
                        <button 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 text-[#5C6B4A]"
                            aria-label="Toggle menu"
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </nav>
            </div>

            {/* Mobile Navigation Dropdown */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 top-[80px] z-[40] bg-[#FDF8F3] overflow-y-auto px-6 py-8"
                    >
                        <div className="flex flex-col gap-6">
                            {[
                                { path: "#hero", label: "Overview", num: "01" },
                                { path: "#process", label: "How It Works", num: "02" },
                                { path: "#quarry", label: "Differentiation", num: "03" },
                                { path: "#archive", label: "Audience", num: "04" },
                            ].map((item) => (
                                <a
                                    key={item.label}
                                    href={item.path}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsMobileMenuOpen(false);
                                        document.querySelector(item.path)?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="flex items-center gap-4 text-2xl font-semibold text-[#5C6B4A] border-b border-[#5C6B4A]/10 pb-4"
                                    style={{ fontFamily: "'Space Mono', monospace" }}
                                >
                                    <span className="text-sm opacity-40">{item.num}</span>
                                    {item.label}
                                </a>
                            ))}
                            
                            <div className="mt-8 flex flex-col gap-4">
                                {isAuthenticated ? (
                                    <Link 
                                        to={getAuthenticatedPath()} 
                                        className="w-full py-4 text-center bg-[#5C6B4A] text-[#FDF8F3] rounded-xl font-bold font-mono tracking-widest uppercase text-sm shadow-xl"
                                    >
                                        DASHBOARD
                                    </Link>
                                ) : (
                                    <>
                                        <Link 
                                            to="/signup" 
                                            className="w-full py-4 text-center bg-[#5C6B4A] text-[#FDF8F3] rounded-xl font-bold font-mono tracking-widest uppercase text-sm shadow-xl"
                                        >
                                            BEGIN NOW
                                        </Link>
                                        <Link 
                                            to="/signin" 
                                            className="w-full py-4 text-center border-2 border-[#5C6B4A]/30 text-[#5C6B4A] rounded-xl font-bold font-mono tracking-widest text-sm uppercase"
                                        >
                                            SIGN IN
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════
                SECTION 1: HERO — Monolith Pillars
               ════════════════════════════════════════════ */}
            <section id="hero" className="relative min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-center px-6 md:px-[8%] gap-8 lg:gap-16 pt-32 lg:pt-24 pb-20">
                {/* Background Glow */}
                <div className="absolute text-[#5C6B4A] top-20 right-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[radial-gradient(circle,rgba(92,107,74,0.06)_0%,transparent_70%)] blur-[40px] md:blur-[60px] pointer-events-none z-0" style={{ willChange: "transform" }} />

                {/* Hero Content */}
                <div className="z-10 max-w-[640px] text-center lg:text-left mx-auto lg:mx-0">
                    <motion.span
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="mono-tag text-[#8B8178] mb-6 inline-block"
                    >
                        // Your AI Mentor
                    </motion.span>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.8,
                            delay: 0.1,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                        className="font-serif text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-[#5C6B4A] mb-6"
                    >
                        Your career path, carved from the{" "}
                        <span className="text-[#8B8178]/60">raw stone</span> of
                        potential.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.8,
                            delay: 0.2,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                        className="text-lg md:text-xl text-[#8B8178] leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0"
                    >
                        A mentor that remembers your goals, adapts to your
                        struggles, and builds a path forward with you — session
                        after session.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.8,
                            delay: 0.3,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                        className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
                    >
                        {isAuthenticated ? (
                            <Link
                                to={getAuthenticatedPath()}
                                className="group inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-white rounded-full font-semibold text-base transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,0,0,0.15)]"
                            >
                                Continue with your mentor
                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to="/signup"
                                    className="group inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-white rounded-full font-semibold text-base transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,0,0,0.15)]"
                                >
                                    <span className="relative z-10">
                                        Begin with your mentor
                                    </span>
                                    <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />
                                </Link>
                                <Link
                                    to="/signin"
                                    className="inline-flex items-center gap-2 px-6 py-3 text-[#5C6B4A] font-medium border border-[#E8DED4] rounded-full transition-all duration-300 hover:bg-[#E8DED4]"
                                >
                                    I have an account
                                </Link>
                            </>
                        )}
                    </motion.div>
                </div>

                {/* Monolith Pillars (Hidden on mobile to save space, but visible tablet+) */}
                <div className="relative h-[40vh] md:h-[50vh] lg:h-[80vh] flex items-center justify-center -mt-10 lg:mt-0">
                    <div className="flex gap-4 md:gap-8 items-end h-full w-full justify-center max-w-[500px] lg:max-w-none">
                        {[
                            {
                                label: "MEMORY.SYS",
                                height: "60%",
                                width: "30%",
                                delay: 0,
                            },
                            {
                                label: "GROWTH.CORE",
                                height: "85%",
                                width: "35%",
                                delay: -1.5,
                            },
                            {
                                label: "ADAPT.PATH",
                                height: "50%",
                                width: "30%",
                                delay: -3,
                            },
                        ].map((pillar, i) => (
                            <motion.div
                                key={pillar.label}
                                animate={{
                                    y: [0, -15, 0],
                                }}
                                transition={{
                                    duration: 6,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: pillar.delay,
                                }}
                                style={{
                                    height: pillar.height,
                                    width: pillar.width,
                                    maxWidth: "160px",
                                    transform: `translate(${mousePos.x * (i + 1) * 0.5}px, ${mousePos.y * (i + 1) * 0.5}px)`,
                                    willChange: "transform"
                                }}
                                className="monolith"
                            >
                                <span
                                    className="mono-tag text-[0.65rem] text-[#8B8178]/60 mx-auto mb-4"
                                    style={{
                                        writingMode: "vertical-rl",
                                        textOrientation: "mixed",
                                        transform: "rotate(180deg)",
                                        letterSpacing: "0.2em",
                                    }}
                                >
                                    {pillar.label}
                                </span>
                                <div className="w-2.5 h-2.5 bg-[#5C6B4A] rounded-full mx-auto" />
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Scroll Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.5 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                >
                    <span className="text-sm text-[#8B8178]/50 font-light hidden sm:block">
                        Scroll to explore
                    </span>
                    <motion.div
                        animate={{ y: [0, 6, 0] }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        className="w-5 h-8 rounded-full border-2 border-[#8B8178]/30 items-start justify-center p-1 hidden sm:flex"
                        style={{ willChange: "transform" }}
                    >
                        <div className="w-1 h-2 rounded-full bg-[#8B8178]/40" />
                    </motion.div>
                </motion.div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 2: HOW THIS MENTOR HELPS — SVG Path
               ════════════════════════════════════════════ */}
            <section
                id="process"
                ref={processRef}
                className="relative py-24 md:py-32 px-6 md:px-[10%] bg-[#4A5A3A] text-white overflow-hidden"
            >
                {/* SVG Channel System (Simplified vertical line on mobile) */}
                <div className="absolute top-0 bottom-0 left-6 md:left-1/2 w-px bg-white/10 md:hidden z-0" />
                <motion.div 
                    className="absolute top-0 bottom-0 left-6 md:left-1/2 w-0.5 bg-[#FDF8F3] origin-top md:hidden z-0 shadow-[0_0_10px_rgba(253,248,243,0.8)]"
                    style={{ scaleY: pathLength, willChange: "transform" }}
                />

                <svg
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none hidden md:block"
                    preserveAspectRatio="none"
                    viewBox="0 0 1200 2000"
                >
                    <path
                        className="channel-path-bg"
                        style={{ stroke: "rgba(255,255,255,0.06)" }}
                        d="M 600 0 L 600 200 C 600 350 300 350 300 500 L 300 700 C 300 850 900 850 900 1000 L 900 1200 C 900 1350 600 1350 600 1500 L 600 2000"
                    />
                    <motion.path
                        className="channel-path-active"
                        style={{
                            stroke: "#7A8B5A",
                            pathLength,
                        }}
                        d="M 600 0 L 600 200 C 600 350 300 350 300 500 L 300 700 C 300 850 900 850 900 1000 L 900 1200 C 900 1350 600 1350 600 1500 L 600 2000"
                    />
                </svg>

                {/* Content Nodes */}
                <div className="relative z-10 flex flex-col gap-16 md:gap-48 lg:gap-72 max-w-6xl mx-auto pl-6 md:pl-0">
                    {[
                        {
                            phase: "Phase_01 // Discovery",
                            title: "You Share\nWhere You Are",
                            desc: "Talk about your situation, your goals, what's confusing you. There's no form to fill—just a conversation with a mentor that listens.",
                            num: "01",
                        },
                        {
                            phase: "Phase_02 // Memory",
                            title: "Your Mentor\nRemembers",
                            desc: "Every session builds on the last. Your goals, struggles, and progress stay with you—no need to repeat yourself.",
                            num: "02",
                        },
                        {
                            phase: "Phase_03 // Structure",
                            title: "A Roadmap\nTakes Shape",
                            desc: "Together, you build a personalized path forward. It's not a generic plan—it's based on your context and adapts when things change.",
                            num: "03",
                        },
                        {
                            phase: "Phase_04 // Adaptation",
                            title: "Watch It\nAdapt",
                            desc: "If something isn't working, the roadmap adjusts. There's no shame in changing direction—that's how real growth works.",
                            num: "04",
                        },
                    ].map((node, i) => (
                        <ScrollReveal key={node.num} delay={0.1}>
                            <div
                                className={`grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-16 items-center relative ${
                                    i % 2 === 1 ? "md:text-right" : ""
                                }`}
                            >
                                {/* Mobile node dot indicator */}
                                <div className="absolute -left-9 top-6 w-5 h-5 rounded-full bg-[#4A5A3A] border-4 border-[#FDF8F3] md:hidden z-10 shadow-[0_0_10px_rgba(253,248,243,0.5)]" />

                                <div
                                    className={`max-w-[500px] ${
                                        i % 2 === 1
                                            ? "md:order-2 md:ml-auto"
                                            : ""
                                    }`}
                                >
                                    <div
                                        className={`flex items-center gap-4 mb-2 md:mb-4 ${
                                            i % 2 === 1
                                                ? "flex-row md:flex-row-reverse"
                                                : "flex-row"
                                        }`}
                                    >
                                        <div className="w-10 h-px bg-white/20 hidden md:block" />
                                        <span className="mono-tag text-[10px] md:text-xs text-white/40 tracking-[0.2em] md:tracking-[0.3em]">
                                            {node.phase}
                                        </span>
                                    </div>
                                    <h2
                                        className="text-[clamp(1.75rem,4vw,3.5rem)] font-extrabold leading-[1.1] md:leading-[0.9] tracking-tight uppercase mb-4 md:mb-6 whitespace-pre-line"
                                        style={{
                                            fontFamily:
                                                "'Inter', sans-serif",
                                        }}
                                    >
                                        {node.title}
                                    </h2>
                                    <p
                                        className={`mono-tag text-sm text-white/40 leading-relaxed max-w-[40ch] font-normal normal-case tracking-normal ${
                                            i % 2 === 1 ? "md:ml-auto" : ""
                                        }`}
                                        style={{
                                            letterSpacing: "0.01em",
                                            textTransform: "none",
                                        }}
                                    >
                                        {node.desc}
                                    </p>
                                </div>

                                {/* Large Ghost Number */}
                                <div
                                    className={`hidden md:flex items-center justify-center ${
                                        i % 2 === 1 ? "md:order-1" : ""
                                    }`}
                                >
                                    <span
                                        className="text-[12vw] font-black select-none"
                                        style={{
                                            fontFamily:
                                                "'Inter', sans-serif",
                                            color: "transparent",
                                            WebkitTextStroke:
                                                "1px rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        {node.num}
                                    </span>
                                </div>
                            </div>
                        </ScrollReveal>
                    ))}
                </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 3: WHY IT'S DIFFERENT — Bento Grid
               ════════════════════════════════════════════ */}
            <section id="quarry" className="relative py-20 md:py-32 px-4 md:px-12 lg:px-24 bg-[#FDF8F3]">
                {/* Radial Glows */}
                <div className="absolute -top-[10%] -left-[10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,transparent_70%)] blur-[40px] opacity-60 pointer-events-none" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,transparent_70%)] blur-[40px] opacity-40 pointer-events-none" />

                <div className="max-w-7xl mx-auto relative z-10">
                    {/* Header */}
                    <ScrollReveal className="mb-12 md:mb-20">
                        <span className="mono-tag text-[#8B8178] mb-4 block text-xs md:text-sm">
                            Section // 03 — The Differentiation
                        </span>
                        <h2
                            className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#5C6B4A] leading-[1.1]"
                            style={{
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            Beyond{" "}
                            <span className="bg-gradient-to-br from-[#5C6B4A] to-[#8B8178] bg-clip-text text-transparent">
                                Chatbots.
                            </span>
                            <br />
                            Into{" "}
                            <span className="italic font-light text-[#8B8178]">
                                Mentorship.
                            </span>
                        </h2>
                        <p className="mt-8 text-lg text-[#8B8178] max-w-xl leading-relaxed">
                            We aren't a generic AI chatbot. Synapse is an
                            architect of growth trajectories — a mentor that
                            builds context over time and adapts your path as you
                            evolve.
                        </p>
                    </ScrollReveal>

                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                        {/* Main Large Feature */}
                        <ScrollReveal
                            delay={0.1}
                            className="md:col-span-7"
                        >
                            <div className="alabaster-depth rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 flex flex-col justify-between min-h-[350px] md:min-h-[500px] h-full" style={{ willChange: "transform" }}>
                                <div>
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-[#E8DED4] flex items-center justify-center mb-6 md:mb-10 bg-white/50">
                                        <span className="mono-tag text-[10px]">
                                            01
                                        </span>
                                    </div>
                                    <h3 className="text-2xl md:text-3xl font-semibold text-[#5C6B4A] mb-4 md:mb-6">
                                        Persistent Memory Engine
                                    </h3>
                                    <p className="text-[#8B8178] text-sm md:text-lg leading-relaxed max-w-md">
                                        Unlike typical chatbots that forget
                                        after every session, Synapse remembers
                                        your goals, struggles, learning pace,
                                        and evolving context — building a
                                        deeper understanding over time.
                                    </p>
                                </div>
                                <div className="mt-8 md:mt-12 flex flex-wrap gap-3">
                                    <span className="px-4 py-2 rounded-full bg-[#5C6B4A] text-white mono-tag text-[9px]">
                                        Long-term Context
                                    </span>
                                    <span className="px-4 py-2 rounded-full border border-[#E8DED4] mono-tag text-[9px] text-[#8B8178]">
                                        Session Memory
                                    </span>
                                    <span className="px-4 py-2 rounded-full border border-[#E8DED4] mono-tag text-[9px] text-[#8B8178]">
                                        Growth Tracking
                                    </span>
                                </div>
                            </div>
                        </ScrollReveal>

                        {/* Side Feature 1 */}
                        <ScrollReveal
                            delay={0.2}
                            className="md:col-span-5"
                        >
                            <div className="alabaster-depth rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 h-full" style={{ willChange: "transform" }}>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-[#E8DED4] flex items-center justify-center mb-6 bg-white/50">
                                    <span className="mono-tag text-[10px]">
                                        02
                                    </span>
                                </div>
                                <h3 className="text-xl md:text-2xl font-semibold text-[#5C6B4A] mb-4">
                                    Adaptive Roadmaps
                                </h3>
                                <p className="text-[#8B8178] text-sm md:text-base leading-relaxed mb-6 md:mb-8">
                                    Your learning plan isn't static. When you
                                    struggle, the roadmap recalibrates. When
                                    you leap ahead, it advances with you.
                                </p>
                                <div className="h-[100px] md:h-[140px] w-full bg-[#FDF8F3]/50 rounded-2xl overflow-hidden relative flex items-center justify-center text-center px-4">
                                    <div className="z-10 text-[#8B8178]/60 mono-tag text-[9px] md:text-[10px] italic">
                                        Dynamically Generated Pathways
                                    </div>
                                </div>
                            </div>
                        </ScrollReveal>

                        {/* Side Feature 2 */}
                        <ScrollReveal
                            delay={0.3}
                            className="md:col-span-5"
                        >
                            <div className="alabaster-depth rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 h-full" style={{ willChange: "transform" }}>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-[#E8DED4] flex items-center justify-center mb-6 bg-white/50">
                                    <span className="mono-tag text-[10px]">
                                        03
                                    </span>
                                </div>
                                <h3 className="text-xl md:text-2xl font-semibold text-[#5C6B4A] mb-4">
                                    Struggle Detection
                                </h3>
                                <p className="text-[#8B8178] text-sm md:text-base leading-relaxed">
                                    The AI evaluator detects when you're stuck,
                                    confused, or stagnating — automatically
                                    adjusting difficulty and offering new
                                    approaches without you having to ask.
                                </p>
                            </div>
                        </ScrollReveal>

                        {/* Bottom CTA Feature */}
                        <ScrollReveal
                            delay={0.4}
                            className="md:col-span-7"
                        >
                            <div className="alabaster-depth rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row gap-8 md:gap-10 items-center justify-between h-full">
                                <div className="max-w-sm">
                                    <h3 className="text-2xl md:text-3xl font-semibold text-[#5C6B4A] mb-4">
                                        Experience the Depth
                                    </h3>
                                    <p className="text-[#8B8178]">
                                        Join learners who are building
                                        meaningful careers with a mentor that
                                        evolves alongside them.
                                    </p>
                                </div>
                                <Link
                                    to={
                                        isAuthenticated
                                            ? getAuthenticatedPath()
                                            : "/signup"
                                    }
                                    className="group relative inline-flex items-center px-8 py-4 bg-[#5C6B4A] text-white rounded-full overflow-hidden transition-all hover:pr-12 shrink-0"
                                >
                                    <span className="relative z-10 mono-tag text-[11px]">
                                        {isAuthenticated
                                            ? "Continue"
                                            : "Get Started"}
                                    </span>
                                    <ArrowRight className="absolute right-4 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0" />
                                </Link>
                            </div>
                        </ScrollReveal>
                    </div>

                    {/* Stats Bar */}
                    <ScrollReveal className="mt-16 md:mt-24 border-t border-[#E8DED4] pt-8 flex flex-wrap justify-between items-center opacity-60">
                        <div className="flex gap-8 md:gap-12">
                            {[
                                {
                                    value: "100%",
                                    label: "Persistent Memory",
                                },
                                {
                                    value: "4 Agents",
                                    label: "AI Pipeline",
                                },
                                {
                                    value: "Real-time",
                                    label: "Adaptation",
                                },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <span className="block text-xl md:text-2xl font-light text-[#5C6B4A]">
                                        {stat.value}
                                    </span>
                                    <span className="mono-tag text-[9px] text-[#8B8178]">
                                        {stat.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="hidden md:block">
                            <span className="mono-tag text-[10px] text-[#8B8178]/60">
                                Built for Growth // Synapse Platform
                            </span>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 4: WHO THIS IS FOR — Vellum Cards
               ════════════════════════════════════════════ */}
            <section id="archive" className="relative py-24 md:py-32 px-6 bg-[#FDF8F3] overflow-hidden">
                {/* Ambient orb */}
                <div className="absolute top-[10%] -right-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,transparent_70%)] blur-[80px] pointer-events-none z-0" />

                <div className="max-w-[1400px] mx-auto relative z-10">
                    {/* Header */}
                    <ScrollReveal className="mb-16 md:mb-24">
                        <span className="mono-tag text-[#8B8178] mb-6 block tracking-[0.2em] text-sm">
                            // Target Learners
                        </span>
                        <h2
                            className="text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-[0.95] tracking-tight text-[#5C6B4A] max-w-[900px]"
                            style={{
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            A sanctuary for the architect of tomorrow.
                        </h2>
                    </ScrollReveal>

                    {/* Vellum Card Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        {[
                            {
                                index: "01/",
                                title: "The Student",
                                desc: "Unsure what to focus on, overwhelmed by options, or trying to figure out what comes after graduation. Synapse provides clarity.",
                                footer: "CLARITY TRACK",
                                offset: 0,
                            },
                            {
                                index: "02/",
                                title: "The Early Professional",
                                desc: "Navigating first roles, building skills, wondering if you're on the right track. Get structured guidance that adapts to your pace.",
                                footer: "GROWTH VELOCITY",
                                offset: 60,
                            },
                            {
                                index: "03/",
                                title: "The Career Changer",
                                desc: "Feeling stuck, exploring new directions, or needing structure to make a transition. A roadmap that recalibrates when you pivot.",
                                footer: "TRANSITION PATH",
                                offset: 120,
                            },
                        ].map((card, i) => (
                            <ScrollReveal
                                key={card.index}
                                delay={i * 0.15}
                                className="md:col-span-4"
                            >
                                <div
                                    className="relative p-8 md:p-10 h-[420px] md:h-[500px] flex flex-col justify-between cursor-pointer group"
                                    style={{
                                        marginTop:
                                            window.innerWidth >= 768
                                                ? `${card.offset}px`
                                                : 0,
                                    }}
                                >
                                    {/* Vellum Glass Background */}
                                    <div className="vellum-sheet rounded-[2rem] p-6 md:p-8 h-full flex flex-col justify-between relative" />

                                    <div className="relative z-10">
                                        <span
                                            className="block mb-8 md:mb-10"
                                            style={{
                                                fontFamily:
                                                    "'JetBrains Mono', monospace",
                                                fontSize: "0.9rem",
                                            }}
                                        >
                                            {card.index}
                                        </span>
                                        <h3 className="text-2xl font-bold text-[#5C6B4A] leading-[1.1] mb-5 tracking-tight">
                                            {card.title}
                                        </h3>
                                        <p className="text-[#8B8178] text-base leading-relaxed max-w-[280px]">
                                            {card.desc}
                                        </p>
                                    </div>

                                    <div className="relative z-10 flex items-center gap-3 mt-auto pt-4">
                                        <div className="w-[30px] h-px bg-[#5C6B4A]" />
                                        <span
                                            className="text-xs text-[#5C6B4A]"
                                            style={{
                                                fontFamily:
                                                    "'JetBrains Mono', monospace",
                                            }}
                                        >
                                            {card.footer}
                                        </span>
                                    </div>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>
            {/* ════════════════════════════════════════════
                SECTION 5: FOOTER — Stratified Paper Layers
               ════════════════════════════════════════════ */}
            <footer className="relative w-full pt-16 md:pt-32 overflow-hidden bg-[#4A5A3A]">
                {/* Grain on footer */}
                <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none z-10"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                        mixBlendMode: "multiply",
                    }}
                />

                {/* Bottom Layer */}
                <div className="layer-bottom relative w-full py-12 md:py-20 px-[5%] -mt-6 md:-mt-10 z-[1]">
                    <div className="flex flex-col md:flex-row justify-between items-center text-[#5C6B4A]/60 gap-4 text-center md:text-left"
                        style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "0.7rem",
                        }}
                    >
                        <span>VER. 2026.03 — ALL RIGHTS RESERVED.</span>
                        <span className="hidden md:inline">
                            BUILT WITH INTENTION
                        </span>
                        <span className="hidden md:inline">SYNAPSE.APP</span>
                    </div>
                </div>

                {/* Middle Layer */}
                <div className="layer-middle relative w-full py-16 md:py-20 px-[5%] -mt-14 md:-mt-16 z-[2]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-10 max-w-4xl">
                        {[
                            {
                                title: "Platform",
                                links: [
                                    "Dashboard",
                                    "Mentor Sessions",
                                    "Roadmap",
                                    "Profile",
                                ],
                            },
                            {
                                title: "Connect",
                                links: [
                                    "GitHub",
                                    "LinkedIn",
                                    "Twitter",
                                ],
                            },
                            {
                                title: "Legal",
                                links: [
                                    "Privacy Policy",
                                    "Terms of Use",
                                ],
                            },
                        ].map((col) => (
                            <div key={col.title}>
                                <h4
                                    className="text-xs uppercase text-[#5C6B4A] mb-5 md:mb-6 tracking-wider"
                                    style={{
                                        fontFamily:
                                            "'JetBrains Mono', monospace",
                                        letterSpacing: "0.1em",
                                    }}
                                >
                                    {col.title}
                                </h4>
                                {col.links.map((link) => (
                                    <a
                                        key={link}
                                        href="#"
                                        className="block text-[#5C6B4A] text-sm opacity-70 mb-3 transition-all duration-300 hover:opacity-100 hover:translate-x-2 hover:text-[#5C6B4A] w-fit"
                                        style={{
                                            fontFamily:
                                                "'JetBrains Mono', monospace",
                                        }}
                                    >
                                        {link}
                                    </a>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Layer */}
                <div className="layer-top relative w-full py-16 md:py-20 px-[5%] -mt-16 md:-mt-20 z-[3] flex flex-col gap-10 md:gap-14">
                    <h2
                        className="text-[clamp(3rem,12vw,9rem)] font-black text-[#5C6B4A] leading-[0.8] tracking-tight uppercase"
                        style={{
                            fontFamily: "'Inter', sans-serif",
                            letterSpacing: "-0.04em",
                        }}
                    >
                        SYNAPSE.
                    </h2>

                    <div className="flex flex-col md:flex-row gap-8 md:gap-10 items-start md:items-end justify-between border border-[#5C6B4A]/10 p-6 md:p-10">
                        <p className="text-[#5C6B4A] text-base md:text-lg leading-relaxed max-w-md">
                            Your AI mentor for the long haul. We build
                            career guidance experiences that remember,
                            adapt, and grow with you.
                        </p>
                        <div
                            className="w-20 h-20 rounded-full border-2 border-dashed border-[#5C6B4A] flex items-center justify-center text-[#5C6B4A] text-center shrink-0"
                            style={{
                                fontFamily:
                                    "'JetBrains Mono', monospace",
                                fontWeight: "bold",
                                fontSize: "0.65rem",
                                transform: "rotate(-15deg)",
                                padding: "10px",
                            }}
                        >
                            AI
                            <br />
                            MENTOR
                        </div>
                    </div>

                    <div
                        className="text-[#5C6B4A] text-xs"
                        style={{
                            fontFamily:
                                "'JetBrains Mono', monospace",
                        }}
                    >
                        ESTABLISHED MMXXVI — FOR INTENTIONAL LEARNERS
                    </div>
                </div>
            </footer>
        </div>
    );
}
