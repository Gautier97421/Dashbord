/**
 * Lecture des factures jointes aux mails d'abonnement (PDF, HTML/texte, images de facture),
 * pour retrouver le prix et la date de prélèvement quand le mail lui-même ne les donne pas.
 */
import { extractText, getDocumentProxy } from 'unpdf';
import { htmlToText, type GmailAttachmentRef, type GmailClient } from '@/lib/gmail/client';
import { generateJSON } from '@/lib/ai/llm';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_EMAIL = 3;
const MAX_TEXT_LENGTH = 20000;
// Les images jointes sont souvent des logos : on ne lit que celles nommées comme une facture
const INVOICE_FILENAME = /factur|invoice|receipt|re[cç]u|quittance|ech[eé]ance|relev[eé]/i;

const isPdf = (a: GmailAttachmentRef) => a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.filename);
const isText = (a: GmailAttachmentRef) => a.mimeType.startsWith('text/') || /\.(html?|txt)$/i.test(a.filename);
const isInvoiceImage = (a: GmailAttachmentRef) => a.mimeType.startsWith('image/') && INVOICE_FILENAME.test(a.filename);

export async function pdfToText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join('\n') : text).slice(0, MAX_TEXT_LENGTH);
}

export interface InvoiceAttachments {
  // Texte des PDF et pièces jointes texte/HTML
  text: string;
  // Images de facture (base64), à lire avec le modèle de vision si le texte ne suffit pas
  images: string[];
}

export async function readInvoiceAttachments(
  gmail: GmailClient,
  messageId: string,
  attachments: GmailAttachmentRef[]
): Promise<InvoiceAttachments> {
  const usable = attachments
    .filter((a) => a.size <= MAX_ATTACHMENT_BYTES && (isPdf(a) || isText(a) || isInvoiceImage(a)))
    // Les PDF d'abord : c'est le format habituel des factures
    .sort((a, b) => Number(isPdf(b)) - Number(isPdf(a)))
    .slice(0, MAX_ATTACHMENTS_PER_EMAIL);

  const texts: string[] = [];
  const images: string[] = [];
  for (const attachment of usable) {
    try {
      const data = await gmail.getAttachment(messageId, attachment.attachmentId);
      if (isPdf(attachment)) texts.push(await pdfToText(new Uint8Array(data)));
      else if (isText(attachment)) texts.push(htmlToText(data.toString('utf8')).slice(0, MAX_TEXT_LENGTH));
      else images.push(data.toString('base64'));
    } catch (error) {
      console.error(`Could not read attachment ${attachment.filename}:`, error);
    }
  }
  return { text: texts.join('\n'), images };
}

const IMAGE_PROMPT = `Tu lis une facture ou un reçu photographié. Réponds en JSON :
- "total" : le montant total payé TTC, avec sa devise (ex: "29,99 €"), sinon "" ;
- "frequency" : "monthly", "yearly", "weekly" si c'est un abonnement dont la période est indiquée, sinon "" ;
- "next_billing_date" : la date du prochain prélèvement au format AAAA-MM-JJ si elle est indiquée, sinon "".`;

/**
 * Lit une image de facture avec le modèle de vision (Claude ou Ollama) et renvoie une phrase que
 * l'extraction de texte habituelle sait comprendre. Chaîne vide si rien n'est lisible
 * ou si l'IA est indisponible.
 */
export async function readInvoiceImage(base64: string): Promise<string> {
  try {
    const parsed = await generateJSON<{ total: string; frequency: string; next_billing_date: string }>({
      system: IMAGE_PROMPT,
      prompt: 'Lis cette facture.',
      images: [{ data: base64 }],
      // Pièce jointe d'un mail : jamais envoyée à un service externe sans AI_EMAIL_PROVIDER=claude
      purpose: 'email',
      timeoutMs: 60000,
      schema: {
        type: 'object',
        properties: { total: { type: 'string' }, frequency: { type: 'string' }, next_billing_date: { type: 'string' } },
        required: ['total', 'frequency', 'next_billing_date'],
        additionalProperties: false,
      },
    });
    const parts: string[] = [];
    if (parsed.total) parts.push(`Total TTC : ${parsed.total}`);
    if (parsed.frequency === 'monthly') parts.push('par mois');
    else if (parsed.frequency === 'yearly') parts.push('par an');
    else if (parsed.frequency === 'weekly') parts.push('par semaine');
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.next_billing_date || '')) parts.push(`Prochain prélèvement le ${parsed.next_billing_date}`);
    return parts.join('. ');
  } catch (error) {
    console.error('Could not read invoice image:', error);
    return '';
  }
}
