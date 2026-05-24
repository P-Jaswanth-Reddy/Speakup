import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

interface LayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
}

export function Layout({ children, fullWidth = false, noPadding = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64">
        <MobileNav />
        <main className={`flex-1 w-full flex flex-col ${!noPadding ? "p-4 md:p-8" : ""} ${!fullWidth ? "max-w-7xl mx-auto" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
