import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

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
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
	
				const membership = await prisma.user_Organization.findFirst({
					where: { user_id: user.id },
					include: { organization: true },
				});
	
				if (membership?.organization?.uniqueId) {
					token.orgId = membership?.organization?.uniqueId ?? undefined;
				} else {
					token.orgId = null; // <- importante para indicar ausência de org
				}
			}
	
			return token;
		},
	
		async session({ session, token }) {
			session.user.id = token.id as string;
			session.user.orgId = token.orgId as string | undefined;
			return session;
		},
	
		async redirect({ baseUrl }) {
			return baseUrl;
		},
	},	
	events: {
		createUser: async ({ user }) => {
			console.log("Usuário criado:", user);
			if (!user.id) {
				throw new Error("User ID is required");
			}
		},
	},

	secret: process.env.AUTH_SECRET,
});
