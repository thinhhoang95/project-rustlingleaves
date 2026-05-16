import type { Metadata } from "next";
import { APP_INFO } from "@/app/app-info";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_INFO.name,
  description: "Minimal arrivals view with waypoint rendering",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
