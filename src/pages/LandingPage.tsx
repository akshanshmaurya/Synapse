import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Leaf, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LandingPage() {
    const { isAuthenticated, onboardingComplete } = useAuth();

    // Determine where to redirect authenticated users
    const getAuthenticatedPath = () => {
        if (!onboardingComplete) return "/onboarding";
        return "/dashboard";
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] relative overflow-x-hidden">
            {/* Subtle organic background shapes - fixed to viewport */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        y: [0, -20, 0],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-20 left-10 w-64 h-64 rounded-full bg-[#D4A574]/20 blur-3xl"
                />
                <motion.div
                    animate={{
                        y: [0, 20, 0],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-[#5C6B4A]/10 blur-3xl"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.15, 0.25, 0.15]
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#E8C4A0]/20 blur-3xl"
                />
            </div>

            {/* Header with Logo and Auth buttons */}
            <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-8 py-6 z-50 bg-gradient-to-b from-[#FDF8F3] to-transparent">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex items-center gap-3"
                >
                    <div className="w-10 h-10 rounded-full bg-[#5C6B4A] flex items-center justify-center">
                        <Leaf className="w-5 h-5 text-[#FDF8F3]" />
                    </div>
                    <span className="font-serif text-xl text-[#3D3D3D]">Synapse</span>
                </motion.div>

                {/* Auth Navigation */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="flex items-center gap-4"
                >
                    {isAuthenticated ? (
                        <Link
                            to={getAuthenticatedPath()}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium transition-all duration-300 hover:bg-[#4A5A3A]"
                        >
                            Go to Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                to="/signin"
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-[#5C6B4A] font-medium transition-all duration-300 hover:text-[#3D3D3D]"
                            >
                                <LogIn className="w-4 h-4" />
                                Sign In
                            </Link>
                            <Link
                                to="/signup"
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium transition-all duration-300 hover:bg-[#4A5A3A]"
                            >
                                <UserPlus className="w-4 h-4" />
                                Sign Up
                            </Link>
                        </>
                    )}
                </motion.div>
            </div>

            {/* Hero Section */}
            <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    className="text-center max-w-2xl z-10"
                >
                    {/* Decorative element */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.5, type: "spring" }}
                        className="w-16 h-16 mx-auto mb-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center"
                    >
                        <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/20 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-[#5C6B4A]" />
                        </div>
                    </motion.div>

                    <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#3D3D3D] leading-tight mb-6">
                        A personal mentor
                        <br />
                        <span className="text-[#5C6B4A]">for your career</span>
                    </h1>

                    <p className="text-lg md:text-xl text-[#8B8178] font-light leading-relaxed mb-4 max-w-lg mx-auto">
                        Not a chatbot. A mentor that remembers your goals,
                        understands where you're stuck, and builds a path forward with you.
                    </p>

                    <p className="text-base text-[#8B8178]/70 font-light mb-12 max-w-md mx-auto">
                        Talk. Reflect. Build a roadmap. Adapt as you grow.
                    </p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.8 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        {isAuthenticated ? (
                            <Link
                                to={getAuthenticatedPath()}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#4A5A3A] hover:shadow-lg hover:shadow-[#5C6B4A]/20 hover:-translate-y-1"
                            >
                                Continue with your mentor
                                <motion.span
                                    animate={{ x: [0, 4, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    →
                                </motion.span>
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#4A5A3A] hover:shadow-lg hover:shadow-[#5C6B4A]/20 hover:-translate-y-1"
                                >
                                    Begin with your mentor
                                    <motion.span
                                        animate={{ x: [0, 4, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        →
                                    </motion.span>
                                </Link>
                                <Link
                                    to="/signin"
                                    className="inline-flex items-center gap-2 px-6 py-3 text-[#5C6B4A] font-medium border border-[#5C6B4A]/30 rounded-full transition-all duration-300 hover:bg-[#5C6B4A]/10"
                                >
                                    I already have an account
                                </Link>
                            </>
                        )}
                    </motion.div>
                </motion.div>

                {/* Scroll indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.5 }}
                    className="absolute bottom-8 flex flex-col items-center gap-2"
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
            <section className="py-24 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                    className="max-w-2xl mx-auto text-center z-10 relative"
                >
                    <h2 className="font-serif text-3xl md:text-4xl text-[#3D3D3D] mb-12">
                        How this mentor helps you
                    </h2>

                    <div className="space-y-8 text-left">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="flex gap-4"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#5C6B4A] font-medium text-sm">1</span>
                            </div>
                            <div>
                                <h3 className="font-medium text-[#3D3D3D] mb-1">You share where you are</h3>
                                <p className="text-[#8B8178] font-light leading-relaxed">
                                    Talk about your situation, your goals, what's confusing you. 
                                    There's no form to fill—just a conversation.
                                </p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="flex gap-4"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#5C6B4A] font-medium text-sm">2</span>
                            </div>
                            <div>
                                <h3 className="font-medium text-[#3D3D3D] mb-1">Your mentor remembers</h3>
                                <p className="text-[#8B8178] font-light leading-relaxed">
                                    Every session builds on the last. Your goals, struggles, and progress 
                                    stay with you—no need to repeat yourself.
                                </p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="flex gap-4"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#5C6B4A] font-medium text-sm">3</span>
                            </div>
                            <div>
                                <h3 className="font-medium text-[#3D3D3D] mb-1">A roadmap takes shape</h3>
                                <p className="text-[#8B8178] font-light leading-relaxed">
                                    Together, you build a personalized path forward. It's not a generic plan—it's 
                                    based on your context and adapts when things change.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </section>

            {/* Why this is different */}
            <section className="py-24 px-6 bg-[#5C6B4A]/5">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                    className="max-w-2xl mx-auto text-center z-10 relative"
                >
                    <h2 className="font-serif text-3xl md:text-4xl text-[#3D3D3D] mb-12">
                        Why this is different
                    </h2>

                    <div className="space-y-6 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="p-6 rounded-2xl bg-white/50"
                        >
                            <h3 className="font-medium text-[#3D3D3D] mb-2">Not generic advice</h3>
                            <p className="text-[#8B8178] font-light">
                                This isn't a list of tips anyone could find online. 
                                Guidance is shaped around your specific situation.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="p-6 rounded-2xl bg-white/50"
                        >
                            <h3 className="font-medium text-[#3D3D3D] mb-2">Not a one-time conversation</h3>
                            <p className="text-[#8B8178] font-light">
                                Real mentorship takes time. This system grows with you, 
                                checking in as your path unfolds.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="p-6 rounded-2xl bg-white/50"
                        >
                            <h3 className="font-medium text-[#3D3D3D] mb-2">Adapts when you struggle</h3>
                            <p className="text-[#8B8178] font-light">
                                If something isn't working, the roadmap adjusts. 
                                There's no shame in changing direction.
                            </p>
                        </motion.div>
                    </div>
                </motion.div>
            </section>

            {/* Who this is for */}
            <section className="py-24 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                    className="max-w-2xl mx-auto text-center z-10 relative"
                >
                    <h2 className="font-serif text-3xl md:text-4xl text-[#3D3D3D] mb-6">
                        Who this is for
                    </h2>

                    <p className="text-lg text-[#8B8178] font-light mb-10 max-w-lg mx-auto">
                        This is for people who want clarity, not hype. 
                        If any of these feel familiar, you're in the right place.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6 text-left">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="p-5 rounded-xl bg-white/40"
                        >
                            <h3 className="font-medium text-[#3D3D3D] mb-2">Students</h3>
                            <p className="text-[#8B8178] font-light text-sm leading-relaxed">
                                Unsure what to focus on, overwhelmed by options, 
                                or trying to figure out what comes after graduation.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="p-5 rounded-xl bg-white/40"
                        >
                            <h3 className="font-medium text-[#3D3D3D] mb-2">Early professionals</h3>
                            <p className="text-[#8B8178] font-light text-sm leading-relaxed">
                                Navigating your first roles, building skills, 
                                wondering if you're on the right track.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="p-5 rounded-xl bg-white/40"
                        >
                            <h3 className="font-medium text-[#3D3D3D] mb-2">Career changers</h3>
                            <p className="text-[#8B8178] font-light text-sm leading-relaxed">
                                Feeling stuck, exploring new directions, 
                                or needing structure to make a transition.
                            </p>
                        </motion.div>
                    </div>
                </motion.div>
            </section>

            {/* Final CTA */}
            <section className="py-24 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                    className="max-w-xl mx-auto text-center z-10 relative"
                >
                    <h2 className="font-serif text-2xl md:text-3xl text-[#3D3D3D] mb-4">
                        Ready to begin?
                    </h2>

                    <p className="text-[#8B8178] font-light mb-8">
                        Your first conversation is free. No credit card needed.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {isAuthenticated ? (
                            <Link
                                to={getAuthenticatedPath()}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#4A5A3A] hover:shadow-lg hover:shadow-[#5C6B4A]/20 hover:-translate-y-1"
                            >
                                Continue with your mentor
                                <motion.span
                                    animate={{ x: [0, 4, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    →
                                </motion.span>
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium text-lg transition-all duration-500 hover:bg-[#4A5A3A] hover:shadow-lg hover:shadow-[#5C6B4A]/20 hover:-translate-y-1"
                                >
                                    Begin with your mentor
                                    <motion.span
                                        animate={{ x: [0, 4, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        →
                                    </motion.span>
                                </Link>
                                <Link
                                    to="/signin"
                                    className="inline-flex items-center gap-2 px-6 py-3 text-[#5C6B4A] font-medium border border-[#5C6B4A]/30 rounded-full transition-all duration-300 hover:bg-[#5C6B4A]/10"
                                >
                                    I already have an account
                                </Link>
                            </>
                        )}
                    </div>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-[#5C6B4A]/10">
                <div className="max-w-2xl mx-auto text-center">
                    <p className="text-sm text-[#8B8178]/60 font-light">
                        For students and early professionals finding their way.
                    </p>
                </div>
            </footer>
        </div>
    );
}
