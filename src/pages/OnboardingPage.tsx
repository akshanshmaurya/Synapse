import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/config/env";

/* ──────────────────────────────────────────────
   Animation Presets (matches Landing Page)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1];

interface OnboardingQuestion {
    id: string;
    question: string;
    subtitle: string;
    type: "textarea" | "select";
    placeholder?: string;
    options?: { value: string; label: string; hint?: string }[];
    required: boolean;
    phaseNum: string;
}

export default function OnboardingPage() {
    const { isAuthenticated, logout, completeOnboarding } = useAuth();
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


    const questions: OnboardingQuestion[] = [
        {
            id: "why_here",
            question: "What brings you\nhere today?",
            subtitle: "Share what you're hoping to achieve — there are no wrong answers.",
            type: "textarea",
            placeholder: "What's on your mind? What goals, challenges, or questions brought you to Synapse...",
            required: true,
            phaseNum: "01",
        },
        {
            id: "guidance_type",
            question: "What kind of guidance\nare you looking for?",
            subtitle: "This helps your mentor focus on what matters most to you.",
            type: "select",
            options: [
                { value: "career", label: "Career growth & direction", hint: "Navigate your professional path" },
                { value: "skills", label: "Learning new skills", hint: "Build specific competencies" },
                { value: "goals", label: "Setting and achieving goals", hint: "Structure and accountability" },
                { value: "confidence", label: "Building confidence", hint: "Overcome doubt and grow" },
                { value: "balance", label: "Finding balance & clarity", hint: "Mental clarity and focus" },
            ],
            required: true,
            phaseNum: "02",
        },
        {
            id: "experience_level",
            question: "Where are you on\nyour journey?",
            subtitle: "This calibrates the depth and pacing of your sessions.",
            type: "select",
            options: [
                { value: "beginner", label: "Just starting out", hint: "Getting foundations right" },
                { value: "intermediate", label: "Some experience", hint: "Ready to deepen knowledge" },
                { value: "advanced", label: "Experienced, seeking mastery", hint: "Pushing boundaries" },
            ],
            required: true,
            phaseNum: "03",
        },
        {
            id: "mentoring_style",
            question: "What mentoring style\nfeels right for you?",
            subtitle: "Your mentor will adapt its approach to fit your preference.",
            type: "select",
            options: [
                { value: "gentle", label: "Gentle and patient", hint: "Take your time" },
                { value: "supportive", label: "Warm and encouraging", hint: "Built on positivity" },
                { value: "direct", label: "Clear and straightforward", hint: "No fluff, just answers" },
                { value: "challenging", label: "Pushes me to grow", hint: "Constructive pressure" },
            ],
            required: true,
            phaseNum: "04",
        },
    ];

    useEffect(() => {
        if (hasChecked) return;
        if (!isAuthenticated) return;

        setHasChecked(true);

        const checkStatus = async () => {
            try {
                const response = await fetch(`${API_URL}/api/onboarding/status`, {
                    credentials: 'include',
                });
                const data = await response.json();
                if (data.is_complete) {
                    navigate("/dashboard", { replace: true });
                    return;
                }
            } catch (error) {
                console.error("Failed to check onboarding status:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkStatus();
    }, [isAuthenticated, hasChecked, navigate]);

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
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(answers),
            });

            if (response.ok) {
                completeOnboarding();
                navigate("/dashboard", { replace: true });
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error("Onboarding failed:", errorData);
                alert("Onboarding failed. Please try again.");
            }
        } catch (error) {
            console.error("Failed to submit onboarding:", error);
            alert("Network error. Please check your connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    /* ─── Loading State ─── */
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#FDF8F3] flex items-center justify-center relative">
                <div className="grain-overlay" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-12 h-12 rounded-full bg-[#5C6B4A] flex items-center justify-center">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                    <span className="mono-tag text-[10px] text-[#8B8178]">Preparing your space...</span>
                </motion.div>
            </div>
        );
    }

    const currentQuestion = questions[step];
    const progress = ((step + 1) / questions.length) * 100;

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            {/* Grain Texture */}
            <div className="grain-overlay" />

            {/* Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#5C6B4A]/8 blur-[100px]" />
                <div className="absolute bottom-0 -left-24 w-[400px] h-[400px] rounded-full bg-[#D4A574]/10 blur-[100px]" />
            </div>

            {/* ─── Main Split Layout ─── */}
            <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_1.3fr]">

                {/* ═══ LEFT PANEL — Decorative ═══ */}
                <div className="hidden lg:flex relative flex-col justify-between p-12 xl:p-16 overflow-hidden">
                    <div className="absolute inset-0 bg-[#4A5A3A]" />
                    <div
                        className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                            mixBlendMode: "multiply",
                        }}
                    />

                    {/* Logo + Exit */}
                    <div className="relative z-10 flex items-center justify-between">
                        <Link to="/">
                            <span
                                className="text-[#FDF8F3] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                            >
                                Synapse
                            </span>
                        </Link>
                        <button
                            onClick={() => { logout(); navigate("/"); }}
                            className="flex items-center gap-2 px-3 py-2 text-white/40 hover:text-white/70 rounded-full transition-all duration-300"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="mono-tag text-[9px]">Exit</span>
                        </button>
                    </div>

                    {/* Step Progress Visualization */}
                    <div className="relative z-10 flex-1 flex items-center justify-center">
                        <div className="flex flex-col gap-6 w-full max-w-[280px]">
                            {questions.map((q, i) => (
                                <motion.div
                                    key={q.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.6, delay: 0.2 + i * 0.1, ease }}
                                    className="flex items-center gap-4"
                                >
                                    {/* Step indicator */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shrink-0 ${
                                        i < step ? "bg-white/20 border border-white/30"
                                        : i === step ? "bg-white border border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                        : "bg-white/5 border border-white/10"
                                    }`}>
                                        {i < step ? (
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <span className={`mono-tag text-[10px] ${
                                                i === step ? "text-[#4A5A3A]" : "text-white/30"
                                            }`}>{q.phaseNum}</span>
                                        )}
                                    </div>
                                    {/* Line */}
                                    <div className={`flex-1 transition-all duration-500 ${
                                        i <= step ? "text-white/70" : "text-white/20"
                                    }`}>
                                        <span className={`text-sm font-medium ${
                                            i === step ? "text-white" : i < step ? "text-white/50" : "text-white/20"
                                        }`}>
                                            {q.question.split("\n")[0]}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.6, ease }}
                        className="relative z-10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-px bg-white/20" />
                            <span className="mono-tag text-[9px] text-white/25">STEP {step + 1} OF {questions.length}</span>
                        </div>
                    </motion.div>
                </div>

                {/* ═══ RIGHT PANEL — Question Form ═══ */}
                <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 py-12 relative">

                    {/* Mobile Header */}
                    <div className="lg:hidden mb-8 flex items-center justify-between">
                        <Link to="/">
                            <span
                                className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                            >
                                Synapse
                            </span>
                        </Link>
                        <button
                            onClick={() => { logout(); navigate("/"); }}
                            className="flex items-center gap-2 px-3 py-2 text-[#8B8178] hover:text-[#5C6B4A] rounded-full transition-all duration-300"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="text-xs">Exit</span>
                        </button>
                    </div>

                    {/* Mobile Progress Bar */}
                    <div className="lg:hidden mb-8">
                        <div className="h-1 bg-[#E8DED4] rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-[#5C6B4A] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.6, ease }}
                            />
                        </div>
                        <p className="mono-tag text-[9px] text-[#8B8178] mt-2">
                            Step {step + 1} of {questions.length}
                        </p>
                    </div>

                    {/* Question Content */}
                    <div className="w-full max-w-[560px] mx-auto lg:mx-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5, ease }}
                            >
                                {/* Phase Tag */}
                                <span className="mono-tag text-[10px] text-[#8B8178] mb-4 block">
                                    // Phase_{currentQuestion.phaseNum} — Discovery
                                </span>

                                {/* Question */}
                                <h2
                                    className="font-serif text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.1] tracking-tight text-[#5C6B4A] mb-3 whitespace-pre-line"
                                >
                                    {currentQuestion.question}
                                </h2>

                                <p className="text-[#8B8178] text-base leading-relaxed mb-8 max-w-md">
                                    {currentQuestion.subtitle}
                                </p>

                                {/* Answer Area */}
                                {currentQuestion.type === "textarea" ? (
                                    <div className="relative group">
                                        <textarea
                                            value={answers[currentQuestion.id]}
                                            onChange={(e) => handleAnswer(e.target.value)}
                                            placeholder={currentQuestion.placeholder}
                                            className="w-full p-5 bg-white/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/40 resize-none h-40 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/30 transition-all duration-500 backdrop-blur-sm leading-relaxed"
                                            style={{ fontFamily: "'Inter', sans-serif" }}
                                        />
                                        {/* Character hint */}
                                        <span className="absolute bottom-3 right-4 mono-tag text-[8px] text-[#8B8178]/30">
                                            {answers[currentQuestion.id]?.length || 0} chars
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {currentQuestion.options?.map((option, i) => (
                                            <motion.button
                                                key={option.value}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.4, delay: i * 0.05, ease }}
                                                onClick={() => handleAnswer(option.value)}
                                                className={`w-full p-5 rounded-2xl border text-left transition-all duration-500 group flex items-center justify-between ${
                                                    answers[currentQuestion.id] === option.value
                                                        ? "bg-[#5C6B4A] border-[#5C6B4A] text-[#FDF8F3] shadow-[0_8px_30px_rgba(92,107,74,0.2)]"
                                                        : "bg-white/50 border-[#E8DED4] text-[#3D3D3D] hover:border-[#5C6B4A]/30 hover:bg-white/80 backdrop-blur-sm"
                                                }`}
                                            >
                                                <div>
                                                    <span className="block font-medium text-base">{option.label}</span>
                                                    {option.hint && (
                                                        <span className={`block text-xs mt-1 transition-colors ${
                                                            answers[currentQuestion.id] === option.value
                                                                ? "text-white/50"
                                                                : "text-[#8B8178]/60"
                                                        }`}>
                                                            {option.hint}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Selection indicator */}
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                                                    answers[currentQuestion.id] === option.value
                                                        ? "border-white bg-white"
                                                        : "border-[#E8DED4] group-hover:border-[#5C6B4A]/30"
                                                }`}>
                                                    {answers[currentQuestion.id] === option.value && (
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#5C6B4A]" />
                                                    )}
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-10 pt-8 border-t border-[#E8DED4]">
                            <button
                                onClick={handleBack}
                                disabled={step === 0}
                                className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all duration-500 ${
                                    step === 0
                                        ? "text-[#8B8178]/30 cursor-not-allowed"
                                        : "text-[#8B8178] hover:bg-[#E8DED4]/50 hover:text-[#5C6B4A]"
                                }`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="text-sm font-medium">Back</span>
                            </button>

                            <button
                                onClick={handleNext}
                                disabled={!canContinue() || isSubmitting}
                                className={`group flex items-center gap-3 px-7 py-3.5 rounded-full font-semibold text-base transition-all duration-500 ${
                                    canContinue() && !isSubmitting
                                        ? "bg-[#5C6B4A] text-[#FDF8F3] hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(92,107,74,0.2)]"
                                        : "bg-[#E8DED4] text-[#8B8178]/50 cursor-not-allowed"
                                }`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Beginning...
                                    </span>
                                ) : step === questions.length - 1 ? (
                                    <>
                                        <span>Begin my journey</span>
                                        <Sparkles className="w-4 h-4" />
                                    </>
                                ) : (
                                    <>
                                        <span>Continue</span>
                                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Footer */}
                        <div className="mt-10 flex items-center gap-3">
                            <div className="w-6 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/40">
                                Your answers help your mentor guide you better
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
