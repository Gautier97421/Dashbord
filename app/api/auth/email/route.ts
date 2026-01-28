// import { NextRequest, NextResponse } from "next/server"
// import { z } from "zod"
// import { sendAuthEmail } from "@/lib/email"

// const emailSchema = z.object({
//   email: z.string().email(),
//   type: z.enum(["register", "login"])
// })

// export async function POST(req: NextRequest) {
//   try {
//     const { email, type } = emailSchema.parse(await req.json())
//     const code = Math.floor(100000 + Math.random() * 900000).toString()
    
//     globalThis["emailCodes"] = globalThis["emailCodes"] || {}
//     globalThis["emailCodes"][email] = { code, expires: Date.now() + 10 * 60 * 1000 }

//     await sendAuthEmail({ to: email, code, type })

//     return NextResponse.json({ ok: true })
//   } catch (e) {
//     return NextResponse.json({ error: "Impossible d'envoyer le code" }, { status: 400 })
//   }
// }