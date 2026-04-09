import type { Metadata } from "next";
import { Inter, Fira_Code, Poppins, Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ScrollHandler from "@/components/ui/ScrollHandler";
import { OrchestrationProvider } from "@/hooks/useOrchestrationSocket";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-poppins" });

export const metadata: Metadata = {
  title: "Horizon AI",
  description: "Multi-Agent Glassbox Refactoring Studio",
  icons: {
    icon: "/logo-dark.png", 
    apple: "/logo-dark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} ${firaCode.variable} ${poppins.variable} font-sans antialiased text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <OrchestrationProvider>
            <ScrollHandler />
            {children}
          </OrchestrationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
