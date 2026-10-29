import type { Metadata } from "next";
import Link from "next/link";
import { adminModules, plannedModules } from "@/components/admin/modules";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Home" };

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Admin home</h1>
      <p className="mt-3 text-base text-slate md:text-[17px]">Choose what you&apos;d like to work on.</p>

      <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {adminModules.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex h-full flex-col rounded-[18px] border border-sand bg-white p-6 no-underline transition-shadow hover:shadow-card"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-sage text-green">
                <Icon name={item.icon} size={22} />
              </span>
              <span className="mt-4 font-serif text-xl font-bold text-navy">{item.label}</span>
              <span className="mt-2 text-base text-slate">{item.description}</span>
              <span className="mt-4 font-semibold text-navy transition-colors group-hover:text-green">
                Open {item.label.toLowerCase()} <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-sm font-bold tracking-[0.12em] text-slate uppercase">Planned for later</h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {plannedModules.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 rounded-full border border-dashed border-field px-4 py-2 text-[15px] text-slate"
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </li>
        ))}
      </ul>
    </Container>
  );
}
