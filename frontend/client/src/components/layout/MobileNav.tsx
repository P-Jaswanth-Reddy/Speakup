import { Link } from "wouter";
import { cn } from "@/lib/utils";
import logoSvg from "@/assets/logo.svg";
import { 
  Menu,
  LayoutDashboard, 
  Brain, 
  MessageSquare, 
  Users, 
  FileText, 
  Code2,
  UserCircle
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Aptitude", icon: Brain, href: "/aptitude" },
  { label: "Interview", icon: MessageSquare, href: "/interview" },
  { label: "GD", icon: Users, href: "/gd" },
  { label: "Resume", icon: FileText, href: "/resume" },
  { label: "Coding", icon: Code2, href: "/coding" },
  { label: "Profile", icon: UserCircle, href: "/profile" },
];

export function MobileNav() {
  return (
    <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 flex items-center justify-center translate-y-[10%]">
          <img src={logoSvg} alt="SpeakUp Logo" className="w-full h-full" />
        </div>
        <span className="font-display font-bold text-xl">SpeakUp</span>
      </div>
      
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[80%] max-w-[300px]">
          <div className="flex flex-col gap-4 mt-8">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-foreground">
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
