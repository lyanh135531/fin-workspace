import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button, Card } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";
import type { LegalDocument } from "@/domain/legal-policy/policy";

type LegalDocumentPageProps = {
  document: LegalDocument;
  contactEmail: string;
};

export function LegalDocumentPage({
  document,
  contactEmail,
}: LegalDocumentPageProps) {
  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]"
      tabIndex={-1}
    >
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:min-h-20 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Felix, trang chủ">
            <FinLogo size={32} showText />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <Button
          variant="link"
          nativeButton={false}
          render={<Link href="/" />}
          className="mb-6 px-0"
        >
          <ArrowLeft aria-hidden="true" />
          Về trang chủ
        </Button>

        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--primary)]">
            Phiên bản {document.version} · Hiệu lực {document.effectiveDate}
          </p>
          <h1 className="mt-3 text-balance font-serif text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            {document.title}
          </h1>
          <p className="mt-5 text-base leading-7 text-[var(--text-secondary)] sm:text-lg sm:leading-8">
            {document.summary}
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:mt-12">
          {document.sections.map((section) => (
            <Card as="section" key={section.title} aria-labelledby={section.title}>
              <h2
                id={section.title}
                className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl"
              >
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-[72ch] text-base leading-7 text-[var(--text-secondary)]"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-base leading-7 text-[var(--text-secondary)] marker:text-[var(--primary)]">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-10 border-t border-[var(--border)] pt-8">
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex min-h-11 items-center gap-2 font-medium text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Mail aria-hidden="true" />
            {contactEmail}
          </a>
        </div>
      </div>
    </main>
  );
}
