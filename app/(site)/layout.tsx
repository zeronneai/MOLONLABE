import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import IntroGame from "@/components/intro/IntroGame";

// Public site chrome. The admin route group renders without any of this.
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <IntroGame />
    </div>
  );
}
