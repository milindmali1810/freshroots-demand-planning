"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  if (path === "/login") return null;

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${active ? "border-blue-800 text-blue-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-5 px-4 sm:px-6" aria-label="Main">
        <Link href="/" className="whitespace-nowrap py-3 text-base font-bold text-slate-900">
          Freshroots <span className="hidden font-medium text-slate-600 sm:inline">Demand Planning</span>
        </Link>
        <div className="ml-2 flex items-center gap-4">
          {link("/", "Dashboard", path === "/" || path.startsWith("/runs") || path.startsWith("/skus"))}
          {link("/exceptions", "Exceptions", path.startsWith("/exceptions"))}
        </div>
        <button onClick={logout} className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
          Log out
        </button>
      </nav>
    </header>
  );
}
