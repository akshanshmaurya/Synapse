import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sprout, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

interface OnboardingQuestion {
    id: string;
    question: string;
    type: "textarea" | "select";
    placeholder?: string;
    options?: { value: string; label: string }[];
    required: boolean;
}

export default function OnboardingPage() {
    const { token, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hasChecked, setHasChecked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [answers, setAnswers] = useState<Record<string, string>>({
        why_here: "",
        guidance_type: "",
        experience_level: "",
        mentoring_style: "",
    });

    const API_URL = "http://localhost:8000";

    const questions: OnboardingQuestion[] = [
        {
            id: "why_here",
            question: "What brings you here today?",
            type: "textarea",
            placeholder: "Share what you're hoping to achieve, what's on your mind, or what prompted you to seek guidance...",
            required: true,
        },
        {
            id: "guidance_type",
            question: "What type of guidance are you looking for?",
            type: "select",
            options: [
                { value: "career", label: "Career growth & direction" },
                { value: "skills", label: "Learning new skills" },
                { value: "goals", label: "Setting and achieving goals" },
                { value: "confidence", label: "Building confidence" },
                { value: "balance", label: "Finding balance & clarity" },
            ],
            required: true,
        },
        {
            id: "experience_level",
            question: "How would you describe your current experience level?",
            type: "select",
            options: [
                { value: "beginner", label: "Just starting out" },
                { value: "intermediate", label: "Some experience" },
                { value: "advanced", label: "Experienced, seeking mastery" },
            ],
            required: true,
        },
        {
            id: "mentoring_style",
            question: "What kind of mentoring feels right for you?",
            type: "select",
            options: [
                { value: "gentle", label: "Gentle and patient" },
                { value: "supportive", label: "Warm and encouraging" },
                { value: "direct", label: "Clear and straightforward" },
                { value: "challenging", label: "Pushes me to grow" },
            ],
            required: true,
        },
    ];

    useEffect(() => {
        // Only check once when token is available
        if (token && !hasChecked) {
            checkOnboardingStatus();
        } else if (!token) {
            setIsLoading(false);
        }
    }, [token, hasChecked]);

    const checkOnboardingStatus = async () => {
        if (!token) {
            setIsLoading(false);
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/onboarding/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (data.is_complete) {
                navigate("/dashboard");
            }
        } catch (error) {
            console.error("Failed to check onboarding status:", error);
        } finally {
            setHasChecked(true);
            setIsLoading(false);
        }
    };

    const handleAnswer = (value: string) => {
        const currentQuestion = questions[step];
        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    };

    const canContinue = () => {
        const currentQuestion = questions[step];
        return answers[currentQuestion.id]?.trim().length > 0;
    };

    const handleNext = () => {
        if (step < questions.length - 1) {
            setStep(step + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/api/onboarding/complete`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(answers),
            });

            if (response.ok) {
                navigate("/dashboard");
            }
        } catch (error) {
            console.error("Failed to submit onboarding:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-[#5C6B4A] flex items-center justify-center animate-pulse">
                    <Sprout className="w-5 h-5 text-[#FDF8F3]" />
                </div>
            </div>
        );
    }

    const currentQuestion = questions[step];
    const progress = ((step + 1) / questions.length) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] flex items-center justify-center p-6">
            {/* Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-20 w-[300px] h-[300px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-20 right-20 w-[400px] h-[400px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-xl relative z-10"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <Logo size="lg" linkToHome={false} />
                    </div>
                    <p className="text-[#8B8178]">Let me learn a little about you</p>
                </div>

                {/* Progress */}
                <div className="mb-8">
                    <div className="h-1 bg-[#E8DED4] rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-[#5C6B4A]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    <p className="text-xs text-[#8B8178] mt-2 text-center">
                        Step {step + 1} of {questions.length}
                    </p>
                </div>

                {/* Question Card */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4] shadow-sm">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="font-serif text-xl text-[#3D3D3D] mb-6">
                                {currentQuestion.question}
                            </h2>

                            {currentQuestion.type === "textarea" ? (
                                <textarea
                                    value={answers[currentQuestion.id]}
                                    onChange={(e) => handleAnswer(e.target.value)}
                                    placeholder={currentQuestion.placeholder}
                                    className="w-full p-4 bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/50 resize-none h-32 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-300"
                                />
                            ) : (
                                <div className="space-y-3">
                                    {currentQuestion.options?.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleAnswer(option.value)}
                                            className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 ${answers[currentQuestion.id] === option.value
                                                ? "bg-[#5C6B4A] border-[#5C6B4A] text-[#FDF8F3]"
                                                : "bg-white/50 border-[#E8DED4] text-[#3D3D3D] hover:bg-[#5C6B4A]/5"
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E8DED4]">
                        <button
                            onClick={handleBack}
                            disabled={step === 0}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${step === 0
                                ? "text-[#8B8178]/50 cursor-not-allowed"
                                : "text-[#8B8178] hover:bg-[#E8DED4]/50"
                                }`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Back</span>
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={!canContinue() || isSubmitting}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-500 ${canContinue() && !isSubmitting
                                ? "bg-[#5C6B4A] text-[#FDF8F3] hover:bg-[#4A5A3A]"
                                : "bg-[#E8DED4] text-[#8B8178] cursor-not-allowed"
                                }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Sparkles className="w-4 h-4 animate-pulse" />
                                    <span>Beginning...</span>
                                </>
                            ) : step === questions.length - 1 ? (
                                <>
                                    <span>Begin my journey</span>
                                    <Sparkles className="w-4 h-4" />
                                </>
                            ) : (
                                <>
                                    <span>Continue</span>
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-[#8B8178]/60 mt-6">
                    Your answers help me guide you better
                </p>
            </motion.div>
        </div>
    );
}
