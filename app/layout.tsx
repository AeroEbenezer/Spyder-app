import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spyder - Document to Audiobook",
  description: "Convert documents to professional audiobooks with AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#09090C] text-white">{children}</body>
    </html>
  );
}
