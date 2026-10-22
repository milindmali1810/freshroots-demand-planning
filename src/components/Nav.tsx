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

  const link = (href: string, label: string) => (
    <Link href={href} className={path === href ? "font-semibold text-green-800" : "text-gray-700 hover:text-green-800"}>
      {label}
    </Link>
  );

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
        <span className="font-bold text-green-800">Freshroots Demand Planning</span>
        {link("/", "Dashboard")}
        {link("/exceptions", "Exceptions")}
        <button onClick={logout} className="ml-auto text-gray-500 hover:text-gray-800">
          Log out
        </button>
      </nav>
    </header>
  );
}
