import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Map, User, Settings, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Mentors", path: "/mentor" },
        { icon: Map, label: "Roadmap", path: "/roadmap" },
        { icon: User, label: "Profile", path: "/profile" },
    ];

    return (
        <aside className="h-screen w-20 lg:w-64 border-r border-[#E5E7EB] bg-white flex flex-col fixed left-0 top-0 z-40">
            {/* Logo */}
            <div className="p-6 flex items-center gap-3 border-b border-[#E5E7EB]">
                <div className="w-10 h-10 rounded-full bg-[#4A7C59] flex items-center justify-center text-white">
                    <Sprout className="w-5 h-5" />
                </div>
                <div className="hidden lg:block">
                    <span className="font-serif text-lg font-semibold text-[#1A2E1A]">CareerEco</span>
                    <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">Organic Growth</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path ||
                        (item.path === "/dashboard" && location.pathname === "/");
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                isActive
                                    ? "bg-[#4A7C59] text-white shadow-md shadow-[#4A7C59]/20"
                                    : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A2E1A]"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="hidden lg:block font-medium text-sm">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t border-[#E5E7EB]">
                <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[#6B7280] hover:bg-[#F3F4F6] transition-all">
                    <Settings className="w-5 h-5" />
                    <span className="hidden lg:block font-medium text-sm">Settings</span>
                </button>

                {/* User Avatar */}
                <div className="flex items-center gap-3 px-4 py-3 mt-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#84CC16] to-[#4A7C59] flex items-center justify-center text-white text-xs font-bold">
                        U
                    </div>
                    <div className="hidden lg:block">
                        <p className="text-sm font-medium text-[#1A2E1A]">User</p>
                        <p className="text-[10px] text-[#6B7280]">Seedling Stage</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
