import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import axios from "axios";

export const authConfig: NextAuthConfig = {
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
        if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
        if (!email || !from) throw new Error("Email ou remetente não configurados");

        console.log("URL recebida:", url);
        
        try {
          const urlObj = new URL(url);
          console.log("URL params:", Object.fromEntries(urlObj.searchParams.entries()));
          
          const recaptchaToken = urlObj.searchParams.get("recaptchaToken");
          
          if (recaptchaToken) {
            console.log("Token reCAPTCHA encontrado, verificando...");
            
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
              );
              
              console.log("Resposta reCAPTCHA:", recaptchaRes.data);
              
              if (!recaptchaRes.data.success) {
                console.error("Verificação do reCAPTCHA falhou");
                throw new Error("Verificação do reCAPTCHA falhou");
              }
            } catch (error) {
              console.error("Erro na verificação do reCAPTCHA:", error);
            }
          } else {
            console.log("AVISO: Token do reCAPTCHA não encontrado, mas prosseguindo...");
          }
          
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          
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
          });
          
          console.log("Email enviado com sucesso para:", email);
        } catch (error) {
          console.error("Erro durante o processo:", error);
          throw new Error(`Erro ao processar a solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account }) {
      if (user.email) {
        console.log(`Tentativa de login com ${account?.provider} para o email ${user.email}`);
      }
      
      return true;
    },
    async redirect({ baseUrl }) {
      return baseUrl;
    },
  },
  secret: process.env.AUTH_SECRET,
}; 