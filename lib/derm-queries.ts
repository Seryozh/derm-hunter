// 10 high-intent dermatology search queries for YouTube discovery
// Designed to find practicing dermatologists who create content, not beauty influencers

export const DERM_QUERIES = [
  "dermatologist skincare routine board certified",
  "dermatologist explains acne treatment",
  "board certified dermatologist skin cancer screening",
  "dermatologist reacts to skincare products",
  "dermatologist cosmetic procedures before after",
  "dermatologist Mohs surgery patient education",
  "dermatologist botox filler injection technique",
  "dermatologist eczema psoriasis treatment plan",
  "dermatologist laser treatment skin resurfacing",
  "dermatologist practice day in the life clinic",
] as const;

export type DermQuery = (typeof DERM_QUERIES)[number];
