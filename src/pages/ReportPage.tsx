import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  Download, 
  Trophy, 
  Target, 
  Zap, 
  Brain, 
  TrendingUp, 
  Map,
  ChevronRight,
  User,
  AlertCircle
} from "lucide-react";
import { fetchLearningReport } from "@/services/api";
import type { LearningReport } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

const ease = [0.23, 1, 0.32, 1] as const;

export default function ReportPage() {
  const [report, setReport] = useState<LearningReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true);
      try {
        const data = await fetchLearningReport();
        if (!data) throw new Error("Report data not found");
        setReport(data);
      } catch (err) {
        console.error("Failed to load report:", err);
        setError("Unable to generate your learning report at this time.");
      } finally {
        setIsLoading(false);
      }
    };
    loadReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <AppShell activePath="/report">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <DashboardSkeleton />
        </div>
      </AppShell>
    );
  }

  if (error || !report) {
    return (
      <AppShell activePath="/report">
        <div className="max-w-4xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#3D3D3D]">Report Unavailable</h2>
          <p className="text-[#8B8178] max-w-sm">{error || "Please try again later."}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/report">
      <div className="max-w-4xl mx-auto px-6 py-10 print:py-0 print:px-0 space-y-8 min-h-screen">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 print:hidden">
          <div>
            <span className="mono-tag text-[10px] text-[#8B8178] mb-3 block lowercase">// Learning Outcome Report</span>
            <h1 className="text-4xl font-black leading-none tracking-tight text-[#5C6B4A] uppercase italic">
              Outcome<br />Report.
            </h1>
          </div>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 bg-[#5C6B4A] text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </header>

        {/* PRINTABLE AREA */}
        <div id="printable-report" className="space-y-8 bg-white/50 backdrop-blur-sm p-8 rounded-[2rem] border border-[#E8DED4] shadow-sm print:shadow-none print:border-none print:bg-white print:p-0 print:rounded-none">
          
          {/* USER PROFILE CARD */}
          <section className="bg-white p-6 rounded-2xl border border-[#E8DED4] flex flex-col md:flex-row gap-6 items-center">
            <div className="w-20 h-20 rounded-2xl bg-[#5C6B4A] flex items-center justify-center text-white shrink-0">
              <User size={40} strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-black text-[#5C6B4A] uppercase tracking-tight">User Profile</h2>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                <span className="px-3 py-1 bg-[#5C6B4A10] text-[#5C6B4A] rounded-md text-[10px] font-bold uppercase tracking-wider">
                  Level: {report.profile.experience_level}
                </span>
                <span className="px-3 py-1 bg-[#5C6B4A10] text-[#5C6B4A] rounded-md text-[10px] font-bold uppercase tracking-wider">
                  Tone: {report.profile.mentoring_tone}
                </span>
              </div>
              <p className="text-sm text-[#8B8178] mt-3">
                Focus Areas: {report.profile.career_interests.join(", ") || "General Inquiry"}
              </p>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-[10px] font-mono text-[#8B8178] uppercase">Generated On</p>
              <p className="text-sm font-bold text-[#3D3D3D]">{new Date(report.generated_at).toLocaleDateString()}</p>
            </div>
          </section>

          {/* MASTERED CONCEPTS & NEEDS WORK */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* TOP MASTERY */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-2xl border border-[#E8DED4] flex flex-col gap-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#5C6B4A10] flex items-center justify-center text-[#5C6B4A]">
                  <Trophy size={20} />
                </div>
                <h3 className="text-lg font-black text-[#3D3D3D] uppercase tracking-tight">Top Mastery</h3>
              </div>
              
              <div className="space-y-4">
                {report.concepts.top_mastery.map((c, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide">
                      <span className="text-[#3D3D3D]">{c.name}</span>
                      <span className="text-[#5C6B4A]">{c.mastery}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#5C6B4A08] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: `${c.mastery}%` }} transition={{ duration: 1, delay: i * 0.1 + 0.3 }}
                        className="h-full bg-[#5C6B4A] rounded-full" 
                      />
                    </div>
                  </div>
                ))}
                {report.concepts.top_mastery.length === 0 && (
                  <p className="text-xs text-[#8B8178] italic">No high-mastery concepts captured yet.</p>
                )}
              </div>
            </motion.div>

            {/* NEEDS WORK */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white p-6 rounded-2xl border border-[#E8DED4] flex flex-col gap-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#DE6B4810] flex items-center justify-center text-[#DE6B48]">
                  <Target size={20} />
                </div>
                <h3 className="text-lg font-black text-[#3D3D3D] uppercase tracking-tight">Growth Areas</h3>
              </div>
              
              <div className="space-y-4">
                {report.concepts.needs_work.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#E8DED430] rounded-xl group hover:bg-[#E8DED450] transition-colors">
                    <div>
                      <h4 className="text-sm font-bold text-[#3D3D3D]">{c.name}</h4>
                      <p className="text-[10px] text-[#8B8178] uppercase font-bold tracking-wider">{c.domain}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-[#DE6B48]">{c.mastery}%</p>
                      <p className="text-[9px] text-[#8B8178] uppercase font-bold">Current Score</p>
                    </div>
                  </div>
                ))}
                {report.concepts.needs_work.length === 0 && (
                  <p className="text-xs text-[#8B8178] italic">All concepts are progressing well.</p>
                )}
              </div>
            </motion.div>
          </div>

          {/* STATS STRIP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Sessions", val: report.learning_stats.total_sessions, icon: Brain },
              { label: "Day Streak", val: report.learning_stats.consistency_streak, icon: Zap },
              { label: "Total Evals", val: report.learning_stats.total_evaluations, icon: FileText },
              { label: "Trend", val: report.learning_stats.clarity_trend, icon: TrendingUp },
            ].map((stat, i) => (
              <motion.div 
                key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.05 }}
                className="bg-white border border-[#E8DED4] p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2"
              >
                <stat.icon className="w-5 h-5 text-[#5C6B4A]" />
                <div>
                  <p className="text-xs font-black text-[#3D3D3D] uppercase leading-none mb-1">{stat.val}</p>
                  <p className="text-[9px] font-bold text-[#8B8178] uppercase tracking-wide">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ROADMAP STATUS */}
          <section className="bg-[#5C6B4A] p-8 rounded-3xl text-white overflow-hidden relative">
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8 md:items-center">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#FFFFFF80]">
                  <Map size={14} />
                  <span>Current Trajectory</span>
                </div>
                <h3 className="text-3xl font-black italic tracking-tight">{report.roadmap_progress.latest_roadmap_title}</h3>
                <p className="text-sm text-[#FFFFFFCC] max-w-lg italic">
                  You've successfully mapped your path. Keep engaging with the mentor to unlock deeper nodes in your knowledge graph.
                </p>
              </div>
              <div className="shrink-0 text-center md:text-right border-l md:border-l-[#FFFFFF20] md:pl-8">
                <p className="text-6xl font-black tracking-tighter leading-none">{report.roadmap_progress.total_roadmaps}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFFFFFCC]">Roadmaps Mapped</p>
              </div>
            </div>
            
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          </section>

          {/* DOMAINS LIST */}
          <footer className="pt-4 border-t border-[#E8DED4] flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <p className="text-[10px] font-bold text-[#8B8178] uppercase tracking-widest mb-1">Domains Explored</p>
              <div className="flex flex-wrap gap-2">
                {report.concepts.domains_covered.map((d, i) => (
                  <span key={i} className="text-xs font-bold text-[#3D3D3D]">{d}{i < report.concepts.domains_covered.length - 1 ? " • " : ""}</span>
                ))}
                {report.concepts.domains_covered.length === 0 && <span className="text-xs text-[#8B8178]">None yet</span>}
              </div>
            </div>
            <div className="ml-auto text-right print:block hidden">
              <p className="text-[10px] font-bold text-[#5C6B4A] uppercase tracking-widest leading-none">Synapse Adaptive Mentor</p>
              <p className="text-[8px] text-[#8B8178]">Verification ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            </div>
          </footer>
        </div>

        {/* PRINT STYLES */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { background: white !important; }
            .print\\:hidden { display: none !important; }
            #printable-report { margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
            header { display: none !important; }
            aside { display: none !important; }
            main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
          }
        ` }} />
      </div>
    </AppShell>
  );
}
