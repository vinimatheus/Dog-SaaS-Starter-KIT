import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import Resend from "next-auth/providers/resend";
import { DefaultSession } from "next-auth";

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
				if (!process.env.RESEND_API_KEY) {
					throw new Error("RESEND_API_KEY não configurada");
				}

				if (!email || !from) {
					throw new Error("Email ou remetente não configurados");
				}

				const { Resend } = await import("resend");
				const resend = new Resend(process.env.RESEND_API_KEY);

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
								<!-- Gmail Filter Metadata -->
								<div style="display: none; max-height: 0px; overflow: hidden;">
									Dog Inc Login Link
									<!-- Gmail Filter: label:Login -->
									<!-- Gmail Filter: label:Dog Inc -->
								</div>
								<!-- End Gmail Filter Metadata -->

								<h1 style="color: #333;">Bem-vindo ao Dog Inc.</h1>
								<p>Clique no link abaixo para fazer login:</p>
								<a href="${url}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
									Fazer Login
								</a>
								<p style="color: #666; font-size: 14px;">
									Se você não solicitou este email, pode ignorá-lo com segurança.
								</p>
								<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
								<p style="color: #999; font-size: 12px; text-align: center;">
									Este é um email automático. Por favor, não responda.
									<br />
									Para cancelar o recebimento destes emails, <a href="mailto:${from}?subject=unsubscribe" style="color: #666;">clique aqui</a>.
								</p>
							</div>
						`,
					});
				} catch {
					throw new Error("Erro ao enviar email de verificação");
				}
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			
			if (user) {
				token.id = user.id;
				
				
				const dbUser = await prisma.user.findUnique({
					where: { id: user.id }
				});

				if (!dbUser) {
					throw new Error("User not found");
				}
				
				
				const updatedUser = await prisma.user.update({
					where: { id: user.id },
					data: { sessionVersion: dbUser.sessionVersion + 1 }
				});
				
				
				token.sessionVersion = updatedUser.sessionVersion;
				
				
				const membership = await prisma.user_Organization.findFirst({
					where: { user_id: user.id },
					include: { organization: true },
				});
	
				if (membership?.organization?.uniqueId) {
					token.orgId = membership?.organization?.uniqueId ?? undefined;
				} else {
					token.orgId = null; 
				}
			} else if (token.id) {
				
				const dbUser = await prisma.user.findUnique({
					where: { id: token.id as string }
				});
				
				if (!dbUser) {
					
					return { ...token, error: "User not found" };
				}
				
				
				
				if (token.sessionVersion !== dbUser.sessionVersion) {
					
					return { ...token, error: "Session invalidated" };
				}
			}
	
			return token;
		},
	
		async session({ session, token }) {
			if (token.error) {
				
				return { expires: "", user: { name: "", email: "" } } as DefaultSession;
			}
			
			session.user.id = token.id as string;
			session.user.orgId = token.orgId as string | undefined;
			session.user.sessionVersion = token.sessionVersion as number;
			return session;
		},
	
		async redirect({ baseUrl }) {
			return baseUrl;
		},
	},	
	events: {
		createUser: async (params) => {
			const { user } = params;
			
			if (!user || !user.id) {
				throw new Error("User ID is required");
			}
		},
	},

	secret: process.env.AUTH_SECRET,
});
