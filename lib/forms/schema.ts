import { z } from "zod";

export const inquirySchema = z.object({
  type: z.enum(["item", "transfer", "general", "service"]),
  // Shape check only — Postgres owns real UUID + FK validation. zod's
  // strict .uuid() rejects valid-looking ids with unusual version bits.
  item_id: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Bad item reference.")
    .optional()
    .or(z.literal("")),
  item_slug: z.string().max(120).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().email("That email doesn't look right.").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(2000, "Keep it under 2000 characters.").optional().or(z.literal("")),
  // Honeypot: humans never see it, bots fill it.
  website: z.string().max(0),
});

export type InquiryFields = z.infer<typeof inquirySchema>;

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof InquiryFields, string>>;
};

export const initialFormState: FormState = { status: "idle" };
