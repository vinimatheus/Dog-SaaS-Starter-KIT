import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"
import Resend from "next-auth/providers/resend"
import { DefaultSession } from "next-auth"
import axios from "axios"

// Habilita a validação de recaptcha na URL da verificação
const addRecaptchaToUrl = (url: string, recaptchaToken: string): string => {
	const urlObj = new URL(url)
	urlObj.searchParams.set("recaptchaToken", recaptchaToken)
	return urlObj.toString()
}

export const {
	handlers,
	signIn,
	signOut,
	auth,
} = NextAuth({
	adapter: PrismaAdapter(prisma),
	session: {
		strategy: "jwt",
	},
	providers: [
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
		Resend({
			apiKey: process.env.RESEND_API_KEY!,
			from: process.env.EMAIL_FROM!,
			server: process.env.NEXTAUTH_URL!,
			sendVerificationRequest: async ({ identifier: email, url, provider: { from } }) => {
				if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada")
				if (!email || !from) throw new Error("Email ou remetente não configurados")

				// ✅ Verifica reCAPTCHA
				const recaptchaToken = new URL(url).searchParams.get("recaptchaToken")

				if (!recaptchaToken) throw new Error("Token do reCAPTCHA ausente")

				const recaptchaRes = await axios.post(
					"https://www.google.com/recaptcha/api/siteverify",
					null,
					{
						params: {
							secret: process.env.RECAPTCHA_SECRET_KEY,
							response: recaptchaToken,
						},
					}
				)

				if (!recaptchaRes.data.success || recaptchaRes.data.score < 0.5) {
					throw new Error("Verificação do reCAPTCHA falhou")
				}

				// ✅ Envia e-mail
				const { Resend } = await import("resend")
				const resend = new Resend(process.env.RESEND_API_KEY)

				try {
					await resend.emails.send({
						from,
						to: email,
						subject: "Link de acesso para Dog Inc.",
						headers: {
							"X-Entity-Ref-ID": "dog-inc-login",
							"List-Unsubscribe": `<mailto:${from}?subject=unsubscribe>`,
							"Precedence": "bulk",
							"X-Auto-Response-Suppress": "OOF, AutoReply",
							"X-Gmail-Labels": "Login, Dog Inc",
						},
						html: `
							<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
								<div style="display: none;">Dog Inc Login Link</div>
								<h1 style="color: #333;">Bem-vindo ao Dog Inc.</h1>
								<p>Clique no link abaixo para fazer login:</p>
								<a href="${url}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
									Fazer Login
								</a>
								<p style="color: #666; font-size: 14px;">Se você não solicitou este email, pode ignorá-lo.</p>
							</div>
						`,
					})
				} catch {
					throw new Error("Erro ao enviar email de verificação")
				}
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id

				const dbUser = await prisma.user.findUnique({
					where: { id: user.id }
				})

				if (!dbUser) throw new Error("User not found")

				// 🔴 (Removido) Atualização desnecessária do sessionVersion

				token.sessionVersion = dbUser.sessionVersion

				const membership = await prisma.user_Organization.findFirst({
					where: { user_id: user.id },
					include: { organization: true },
				})

				token.orgId = membership?.organization?.uniqueId ?? null
			} else if (token.id) {
				const dbUser = await prisma.user.findUnique({
					where: { id: token.id as string }
				})

				if (!dbUser) return { ...token, error: "User not found" }

				if (token.sessionVersion !== dbUser.sessionVersion) {
					return { ...token, error: "Session invalidated" }
				}
			}

			return token
		},
		async session({ session, token }) {
			if (token.error) {
				return { expires: "", user: { name: "", email: "" } } as DefaultSession
			}

			session.user.id = token.id as string
			session.user.orgId = token.orgId as string | undefined
			session.user.sessionVersion = token.sessionVersion as number
			return session
		},
		async redirect({ baseUrl }) {
			return baseUrl
		},
	},
	events: {
		createUser: async ({ user }) => {
			if (!user?.id) throw new Error("User ID is required")
		},
	},
	secret: process.env.AUTH_SECRET,
})
