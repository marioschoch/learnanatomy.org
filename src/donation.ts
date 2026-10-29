/**
 * Donations. Change the Stripe Payment Link here only: every donate button uses DONATION_URL. Free of Vite-only
 * code, so the build (seo/) can import it.
 */
export const DONATION_URL = 'https://buy.stripe.com/6oUcN5clIfza0c88y5aMU00';

/** Page that explains what donations pay for (seo/render.ts). "Support" links go here, never straight to Stripe. */
export const supportPath = (lang: 'en' | 'de') => (lang === 'de' ? '/de/support' : '/support');

/** Where Stripe sends people after paying (set as the Payment Link's success URL in the Stripe dashboard). */
export const THANKS_PATH = '/thanks';
