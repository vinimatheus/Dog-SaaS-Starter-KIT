import Stripe from "stripe"
import { validateStripeConfigOrThrow } from "./stripe-config-validator"

// Validate Stripe configuration on module load
validateStripeConfigOrThrow()

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY não está definida")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
}) 