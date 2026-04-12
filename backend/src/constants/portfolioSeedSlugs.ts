/** Slugs for seeded portfolio projects (migration + membership linking). */
export const PORTFOLIO_SEED_SLUGS = [
  "skyline-residency",
  "oakwood-commercial-hub",
  "vertex-corporate-plaza",
  "riverbend-luxury-lofts",
  "aurora-science-labs",
  "apex-industrial-center",
] as const;

export type PortfolioSeedSlug = (typeof PORTFOLIO_SEED_SLUGS)[number];
