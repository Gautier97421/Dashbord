import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit"
import { normalizeUsername } from "@/lib/social"
import { sameSecret } from "@/lib/webhook-token"

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(200, "Mot de passe trop long"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(100),
  username: z.string().max(40).optional(),
  inviteCode: z.string().max(200).optional(),
})

const REGISTER_WINDOW_MS = 60 * 60 * 1000
const MAX_REGISTRATIONS_PER_IP = 5

// Inscriptions : ouvertes, fermées (ALLOW_REGISTRATION=false) ou sur invitation (REGISTRATION_INVITE_CODE :
// seuls ceux à qui tu donnes le code peuvent créer un compte, par exemple tes amis)
const registrationOpen = () => process.env.ALLOW_REGISTRATION !== "false"
const inviteCode = () => process.env.REGISTRATION_INVITE_CODE?.trim() || ""

// GET : la page d'inscription adapte son formulaire (fermé, code demandé)
export async function GET() {
  return NextResponse.json({ open: registrationOpen(), inviteOnly: !!inviteCode() })
}

export async function POST(req: NextRequest) {
  if (!registrationOpen()) {
    return NextResponse.json({ error: "Les inscriptions sont fermées." }, { status: 403 })
  }
  const ipKey = `register:ip:${clientIp(req.headers)}`
  if (isRateLimited(ipKey, MAX_REGISTRATIONS_PER_IP, REGISTER_WINDOW_MS)) {
    return NextResponse.json({ error: "Trop d'inscriptions depuis cette connexion. Réessaie plus tard." }, { status: 429 })
  }

  try {
    const body = await req.json()
    
    // Validation
    const validatedData = registerSchema.parse(body)

    if (inviteCode() && !sameSecret(validatedData.inviteCode?.trim(), inviteCode())) {
      // Un mauvais code compte comme une tentative : pas d'essais en série
      recordAttempt(ipKey, REGISTER_WINDOW_MS)
      return NextResponse.json({ error: "Code d'invitation incorrect" }, { status: 403 })
    }
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: validatedData.email, mode: "insensitive" } },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      )
    }

    // Pseudo facultatif ici (il peut être choisi plus tard dans Social ou les paramètres)
    let username: string | null = null
    if (validatedData.username?.trim()) {
      username = normalizeUsername(validatedData.username)
      if (!username) {
        return NextResponse.json({ error: "Pseudo invalide : 3 à 20 caractères (lettres, chiffres, . et _)" }, { status: 400 })
      }
      if (await prisma.user.findUnique({ where: { username } })) {
        return NextResponse.json({ error: "Ce pseudo est déjà pris" }, { status: 400 })
      }
    }

    recordAttempt(ipKey, REGISTER_WINDOW_MS)

    // Hasher le mot de passe
    const hashedPassword = await hash(validatedData.password, 10)

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        username,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        user,
        message: "Utilisateur créé avec succès",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Données invalides" },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'inscription" },
      { status: 500 }
    )
  }
}
