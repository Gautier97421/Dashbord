import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./prisma"
import { clearAttempts, clientIp, isRateLimited, recordAttempt } from "./rate-limit"

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES_PER_ACCOUNT = 5
const MAX_FAILURES_PER_IP = 30
// Empreinte d'un mot de passe aléatoire : comparée quand le compte n'existe pas, pour que la réponse
// prenne le même temps (sinon sa rapidité révélerait les adresses sans compte)
const DUMMY_PASSWORD_HASH = "$2a$10$cu5/qSC4K3SgEZ1D5E39qus0Zo0Gsl2ETVDRUUHKudiNU8HOGO0mq"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email et mot de passe requis")
        }

        // Anti-force brute : trop d'échecs pour ce compte ou depuis cette adresse IP
        const emailKey = `login:email:${credentials.email.trim().toLowerCase()}`
        const ipKey = `login:ip:${clientIp(req?.headers)}`
        if (
          isRateLimited(emailKey, MAX_FAILURES_PER_ACCOUNT, LOGIN_WINDOW_MS) ||
          isRateLimited(ipKey, MAX_FAILURES_PER_IP, LOGIN_WINDOW_MS)
        ) {
          throw new Error("Trop de tentatives de connexion. Réessaie dans 15 minutes.")
        }

        // Adresse insensible à la casse (« Prenom@… » = « prenom@… »)
        const user = await prisma.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: "insensitive" } },
        })

        // Même message que le compte existe ou non : on ne révèle pas quelles adresses ont un compte
        const isPasswordValid = await compare(credentials.password, user?.password ?? DUMMY_PASSWORD_HASH)
        if (!user || !isPasswordValid) {
          recordAttempt(emailKey, LOGIN_WINDOW_MS)
          recordAttempt(ipKey, LOGIN_WINDOW_MS)
          throw new Error("Email ou mot de passe incorrect")
        }
        clearAttempts(emailKey)

        return {
          id: user.id,
          email: user.email,
          name: user.name || "",
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
