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
        <div className="min-h-screen bg-gradient-to-b from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] flex flex-col items-center justify-center relative overflow-hidden">
            {/* Subtle organic background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6">
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

            {/* Main Content */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="text-center px-6 max-w-2xl z-10"
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
                    A quiet space
                    <br />
                    <span className="text-[#5C6B4A]">for growth</span>
                </h1>

                <p className="text-lg md:text-xl text-[#8B8178] font-light leading-relaxed mb-12 max-w-lg mx-auto">
                    Like a garden, your career grows in seasons.
                    Here, we nurture your path with patience,
                    clarity, and gentle guidance.
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
                            Continue your journey
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
                                Begin your journey
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

            {/* Bottom subtle message */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1.2 }}
                className="absolute bottom-8 text-sm text-[#8B8178]/60 font-light"
            >
                No rush. No pressure. Just growth.
            </motion.p>
        </div>
    );
}
