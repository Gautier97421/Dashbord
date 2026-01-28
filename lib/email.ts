import emailjs from '@emailjs/browser'

export async function sendAuthEmail({ to, code, type }: { to: string, code: string, type: 'register' | 'login' }) {
  // Remplir ces valeurs dans .env ou directement ici
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || ''
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || ''
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || ''

  // Variables à injecter dans le template EmailJS
  const templateParams = {
    to_email: to,
    code,
    type,
    // Ajoutez d'autres variables si besoin
  }

  // Envoi de l'email
  return emailjs.send(serviceId, templateId, templateParams, publicKey)
}
