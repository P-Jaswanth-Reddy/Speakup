import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Brain, 
  MessageSquare, 
  Users, 
  FileText, 
  Code2,
  UserCircle,
  LogOut,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import logoSvg from "@/assets/logo.svg";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Aptitude Practice", icon: Brain, href: "/aptitude" },
  { label: "Mock Interview", icon: MessageSquare, href: "/interview" },
  { label: "GD Simulator", icon: Users, href: "/gd" },
  { label: "Resume Analyzer", icon: FileText, href: "/resume" },
  { label: "Code Practice", icon: Code2, href: "/coding" },

  { label: "Profile", icon: UserCircle, href: "/profile" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card shadow-sm hidden md:flex flex-col">
      <div className="p-6 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center translate-y-[10%]">
            <img src={logoSvg} alt="SpeakUp Logo" className="w-full h-full" />
          </div>
          <span className="font-display font-bold text-xl text-foreground">SpeakUp</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Log Out</span>
        </button>
      </div>
    </aside>
  );
}
