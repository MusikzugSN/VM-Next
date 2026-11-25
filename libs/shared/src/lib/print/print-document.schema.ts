import { printQuerySchema } from './print-plan.schema';

/**
 * GET print/document – print-ready PDF (D-1): A4 portrait, pages scaled to fit inside the margins,
 * order as in the plan, blank pages for duplex. `application/pdf`, `Content-Disposition: inline`,
 * file name `Druck – <Mappe|Event|Titel> – <Stimme>.pdf`.
 * The browser prints it itself (D-2) or posts it to the local print service (D-3).
 */
export const PRINT_MAX_PAGES = 500;

export const printDocumentQuerySchema = printQuerySchema;
