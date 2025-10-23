import * as z from "zod";
import { CreateOrganizationSchema as EnhancedCreateOrganizationSchema, UpdateOrganizationSchema } from "./security";

// Keep backward compatibility while using enhanced schemas
export const CreateOrganizationSchema = EnhancedCreateOrganizationSchema;

export const UpdateOrganizationFormSchema = UpdateOrganizationSchema;

export type CreateOrganizationValues = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationValues = z.infer<typeof UpdateOrganizationFormSchema>; 