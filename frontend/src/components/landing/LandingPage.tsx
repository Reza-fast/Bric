"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useIsMobile } from "@/lib/useMediaQuery";
import "./landing.css";

const IMG = {
  hero: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  manage: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=900&q=80",
  track: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
  report: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80",
  benefit: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
  approve: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=700&q=80",
  finish: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=80",
  step1: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
  step2: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=80",
  step3: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80",
};

function PrimaryBtn({ href, children, accent }: { href: string; children: ReactNode; accent?: boolean }) {
  return (
    <Link href={href} className={`lp-btn ${accent ? "lp-btn-accent" : "lp-btn-primary"}`}>
      {children}
    </Link>
  );
}

function GhostBtn({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="lp-btn lp-btn-ghost">
      {children}
    </Link>
  );
}

function Photo({ src, alt, tall }: { src: string; alt: string; tall?: boolean }) {
  return (
    <div className={`lp-media ${tall ? "lp-media-tall" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="lp-photo" loading="lazy" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="lp-check" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stars() {
  return (
    <div className="lp-stars" aria-hidden>
      {"★★★★★"}
    </div>
  );
}

function PlanIcon({ kind }: { kind: "basic" | "business" | "enterprise" }) {
  return (
    <div className="lp-plan-icon" aria-hidden>
      {kind === "basic" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 12a8 8 0 0114.3-4.9M20 12a8 8 0 01-14.3 4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : kind === "business" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 20V9.5L12 4l8 5.5V20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 20v-6h5v6M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M8 7V6a4 4 0 018 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="5" y="7" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )}
    </div>
  );
}

export function LandingPage() {
  const t = useTranslations("Landing");
  const isMobile = useIsMobile(900);
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  function price(base: number): string {
    const v = yearly ? Math.round(base * 10) : base;
    return `€${v}`;
  }

  function onNewsletter(e: FormEvent) {
    e.preventDefault();
  }

  const navLinks = [
    { href: "#home", label: t("navHome") },
    { href: "#features", label: t("navFeatures") },
    { href: "#about", label: t("navAbout") },
    { href: "#contact", label: t("navContact") },
  ] as const;

  const footerCols: { title: string; links: string[] }[] = [
    {
      title: t("footerProduct"),
      links: [t("linkFeatures"), t("linkPricing"), t("linkIntegrations"), t("linkUpdates"), t("linkApi")],
    },
    {
      title: t("footerSolutions"),
      links: [t("linkArchitects"), t("linkContractors"), t("linkOwners"), t("linkEnterprise"), t("linkSmallTeams")],
    },
    {
      title: t("footerResources"),
      links: [t("linkBlog"), t("linkGuides"), t("linkWebinars"), t("linkHelp"), t("linkCommunity")],
    },
    {
      title: t("footerCompany"),
      links: [t("linkAbout"), t("linkCareers"), t("linkContact"), t("linkPartners"), t("linkPress")],
    },
    {
      title: t("footerLegal"),
      links: [t("linkPrivacy"), t("linkTerms"), t("linkCookies"), t("linkAcceptable"), t("linkService")],
    },
  ];

  const logos = ["Atelier Nord", "Studio Rossi", "Thorne Build", "Apex Construct", "Lumen Arch"];

  return (
    <div className="lp-root">
      <header className="lp-nav">
        <a href="#home" className="lp-brand">
          {t("brand")}
        </a>

        {!isMobile ? (
          <nav className="lp-nav-links" aria-label="Primary">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="lp-nav-link">
                {l.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="lp-nav-actions">
          <LanguageSwitcher />
          {!isMobile ? (
            <>
              <Link href="/login" className="lp-btn lp-btn-outline lp-btn-sm">
                {t("navLogin")}
              </Link>
              <PrimaryBtn href="/register">{t("navStart")}</PrimaryBtn>
            </>
          ) : (
            <button
              type="button"
              className="lp-menu-btn"
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </div>
      </header>

      {isMobile && menuOpen ? (
        <div className="lp-mobile-menu">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="lp-mobile-link" onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href="/login" className="lp-btn lp-btn-outline" onClick={() => setMenuOpen(false)}>
            {t("navLogin")}
          </Link>
          <Link href="/register" className="lp-btn lp-btn-primary" onClick={() => setMenuOpen(false)}>
            {t("navStart")}
          </Link>
        </div>
      ) : null}

      <section id="home" className="lp-hero">
        <div className="lp-hero-copy">
          <p className="lp-brand-mark">{t("brand")}</p>
          <h1 className="lp-hero-title">{t("heroTitle")}</h1>
        </div>
        <div className="lp-hero-side">
          <p className="lp-hero-sub">{t("heroSub")}</p>
          <div className="lp-cta-row">
            <PrimaryBtn href="/register">{t("ctaStart")}</PrimaryBtn>
            <GhostBtn href="#contact">{t("ctaDemo")}</GhostBtn>
          </div>
        </div>
        <div className="lp-hero-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.hero} alt={t("heroVisualAlt")} className="lp-photo" />
        </div>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-section-head">
          <p className="lp-eyebrow">{t("featuresEyebrow")}</p>
          <h2 className="lp-h2">{t("featuresTitle")}</h2>
          <p className="lp-lead">{t("featuresSub")}</p>
        </div>
        <div className="lp-feature-grid">
          <article className="lp-card lp-feature-main">
            <p className="lp-label">{t("feature1Label")}</p>
            <h3 className="lp-h3">{t("feature1Title")}</h3>
            <p className="lp-body">{t("feature1Body")}</p>
            <a href="#pricing" className="lp-text-link">
              {t("feature1Link")} →
            </a>
            <Photo src={IMG.manage} alt={t("feature1Title")} />
          </article>
          <article className="lp-card lp-feature-side">
            <p className="lp-label">{t("feature2Label")}</p>
            <h3 className="lp-h3">{t("feature2Title")}</h3>
            <p className="lp-body">{t("feature2Body")}</p>
            <a href="#pricing" className="lp-text-link">
              {t("feature2Link")} →
            </a>
            <Photo src={IMG.track} alt={t("feature2Title")} tall />
          </article>
          <article className="lp-card lp-feature-side">
            <p className="lp-label">{t("feature3Label")}</p>
            <h3 className="lp-h3">{t("feature3Title")}</h3>
            <p className="lp-body">{t("feature3Body")}</p>
            <a href="#pricing" className="lp-text-link">
              {t("feature3Link")} →
            </a>
            <Photo src={IMG.report} alt={t("feature3Title")} tall />
          </article>
        </div>
      </section>

      <section className="lp-logos" aria-label={t("logosLine")}>
        <p className="lp-logos-line">{t("logosLine")}</p>
        <div className="lp-logo-row">
          {logos.map((name) => (
            <span key={name} className="lp-logo-item">
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head lp-section-head-left">
          <p className="lp-eyebrow">{t("benefitsEyebrow")}</p>
          <h2 className="lp-h2">{t("benefitsTitle")}</h2>
          <p className="lp-lead">{t("benefitsSub")}</p>
        </div>
        <div className="lp-benefit-grid">
          <article className="lp-card lp-benefit-wide">
            <div>
              <p className="lp-label">{t("benefit1Label")}</p>
              <h3 className="lp-h3">{t("benefit1Title")}</h3>
              <p className="lp-body">{t("benefit1Body")}</p>
              <a href="#process" className="lp-text-link">
                {t("benefit1Link")} →
              </a>
            </div>
            <Photo src={IMG.benefit} alt={t("benefit1Title")} />
          </article>
          <article className="lp-card">
            <h3 className="lp-h3">{t("benefit2Title")}</h3>
            <p className="lp-body">{t("benefit2Body")}</p>
            <a href="#process" className="lp-text-link">
              {t("benefit2Link")} →
            </a>
            <Photo src={IMG.approve} alt={t("benefit2Title")} tall />
          </article>
          <article className="lp-card">
            <h3 className="lp-h3">{t("benefit3Title")}</h3>
            <p className="lp-body">{t("benefit3Body")}</p>
            <a href="#process" className="lp-text-link">
              {t("benefit3Link")} →
            </a>
            <Photo src={IMG.finish} alt={t("benefit3Title")} tall />
          </article>
        </div>
      </section>

      <section id="process" className="lp-section">
        <div className="lp-section-head">
          <p className="lp-eyebrow">{t("processEyebrow")}</p>
          <h2 className="lp-h2">{t("processTitle")}</h2>
          <p className="lp-lead">{t("processSub")}</p>
        </div>
        <div className="lp-steps">
          {[
            { title: t("step1Title"), body: t("step1Body"), img: IMG.step1 },
            { title: t("step2Title"), body: t("step2Body"), img: IMG.step2 },
            { title: t("step3Title"), body: t("step3Body"), img: IMG.step3 },
          ].map((step, i) => (
            <article key={step.title} className="lp-step">
              <Photo src={step.img} alt={step.title} />
              <p className="lp-step-num">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="lp-h3">{step.title}</h3>
              <p className="lp-body">{step.body}</p>
            </article>
          ))}
        </div>
        <div className="lp-cta-row lp-cta-center">
          <PrimaryBtn href="/register">{t("ctaStart")}</PrimaryBtn>
          <a href="#contact" className="lp-text-link">
            {t("ctaDemo")} →
          </a>
        </div>
      </section>

      <section id="about" className="lp-section lp-about">
        <p className="lp-eyebrow">{t("aboutEyebrow")}</p>
        <h2 className="lp-h2">{t("aboutTitle")}</h2>
        <p className="lp-lead lp-about-body">{t("aboutBody")}</p>
      </section>

      <section id="pricing" className="lp-section">
        <div className="lp-section-head">
          <p className="lp-eyebrow">{t("pricingEyebrow")}</p>
          <h2 className="lp-h2">{t("pricingTitle")}</h2>
          <p className="lp-lead">{t("pricingSub")}</p>
        </div>
        <div className="lp-billing-wrap">
          <div className="lp-billing">
            <button type="button" className={!yearly ? "lp-billing-active" : ""} onClick={() => setYearly(false)}>
              {t("billingMonthly")}
            </button>
            <button type="button" className={yearly ? "lp-billing-active" : ""} onClick={() => setYearly(true)}>
              {t("billingYearly")}
            </button>
          </div>
        </div>
        <div className="lp-pricing-grid">
          {[
            {
              kind: "basic" as const,
              name: t("planBasic"),
              amount: price(19),
              features: [t("planBasicF1"), t("planBasicF2"), t("planBasicF3")],
            },
            {
              kind: "business" as const,
              name: t("planBusiness"),
              amount: price(29),
              features: [t("planBusinessF1"), t("planBusinessF2"), t("planBusinessF3"), t("planBusinessF4")],
            },
            {
              kind: "enterprise" as const,
              name: t("planEnterprise"),
              amount: price(49),
              features: [
                t("planEnterpriseF1"),
                t("planEnterpriseF2"),
                t("planEnterpriseF3"),
                t("planEnterpriseF4"),
                t("planEnterpriseF5"),
              ],
            },
          ].map((plan) => (
            <article key={plan.name} className="lp-card lp-price-card">
              <PlanIcon kind={plan.kind} />
              <h3 className="lp-h3">{plan.name}</h3>
              <p className="lp-price">
                {plan.amount}
                <span>{t("perMonth")}</span>
              </p>
              <p className="lp-includes">{t("includes")}</p>
              <ul className="lp-price-list">
                {plan.features.map((f) => (
                  <li key={f}>
                    <CheckIcon />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <PrimaryBtn href="/register">{t("ctaGetStarted")}</PrimaryBtn>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <h2 className="lp-h2">{t("testimonialsTitle")}</h2>
          <p className="lp-lead">{t("testimonialsSub")}</p>
        </div>
        <div className="lp-testimonial-grid">
          {[
            { q: t("t1Quote"), n: t("t1Name"), r: t("t1Role") },
            { q: t("t2Quote"), n: t("t2Name"), r: t("t2Role") },
            { q: t("t3Quote"), n: t("t3Name"), r: t("t3Role") },
          ].map((item) => (
            <article key={item.n} className="lp-card lp-quote-card">
              <Stars />
              <blockquote className="lp-quote">“{item.q}”</blockquote>
              <div className="lp-quote-author">
                <div className="lp-avatar" aria-hidden>
                  {item.n
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="lp-quote-name">{item.n}</div>
                  <div className="lp-quote-role">{item.r}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-final-cta">
        <h2 className="lp-h2">{t("ctaTitle")}</h2>
        <p className="lp-lead">{t("ctaSub")}</p>
        <div className="lp-cta-row lp-cta-center">
          <PrimaryBtn href="/register" accent>
            {t("ctaStart")}
          </PrimaryBtn>
          <GhostBtn href="#contact">{t("ctaDemo")}</GhostBtn>
        </div>
      </section>

      <footer id="contact" className="lp-footer">
        <div className="lp-contact-band">
          <div>
            <p className="lp-eyebrow">{t("contactEyebrow")}</p>
            <h2 className="lp-h2">{t("contactTitle")}</h2>
            <p className="lp-body">{t("contactBody")}</p>
            <a href={`mailto:${t("contactEmail")}`} className="lp-text-link">
              {t("contactEmail")}
            </a>
          </div>
          <form className="lp-newsletter" onSubmit={onNewsletter}>
            <h3 className="lp-h3">{t("newsletterTitle")}</h3>
            <p className="lp-body">{t("newsletterSub")}</p>
            <div className="lp-newsletter-row">
              <input type="email" required placeholder={t("newsletterPlaceholder")} aria-label={t("newsletterPlaceholder")} />
              <button type="submit" className="lp-btn lp-btn-primary lp-btn-sm">
                {t("newsletterCta")}
              </button>
            </div>
          </form>
        </div>

        <div className="lp-footer-grid">
          <div className="lp-footer-brand">{t("brand")}</div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <div className="lp-footer-col-title">{col.title}</div>
              <ul className="lp-footer-links">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#features">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lp-footer-bottom">
          <span>{t("copyright", { year })}</span>
          <div className="lp-footer-legal">
            <a href="#contact">{t("linkPrivacy")}</a>
            <a href="#contact">{t("linkTerms")}</a>
            <a href="#contact">{t("linkCookies")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
