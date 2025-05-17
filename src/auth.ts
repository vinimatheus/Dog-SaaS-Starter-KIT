import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"
import Resend from "next-auth/providers/resend"
import { DefaultSession } from "next-auth"
import axios from "axios"

export const {
	handlers,
	signIn,
	signOut,
	auth,
	unstable_update,
} = NextAuth({
	adapter: PrismaAdapter(prisma),
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60,
		updateAge: 24 * 60 * 60,
	},
	pages: {
		signIn: "/login",
		error: "/error",
	},
	providers: [
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			allowDangerousEmailAccountLinking: true,
		}),
		Resend({
			apiKey: process.env.RESEND_API_KEY!,
			from: process.env.EMAIL_FROM!,
			server: process.env.NEXTAUTH_URL!,
			sendVerificationRequest: async ({ identifier: email, url, provider: { from } }) => {
				if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada")
				if (!email || !from) throw new Error("Email ou remetente não configurados")

				console.log("URL recebida:", url)
				
				try {
					const urlObj = new URL(url)
					console.log("URL params:", Object.fromEntries(urlObj.searchParams.entries()))
					
					const recaptchaToken = urlObj.searchParams.get("recaptchaToken")
					
					if (recaptchaToken) {
						console.log("Token reCAPTCHA encontrado, verificando...")
						
						try {
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
							
							console.log("Resposta reCAPTCHA:", recaptchaRes.data)
							
							if (!recaptchaRes.data.success) {
								console.error("Verificação do reCAPTCHA falhou")
								throw new Error("Verificação do reCAPTCHA falhou")
							}
						} catch (error) {
							console.error("Erro na verificação do reCAPTCHA:", error)
						}
					} else {
						console.log("AVISO: Token do reCAPTCHA não encontrado, mas prosseguindo...")
					}
					
					const { Resend } = await import("resend")
					const resend = new Resend(process.env.RESEND_API_KEY)
					
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
					
					console.log("Email enviado com sucesso para:", email)
				} catch (error) {
					console.error("Erro durante o processo:", error)
					throw new Error(`Erro ao processar a solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
				}
			},
		}),
	],
	callbacks: {
		async jwt({ token, user, trigger, session }) {
			if (user) {
				token.id = user.id

				const dbUser = await prisma.user.findUnique({
					where: { id: user.id },
					select: {
						id: true,
						name: true,
						email: true,
						sessionVersion: true,
					}
				})

				if (!dbUser) throw new Error("User not found")

				token.name = dbUser.name
				token.email = dbUser.email
				token.sessionVersion = dbUser.sessionVersion
	
				const membership = await prisma.user_Organization.findFirst({
					where: { user_id: user.id },
					include: { organization: true },
				})

				token.orgId = membership?.organization?.uniqueId ?? null
			} 
			else if (trigger === "update" && session) {
				if (session.name) token.name = session.name;
				
				if (token.id) {
					await prisma.user.update({
						where: { id: token.id as string },
						data: { sessionVersion: { increment: 1 } }
					});
					
					const updatedUser = await prisma.user.findUnique({
						where: { id: token.id as string },
						select: { sessionVersion: true, name: true }
					});
					
					if (updatedUser) {
						token.sessionVersion = updatedUser.sessionVersion;
						token.name = updatedUser.name;
						console.log("Token updated with new values:", { 
							name: token.name, 
							sessionVersion: token.sessionVersion 
						});
					}
				}
			}
			else if (token.id) {
				const dbUser = await prisma.user.findUnique({
					where: { id: token.id as string },
					select: {
						id: true,
						name: true,
						email: true,
						sessionVersion: true,
					}
				})

				if (!dbUser) return { ...token, error: "User not found" }

				token.name = dbUser.name;
				token.email = dbUser.email;
				
				if (token.sessionVersion !== dbUser.sessionVersion) {
					console.log("Session version mismatch, refreshing token data", {
						tokenVersion: token.sessionVersion,
						dbVersion: dbUser.sessionVersion
					});
					token.sessionVersion = dbUser.sessionVersion;
				}
			}
	
			return token
		},
		async session({ session, token }) {
			if (token.error) {
				return { expires: "", user: { name: "", email: "" } } as DefaultSession
			}

			session.user.id = token.id as string
			session.user.name = token.name as string | null
			session.user.email = token.email as string
			session.user.orgId = token.orgId as string | undefined
			session.user.sessionVersion = token.sessionVersion as number
			return session
		},
		async redirect({ baseUrl }) {
			return baseUrl
		},
		async signIn({ user, account }) {
			// Se o usuário já existe com este email, vincule a nova conta de provedor
			if (user.email) {
				const existingUser = await prisma.user.findUnique({
					where: { email: user.email },
					include: { accounts: true },
				});
				
				// Se o usuário existe e não tem uma conta com este provedor
				if (existingUser && account && !existingUser.accounts.some(a => a.provider === account.provider)) {
					console.log(`Vinculando conta ${account.provider} ao usuário existente com email ${user.email}`);
				}
			}
			
			return true;
		},
	},	
	events: {
		createUser: async ({ user }) => {
			if (!user?.id) throw new Error("User ID is required")
		},
		updateUser: async ({ user }) => {
			if (!user?.id) throw new Error("User ID is required")
			
			await prisma.user.update({
				where: { id: user.id },
				data: { sessionVersion: { increment: 1 } }
			});
			
			console.log("User updated, incremented session version for", user.id);
		},
		linkAccount: async ({ user, account }) => {
			if (!user?.id || !account) return
			
			console.log(`Conta ${account.provider} vinculada ao usuário ${user.id}`);
			
			// Atualizar a sessão para refletir a nova vinculação
			await prisma.user.update({
				where: { id: user.id },
				data: { sessionVersion: { increment: 1 } }
			});
		},
	},
	secret: process.env.AUTH_SECRET,
})
