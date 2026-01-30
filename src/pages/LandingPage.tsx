import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { Leaf, LogIn, UserPlus, Check, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRef } from "react";

// Scroll-reveal wrapper component
function ScrollReveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
            transition={{ duration: 0.8, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export default function LandingPage() {
    const { isAuthenticated, onboardingComplete } = useAuth();

    const getAuthenticatedPath = () => {
        if (!onboardingComplete) return "/onboarding";
        return "/dashboard";
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] relative overflow-x-hidden">
            {/* Animated Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        y: [0, -30, 0],
                        x: [0, 20, 0],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#5C6B4A]/15 blur-3xl"
                />
                <motion.div
                    animate={{
                        y: [0, 40, 0],
                        x: [0, -30, 0],
                        scale: [1, 0.9, 1],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 5 }}
                    className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#D4A574]/20 blur-3xl"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.15, 0.25, 0.15],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#E8C4A0]/25 blur-3xl"
                />
            </div>

            {/* Fixed Header */}
            <header className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 py-5 z-50 backdrop-blur-md bg-[#FDF8F3]/80 border-b border-[#5C6B4A]/10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex items-center"
                >
                    <img src="/logo.png" alt="Synapse" className="h-10" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                    className="flex items-center gap-4"
                >
                    {isAuthenticated ? (
                        <Link
                            to={getAuthenticatedPath()}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium transition-all duration-300 hover:bg-[#4A5A3A] hover:shadow-lg hover:shadow-[#5C6B4A]/30"
                        >
                            Go to Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                to="/signin"
                                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 text-[#5C6B4A] font-medium transition-all duration-300 hover:text-[#3D3D3D]"
                            >
                                <LogIn className="w-4 h-4" />
                                Sign In
                            </Link>
                            <Link
                                to="/signup"
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium transition-all duration-300 hover:bg-[#4A5A3A] hover:shadow-lg hover:shadow-[#5C6B4A]/30"
                            >
                                <UserPlus className="w-4 h-4" />
                                Sign Up
                            </Link>
                        </>
                    )}
                </motion.div>
            </header>

            {/* Hero Section */}
            <section className="min-h-screen flex items-center justify-center px-6 pt-24 pb-16">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Hero Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className="text-center lg:text-left z-10"
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E8C4A0]/40 to-[#5C6B4A]/20 rounded-full mb-6"
                        >
                            <span className="w-2 h-2 rounded-full bg-[#5C6B4A] animate-pulse" />
                            <span className="text-sm font-medium text-[#5C6B4A]">Personal AI Mentorship</span>
                        </motion.div>

                        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#3D3D3D] leading-tight mb-6">
                            Your career path,
                            <br />
                            <span className="bg-gradient-to-r from-[#5C6B4A] via-[#7A8B5A] to-[#5C6B4A] bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                                personalized
                            </span>
                            {" "}and{" "}
                            <span className="bg-gradient-to-r from-[#5C6B4A] via-[#7A8B5A] to-[#5C6B4A] bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]">
                                remembered
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-[#8B8178] font-light leading-relaxed mb-4 max-w-lg mx-auto lg:mx-0">
                            Unlike typical chatbots, your mentor remembers your goals,
                            adapts to your struggles, and builds a path forward with you.
                        </p>

                        <p className="text-base text-[#8B8178]/70 font-light mb-8 max-w-md mx-auto lg:mx-0">
                            Talk. Reflect. Build a roadmap. Adapt as you grow.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                            {isAuthenticated ? (
                                <Link
                                    to={getAuthenticatedPath()}
                                    className="group inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#4A5A3A] hover:shadow-xl hover:shadow-[#5C6B4A]/30 hover:-translate-y-1"
                                >
                                    Continue with your mentor
                                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/signup"
                                        className="group inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#4A5A3A] hover:shadow-xl hover:shadow-[#5C6B4A]/30 hover:-translate-y-1 relative overflow-hidden"
                                    >
                                        <span className="relative z-10">Begin with your mentor</span>
                                        <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />
                                    </Link>
                                    <Link
                                        to="/signin"
                                        className="inline-flex items-center gap-2 px-6 py-3 text-[#5C6B4A] font-medium border-2 border-[#5C6B4A]/30 rounded-full transition-all duration-300 hover:bg-[#5C6B4A] hover:text-[#FDF8F3] hover:border-[#5C6B4A]"
                                    >
                                        I have an account
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-center lg:justify-start gap-8">
                            {[
                                { value: "Personal", label: "Mentorship" },
                                { value: "Adaptive", label: "Roadmaps" },
                                { value: "Remembers", label: "Your Journey" },
                            ].map((stat, i) => (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.8 + i * 0.1 }}
                                    className="text-center"
                                >
                                    <div className="font-serif text-lg font-semibold text-[#5C6B4A]">{stat.value}</div>
                                    <div className="text-xs text-[#8B8178]/70">{stat.label}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Hero Visual - Dashboard Preview */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                        className="relative hidden lg:block"
                    >
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl shadow-[#3D3D3D]/10 border border-[#5C6B4A]/10 relative overflow-hidden"
                        >
                            {/* Gradient top bar */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5C6B4A] via-[#7A8B5A] to-[#D4A574]" />

                            {/* Dashboard Header */}
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#5C6B4A]/10">
                                <div className="font-serif text-lg font-semibold text-[#3D3D3D]">Your Learning Journey</div>
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5C6B4A] to-[#7A8B5A] flex items-center justify-center text-white text-sm font-bold">
                                    65%
                                </div>
                            </div>

                            {/* Roadmap Stages */}
                            <div className="space-y-4">
                                {[
                                    { title: "Foundation Stage", desc: "Understanding core concepts", progress: 3, icon: "✓", active: false },
                                    { title: "Skill Building", desc: "Developing practical skills", progress: 2, icon: "→", active: true },
                                    { title: "Advanced Application", desc: "Real-world projects", progress: 0, icon: "○", active: false },
                                ].map((stage, i) => (
                                    <motion.div
                                        key={stage.title}
                                        initial={{ opacity: 0, x: 30 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.6, delay: 0.8 + i * 0.15 }}
                                        className={`p-4 rounded-xl border-l-4 transition-all duration-300 cursor-pointer hover:translate-x-1 ${stage.active
                                            ? "bg-[#5C6B4A]/10 border-[#5C6B4A]"
                                            : "bg-[#F5EDE4]/50 border-[#D4A574]/50"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <motion.div
                                                animate={stage.active ? { scale: [1, 1.1, 1] } : {}}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="w-6 h-6 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-xs"
                                            >
                                                {stage.icon}
                                            </motion.div>
                                            <span className="font-medium text-[#3D3D3D]">{stage.title}</span>
                                        </div>
                                        <p className="text-sm text-[#8B8178] mb-3 pl-9">{stage.desc}</p>
                                        <div className="flex gap-1 pl-9">
                                            {[...Array(5)].map((_, j) => (
                                                <motion.div
                                                    key={j}
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ delay: 1 + j * 0.1 }}
                                                    className={`w-2 h-2 rounded-full ${j < stage.progress ? "bg-[#5C6B4A]" : "bg-[#E8DED4]"
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Floating Cards */}
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -top-4 -right-4 bg-white rounded-xl px-4 py-3 shadow-lg shadow-[#3D3D3D]/10"
                        >
                            <div className="text-xs text-[#8B8178]">Learning Pace</div>
                            <div className="font-semibold text-[#5C6B4A]">Comfortable</div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                            className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-3 shadow-lg shadow-[#3D3D3D]/10"
                        >
                            <div className="text-xs text-[#8B8178]">Next Session</div>
                            <div className="font-semibold text-[#5C6B4A]">Tomorrow</div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.5 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                >
                    <span className="text-sm text-[#8B8178]/50 font-light">Learn more</span>
                    <motion.div
                        animate={{ y: [0, 6, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-5 h-8 rounded-full border-2 border-[#8B8178]/30 flex items-start justify-center p-1"
                    >
                        <div className="w-1 h-2 rounded-full bg-[#8B8178]/40" />
                    </motion.div>
                </motion.div>
            </section>

            {/* How this mentor helps you */}
            <section className="py-24 px-6 bg-white/50">
                <div className="max-w-5xl mx-auto">
                    <ScrollReveal className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E8C4A0]/30 rounded-full mb-4">
                            <span className="text-sm font-medium text-[#5C6B4A]">Simple Process</span>
                        </div>
                        <h2 className="font-serif text-3xl md:text-4xl text-[#3D3D3D] mb-4">
                            How this mentor helps you
                        </h2>
                        <p className="text-lg text-[#8B8178] font-light max-w-2xl mx-auto">
                            From onboarding to mastery, every step is personalized to you.
                        </p>
                    </ScrollReveal>

                    {/* Timeline */}
                    <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#5C6B4A] via-[#7A8B5A] to-[#D4A574] hidden md:block" />

                        {[
                            {
                                step: 1,
                                title: "You share where you are",
                                desc: "Talk about your situation, your goals, what's confusing you. There's no form to fill—just a conversation.",
                            },
                            {
                                step: 2,
                                title: "Your mentor remembers",
                                desc: "Every session builds on the last. Your goals, struggles, and progress stay with you—no need to repeat yourself.",
                            },
                            {
                                step: 3,
                                title: "A roadmap takes shape",
                                desc: "Together, you build a personalized path forward. It's not a generic plan—it's based on your context and adapts when things change.",
                            },
                            {
                                step: 4,
                                title: "Watch it adapt",
                                desc: "If something isn't working, the roadmap adjusts. There's no shame in changing direction—that's how real growth works.",
                            },
                        ].map((item, i) => (
                            <ScrollReveal key={item.step} delay={i * 0.1}>
                                <div className={`flex items-center mb-12 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                                    <div className={`flex-1 ${i % 2 === 1 ? "md:text-right md:pr-16" : "md:pl-16"} md:w-[45%]`}>
                                        <motion.div
                                            whileHover={{ y: -5, scale: 1.02 }}
                                            transition={{ duration: 0.3 }}
                                            className="bg-white p-6 rounded-2xl shadow-lg shadow-[#3D3D3D]/5 border border-[#5C6B4A]/10"
                                        >
                                            <h3 className="font-serif text-xl font-semibold text-[#3D3D3D] mb-2">{item.title}</h3>
                                            <p className="text-[#8B8178] font-light leading-relaxed">{item.desc}</p>
                                        </motion.div>
                                    </div>

                                    {/* Circle number */}
                                    <motion.div
                                        whileHover={{ scale: 1.1, rotate: 360 }}
                                        transition={{ duration: 0.6 }}
                                        className="hidden md:flex w-16 h-16 rounded-full bg-gradient-to-br from-[#5C6B4A] to-[#7A8B5A] items-center justify-center text-white font-serif text-2xl font-bold shadow-lg shadow-[#5C6B4A]/30 z-10 border-4 border-[#FDF8F3]"
                                    >
                                        {item.step}
                                    </motion.div>

                                    <div className="flex-1 hidden md:block" />
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why this is different */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <ScrollReveal className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#5C6B4A]/10 rounded-full mb-4">
                            <span className="text-sm font-medium text-[#5C6B4A]">Why It's Different</span>
                        </div>
                        <h2 className="font-serif text-3xl md:text-4xl text-[#3D3D3D] mb-4">
                            Built for long-term growth
                        </h2>
                        <p className="text-lg text-[#8B8178] font-light max-w-2xl mx-auto">
                            A mentorship experience that actually remembers you, adapts to you, and grows with you.
                        </p>
                    </ScrollReveal>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: "🧠",
                                title: "Not generic advice",
                                desc: "This isn't a list of tips anyone could find online. Guidance is shaped around your specific situation.",
                                features: ["Long-term context", "Learning style adaptation", "Personalized pacing"],
                            },
                            {
                                icon: "🗺️",
                                title: "Not a one-time conversation",
                                desc: "Real mentorship takes time. This system grows with you, checking in as your path unfolds.",
                                features: ["Persistent memory", "Progress tracking", "Evolving roadmaps"],
                            },
                            {
                                icon: "🌱",
                                title: "Adapts when you struggle",
                                desc: "If something isn't working, the roadmap adjusts. There's no shame in changing direction.",
                                features: ["Struggle detection", "Difficulty calibration", "Supportive guidance"],
                            },
                        ].map((card, i) => (
                            <ScrollReveal key={card.title} delay={i * 0.1}>
                                <motion.div
                                    whileHover={{ y: -8, scale: 1.02 }}
                                    transition={{ duration: 0.4 }}
                                    className="group h-full bg-gradient-to-br from-[#FDF8F3] to-white p-6 rounded-2xl border-2 border-transparent hover:border-[#5C6B4A]/30 transition-all duration-300 shadow-lg shadow-[#3D3D3D]/5"
                                >
                                    <motion.div
                                        whileHover={{ scale: 1.1, rotate: 5 }}
                                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5C6B4A] to-[#7A8B5A] flex items-center justify-center text-3xl mb-5 shadow-lg shadow-[#5C6B4A]/30"
                                    >
                                        {card.icon}
                                    </motion.div>
                                    <h3 className="font-serif text-xl font-semibold text-[#3D3D3D] mb-3">{card.title}</h3>
                                    <p className="text-[#8B8178] font-light mb-4 leading-relaxed">{card.desc}</p>
                                    <ul className="space-y-2">
                                        {card.features.map((feature) => (
                                            <li key={feature} className="flex items-center gap-2 text-sm text-[#8B8178] group-hover:translate-x-1 transition-transform">
                                                <Check className="w-4 h-4 text-[#5C6B4A]" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Who this is for */}
            <section className="py-24 px-6 bg-[#5C6B4A]/5">
                <div className="max-w-5xl mx-auto">
                    <ScrollReveal className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 rounded-full mb-4">
                            <span className="text-sm font-medium text-[#5C6B4A]">Made For You</span>
                        </div>
                        <h2 className="font-serif text-3xl md:text-4xl text-[#3D3D3D] mb-4">
                            Who this is for
                        </h2>
                        <p className="text-lg text-[#8B8178] font-light max-w-2xl mx-auto">
                            This is for people who want clarity, not hype. If any of these feel familiar, you're in the right place.
                        </p>
                    </ScrollReveal>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                avatar: "👩‍🎓",
                                title: "Students",
                                desc: "Unsure what to focus on, overwhelmed by options, or trying to figure out what comes after graduation.",
                            },
                            {
                                avatar: "👨‍💻",
                                title: "Early professionals",
                                desc: "Navigating your first roles, building skills, wondering if you're on the right track.",
                            },
                            {
                                avatar: "🔄",
                                title: "Career changers",
                                desc: "Feeling stuck, exploring new directions, or needing structure to make a transition.",
                            },
                        ].map((persona, i) => (
                            <ScrollReveal key={persona.title} delay={i * 0.1}>
                                <motion.div
                                    whileHover={{ y: -5 }}
                                    className="bg-white p-6 rounded-2xl shadow-lg shadow-[#3D3D3D]/5"
                                >
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#5C6B4A] to-[#7A8B5A] flex items-center justify-center text-2xl mb-4">
                                        {persona.avatar}
                                    </div>
                                    <h3 className="font-serif text-xl font-semibold text-[#3D3D3D] mb-2">{persona.title}</h3>
                                    <p className="text-[#8B8178] font-light leading-relaxed">{persona.desc}</p>
                                </motion.div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-24 px-6 bg-gradient-to-br from-[#5C6B4A] to-[#4A5A3A] relative overflow-hidden">
                {/* Animated background pattern */}
                <motion.div
                    animate={{ x: [0, 100], y: [0, 100] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `radial-gradient(circle at center, white 2px, transparent 2px)`,
                        backgroundSize: "40px 40px",
                    }}
                />

                <ScrollReveal className="max-w-2xl mx-auto text-center relative z-10">
                    <h2 className="font-serif text-3xl md:text-4xl text-white mb-4">
                        Start your journey today
                    </h2>
                    <p className="text-lg text-white/80 font-light mb-8">
                        Join learners who are building meaningful careers with a mentor that remembers, adapts, and grows with them.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {isAuthenticated ? (
                            <Link
                                to={getAuthenticatedPath()}
                                className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-[#5C6B4A] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#E8C4A0] hover:shadow-xl hover:-translate-y-1"
                            >
                                Continue with your mentor
                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to="/signup"
                                    className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-[#5C6B4A] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#E8C4A0] hover:shadow-xl hover:-translate-y-1"
                                >
                                    Begin with your mentor
                                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                </Link>
                                <Link
                                    to="/signin"
                                    className="inline-flex items-center gap-2 px-6 py-3 text-white font-medium border-2 border-white/30 rounded-full transition-all duration-300 hover:bg-white/10"
                                >
                                    I have an account
                                </Link>
                            </>
                        )}
                    </div>
                </ScrollReveal>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 bg-[#3D3D3D] text-white/60">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <img src="/logo.png" alt="Synapse" className="h-8 brightness-0 invert opacity-80" />
                    </div>
                    <p className="text-sm font-light">
                        For students and early professionals finding their way.
                    </p>
                    <p className="text-xs mt-4 text-white/40">
                        © 2026 Synapse. Built with intention for intentional learners.
                    </p>
                </div>
            </footer>

            {/* Global styles for shimmer animation */}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 0% center; }
                    50% { background-position: 100% center; }
                    100% { background-position: 0% center; }
                }
            `}</style>
        </div>
    );
}
