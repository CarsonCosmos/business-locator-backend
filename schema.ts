import { pgTable, text, serial, integer, boolean, varchar, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Business schema
export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  website: text("website"),
  hasWebsite: boolean("has_website").notNull().default(false),
  rating: numeric("rating", { precision: 3, scale: 1 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  description: text("description"),
  services: text("services").array(),
  isHighestRated: boolean("is_highest_rated").notNull().default(false),
  yelpUrl: text("yelp_url"),
  googleUrl: text("google_url"),
});

// Defining the insert schema for businesses
export const insertBusinessSchema = createInsertSchema(businesses).omit({ 
  id: true 
}).extend({
  email: z.string().nullable(),
  website: z.string().nullable(),
  hasWebsite: z.boolean(),
  rating: z.string().default("0"),
  reviewCount: z.number().default(0),
  description: z.string().nullable(),
  isHighestRated: z.boolean().default(false),
  yelpUrl: z.string().nullable().optional(),
  googleUrl: z.string().nullable().optional()
});

// Tags associated with businesses
export const businessTags = pgTable("business_tags", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  tag: text("tag").notNull(),
});

export const insertBusinessTagSchema = createInsertSchema(businessTags).omit({ 
  id: true 
});

// Export types
export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type BusinessTag = typeof businessTags.$inferSelect;
export type InsertBusinessTag = z.infer<typeof insertBusinessTagSchema>;

// Search schema used for API requests
export const searchSchema = z.object({
  industry: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(9),
  sort: z.enum(['relevance', 'rating-high', 'rating-low', 'name-asc', 'name-desc']).default('relevance'),
  filter: z.enum(['all', 'no-website', 'highest-rated']).default('all'),
});

export type SearchParams = z.infer<typeof searchSchema>;
