import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // NOTE: PrismaAdapter removed intentionally — with JWT session strategy the adapter
  // is not required and its presence caused /api/auth/session to return 500 on
  // serverless cold starts when the DB connection is slow.
  session: {
    strategy: "jwt",
  },
  useSecureCookies: false, // Permitir cookies em HTTP para domínios que não sejam localhost (ex: sslip.io)
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "seu@email.com" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        console.log("[AUTH] Tentativa de login para:", credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] Credenciais faltantes");
          throw new Error("Credenciais inválidas");
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user) {
            console.log("[AUTH] Usuário não encontrado no DB");
            throw new Error("Usuário não encontrado.");
          }

          if ((user as any).status === "BLOCKED") {
            console.log("[AUTH] Usuário bloqueado");
            throw new Error("Sua conta foi bloqueada. Entre em contato com o suporte.");
          }

          if (user.password) {
            const isCorrectPassword = await bcrypt.compare(credentials.password, user.password);
            if (!isCorrectPassword) {
              console.log("[AUTH] Senha incorreta");
              throw new Error("Senha incorreta");
            }
          } else {
            console.log("[AUTH] Usuário sem senha cadastrada");
            throw new Error("Usuário sem senha definida");
          }

          console.log("[AUTH] Login bem-sucedido para:", user.email);
          return user;
        } catch (error: any) {
          if (error.message === "Usuário não encontrado." || 
              error.message === "Sua conta foi bloqueada. Entre em contato com o suporte." || 
              error.message === "Senha incorreta" || 
              error.message === "Usuário sem senha definida") {
            throw error;
          }
          console.error("[AUTH] Erro no banco de dados durante authorize:", error.message);
          throw new Error("Erro de conexão com o banco de dados.");
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = (user as any).id;
        token.role = (user as any).role;
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "europcar_secret_dev",
};
