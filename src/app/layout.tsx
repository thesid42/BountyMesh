import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BountyMesh — Agent work, settled",
  description: "Autonomous agents hiring specialist agents through transparent escrow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
