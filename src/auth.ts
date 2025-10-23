import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import { prisma } from "@/lib/prisma"
import type { DefaultSession } from "next-auth"
import { authConfig } from "./auth.config"

export const {
	handlers,
	signIn,
	signOut,
	auth,
	unstable_update,
} = NextAuth({
	...authConfig,
	adapter: PrismaAdapter(prisma),
	callbacks: {
		...authConfig.callbacks,
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
					include: { 
						organization: {
							select: {
								id: true,
								name: true,
								uniqueId: true,
								plan: true,
							}
						} 
					},
				})

				if (membership?.organization) {
					token.orgId = membership.organization.uniqueId
					token.orgName = membership.organization.name
					token.orgPlan = membership.organization.plan
					token.orgRole = membership.role
				}
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
						if (process.env.NODE_ENV === 'development') {
							console.log("Token updated with new values:", { 
								name: token.name, 
								sessionVersion: token.sessionVersion 
							});
						}
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
					if (process.env.NODE_ENV === 'development') {
						console.log("Session version mismatch, refreshing token data", {
							tokenVersion: token.sessionVersion,
							dbVersion: dbUser.sessionVersion
						});
					}
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
			
			if (process.env.NODE_ENV === 'development') {
				console.log("User updated, incremented session version for", user.id);
			}
		},
		linkAccount: async ({ user, account }) => {
			if (!user?.id || !account) return
			
			if (process.env.NODE_ENV === 'development') {
				console.log(`Conta ${account.provider} vinculada ao usuário ${user.id}`);
			}
			
			await prisma.user.update({
				where: { id: user.id },
				data: { sessionVersion: { increment: 1 } }
			});
		},
		async signOut(message) {
			if ('token' in message && message.token?.id) {
				delete message.token.orgId;
				delete message.token.orgName;
				delete message.token.orgPlan;
				delete message.token.orgRole;
			}
		}
	},
	secret: process.env.AUTH_SECRET,
})
