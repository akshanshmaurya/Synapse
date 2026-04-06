import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
    Home, MessageSquare, Map, User, BarChart3,
    LogOut, Network,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
    icon: LucideIcon;
    label: string;
    path: string;
    active: boolean;
}

interface AppShellProps {
    children: ReactNode;
    activePath: string;
}

export default function AppShell({ children, activePath }: AppShellProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const navItems: NavItem[] = [
        { icon: Home, label: "Garden", path: "/dashboard", active: activePath === "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor", active: activePath === "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap", active: activePath === "/roadmap" },
        { icon: Network, label: "Concepts", path: "/concept-map", active: activePath === "/concept-map" },
        { icon: BarChart3, label: "Analytics", path: "/analytics", active: activePath === "/analytics" },
        { icon: User, label: "Roots", path: "/profile", active: activePath === "/profile" },
    ];

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            <div className="grain-overlay" />

            {/* Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-40 right-20 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/6 blur-[140px]" />
                <div className="absolute bottom-20 -left-32 w-[500px] h-[500px] rounded-full bg-[#D4A574]/8 blur-[120px]" />
                <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full bg-[#E8DED4]/25 blur-[90px]" />
            </div>

            <div className="flex min-h-screen relative z-10">
                {/* ═══ SIDEBAR ═══ */}
                <aside className="w-72 flex-col fixed h-screen hidden md:flex bg-white/40 backdrop-blur-xl border-r border-[#E8DED4]/60">
                    <div className="p-8 pb-0">
                        <Link to="/" className="block mb-1">
                            <span className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>
                                Synapse
                            </span>
                        </Link>
                        <div className="flex items-center gap-2 mb-10">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                            <span className="mono-tag text-[8px] text-[#8B8178]/50">Active Session</span>
                        </div>
                    </div>

                    <nav className="px-4 space-y-1 flex-1">
                        {navItems.map((item, i) => (
                            <Link key={item.path} to={item.path}
                                className={`group flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all duration-500 relative ${
                                    item.active
                                        ? "bg-[#5C6B4A] text-white shadow-[0_10px_30px_rgba(92,107,74,0.25)]"
                                        : "text-[#8B8178] hover:bg-[#5C6B4A]/5 hover:text-[#3D3D3D]"
                                }`}>
                                <span className={`mono-tag text-[8px] ${item.active ? "text-white/30" : "text-[#8B8178]/30"}`}>0{i + 1}</span>
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.active && (
                                    <motion.div layoutId="nav-indicator" className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/60" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 space-y-2 mt-auto">
                        {user && (
                            <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">
                                        {(user.name || user.email)?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm text-[#3D3D3D] font-medium block truncate">{user.name || user.email}</span>
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button onClick={() => { logout(); navigate("/"); }}
                            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full">
                            <LogOut className="w-[18px] h-[18px]" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══ MAIN CONTENT ═══ */}
                <main className="flex-1 ml-0 md:ml-72 pb-24 md:pb-0">
                    {children}
                </main>
            </div>

            {/* ═══ MOBILE BOTTOM NAV ═══ */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-[#E8DED4]/50 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around">
                    {navItems.map((item) => (
                        <Link key={item.path} to={item.path}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                                item.active ? "text-[#5C6B4A]" : "text-[#8B8178]/50"
                            }`}>
                            <item.icon className={`w-5 h-5 ${item.active ? "drop-shadow-sm" : ""}`} />
                            <span className="text-[9px] font-medium">{item.label}</span>
                            {item.active && <div className="w-1 h-1 rounded-full bg-[#5C6B4A]" />}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
