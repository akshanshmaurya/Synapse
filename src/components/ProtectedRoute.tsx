import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    children: ReactNode;
    requireOnboarding?: boolean;
}

/**
 * ProtectedRoute - Wraps pages that require authentication
 * 
 * Behavior:
 * - If not authenticated → redirect to /signin
 * - If authenticated but onboarding incomplete → redirect to /onboarding
 * - If authenticated and onboarding complete → render children
 */
export default function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, onboardingComplete } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            navigate("/signin", { replace: true });
            return;
        }

        if (requireOnboarding && !onboardingComplete) {
            navigate("/onboarding", { replace: true });
            return;
        }
    }, [isAuthenticated, isLoading, onboardingComplete, navigate, requireOnboarding]);

    // Show nothing while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#5C6B4A]/20 mx-auto mb-4 animate-pulse" />
                    <p className="text-[#8B8178]">Finding your path...</p>
                </div>
            </div>
        );
    }

    // Don't render if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    // Don't render if onboarding required but not complete
    if (requireOnboarding && !onboardingComplete) {
        return null;
    }

    return <>{children}</>;
}
