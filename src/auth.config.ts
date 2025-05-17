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
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <h1 style="color: #2563eb; font-size: 24px; margin: 0 0 16px 0;">Seu link de acesso chegou!</h1>
                      <p style="font-size: 16px; color: #4b5563; margin: 0;">Solicitação de login para sua conta</p>
                      <p style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 8px 0 0 0;">Dog Inc.</p>
                    </div>

                    <div style="background-color: #f3f4f6; border-radius: 6px; padding: 24px; margin-bottom: 32px; text-align: center;">
                      <p style="margin: 0 0 24px 0; color: #4b5563;">Para acessar sua conta, clique no botão abaixo:</p>
                      <a href="${url}" 
                         style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Fazer Login
                      </a>
                    </div>

                    <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center;">
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Este link expira em 24 horas.</p>
                      <p style="color: #6b7280; font-size: 14px; margin: 0;">Se você não solicitou este email, pode ignorá-lo com segurança.</p>
                    </div>
                  </div>
                </body>
              </html>
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