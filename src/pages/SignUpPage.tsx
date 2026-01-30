import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Sprout, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

export default function SignUpPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        if (password.length < 6) {
            setError("Password should be at least 6 characters");
            return;
        }

        setIsLoading(true);

        try {
            await signup(email, password, name);
            navigate("/onboarding");
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] flex items-center justify-center p-6">
            {/* Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-40 right-20 w-[350px] h-[350px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-20 left-20 w-[300px] h-[300px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <Logo size="lg" />
                </div>

                {/* Card */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4] shadow-sm">
                    <h1 className="font-serif text-2xl text-[#3D3D3D] text-center mb-2">Begin your journey</h1>
                    <p className="text-[#8B8178] text-center mb-8">Plant the first seed of growth</p>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6"
                        >
                            <p className="text-red-600 text-sm text-center">{error}</p>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm text-[#8B8178] mb-2">Name (optional)</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B8178]" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="How should I call you?"
                                    className="w-full pl-12 pr-4 py-3 bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/50 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-300"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm text-[#8B8178] mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B8178]" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full pl-12 pr-4 py-3 bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/50 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-300"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm text-[#8B8178] mb-2">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B8178]" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    className="w-full pl-12 pr-12 py-3 bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/50 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-300"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B8178] hover:text-[#3D3D3D] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm text-[#8B8178] mb-2">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B8178]" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    className="w-full pl-12 pr-4 py-3 bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/50 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-300"
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium transition-all duration-500 hover:bg-[#4A5A3A] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {isLoading ? "Planting your seed..." : "Begin growing"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-[#E8DED4]" />
                        <span className="text-sm text-[#8B8178]">or</span>
                        <div className="flex-1 h-px bg-[#E8DED4]" />
                    </div>

                    {/* Sign in link */}
                    <p className="text-center text-[#8B8178]">
                        Already have roots here?{" "}
                        <Link to="/signin" className="text-[#5C6B4A] font-medium hover:underline">
                            Return to your garden
                        </Link>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-[#8B8178]/60 mt-6">
                    Growth begins with a single step
                </p>
            </motion.div>
        </div>
    );
}
