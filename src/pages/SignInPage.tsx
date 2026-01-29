import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Sprout, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await login(email, password);
            if (result.needsOnboarding) {
                navigate("/onboarding");
            } else {
                navigate("/dashboard");
            }
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
                <div className="absolute top-20 left-20 w-[300px] h-[300px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-20 right-20 w-[400px] h-[400px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#5C6B4A] flex items-center justify-center">
                            <Sprout className="w-6 h-6 text-[#FDF8F3]" />
                        </div>
                        <span className="font-serif text-2xl text-[#3D3D3D]">Synapse</span>
                    </Link>
                </div>

                {/* Card */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4] shadow-sm">
                    <h1 className="font-serif text-2xl text-[#3D3D3D] text-center mb-2">Welcome back</h1>
                    <p className="text-[#8B8178] text-center mb-8">Continue your journey of growth</p>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6"
                        >
                            <p className="text-red-600 text-sm text-center">{error}</p>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
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
                                    placeholder="Your password"
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

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium transition-all duration-500 hover:bg-[#4A5A3A] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? "Entering the garden..." : "Sign in"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-[#E8DED4]" />
                        <span className="text-sm text-[#8B8178]">or</span>
                        <div className="flex-1 h-px bg-[#E8DED4]" />
                    </div>

                    {/* Sign up link */}
                    <p className="text-center text-[#8B8178]">
                        New to this garden?{" "}
                        <Link to="/signup" className="text-[#5C6B4A] font-medium hover:underline">
                            Start your journey
                        </Link>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-[#8B8178]/60 mt-6">
                    A quiet space for growth
                </p>
            </motion.div>
        </div>
    );
}
