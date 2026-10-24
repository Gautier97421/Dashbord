"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2 } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: "",
  })
  // Réglage du serveur : inscriptions fermées, ou réservées aux personnes qui ont le code d'invitation
  const [access, setAccess] = useState<{ open: boolean; inviteOnly: boolean }>({ open: true, inviteOnly: false })

  useEffect(() => {
    fetch("/api/auth/register")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setAccess({ open: data.open !== false, inviteOnly: data.inviteOnly === true }))
      .catch(() => {})
  }, [])
  const closed = !access.open

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess(false)

    // Vérifier que les mots de passe correspondent
    if (formData.password !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          ...(access.inviteOnly ? { inviteCode: formData.inviteCode } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue lors de l'inscription")
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push("/login")
        }, 2000)
      }
    } catch (error) {
      setError("Une erreur est survenue lors de l'inscription")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Inscription</CardTitle>
          <CardDescription className="text-center">
            Créez un compte pour commencer à utiliser DashLife
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {closed && (
              <Alert>
                <AlertDescription>Les inscriptions sont fermées sur ce serveur.</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Compte créé avec succès ! Redirection vers la connexion...
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                autoComplete="name"
                type="text"
                placeholder="Votre nom"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={isLoading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Pseudo</Label>
              <Input
                id="username"
                autoComplete="nickname"
                type="text"
                placeholder="ton_pseudo"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
                required
                pattern="[a-z0-9][a-z0-9._]{1,18}[a-z0-9]"
                title="3 à 20 caractères : lettres minuscules, chiffres, point et tiret bas"
                disabled={isLoading || success}
              />
              <p className="text-xs text-muted-foreground">Unique : tes amis te trouveront avec.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                autoComplete="username"
                type="email"
                placeholder="exemple@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                autoComplete="new-password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading || success}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                autoComplete="new-password"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={isLoading || success}
                minLength={8}
              />
            </div>
            {access.inviteOnly && (
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Code d&apos;invitation</Label>
                <Input
                  id="inviteCode"
                  autoComplete="off"
                  type="text"
                  value={formData.inviteCode}
                  onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
                  required
                  disabled={isLoading || success}
                />
                <p className="text-xs text-muted-foreground">Demande-le à la personne qui t&apos;a invité.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button type="submit" className="w-full" disabled={isLoading || success || closed}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              S'inscrire
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Vous avez déjà un compte ?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Se connecter
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
