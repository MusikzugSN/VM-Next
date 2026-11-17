import * as z from 'zod';
import { idSchema } from './ids.schema';

/** Path parameters, named like the `:param` segments in `routes.ts`. */
export const scoreParamsSchema = z.object({ scoreId: idSchema });
export const sheetParamsSchema = z.object({ sheetId: idSchema });
export const folderParamsSchema = z.object({ folderId: idSchema });
export const eventParamsSchema = z.object({ eventId: idSchema });
export const tagParamsSchema = z.object({ tagId: idSchema });
export const uploadParamsSchema = z.object({ uploadId: idSchema });
export const fieldParamsSchema = z.object({ fieldId: idSchema });
export const voiceParamsSchema = z.object({ voiceId: idSchema });
export const instrumentParamsSchema = z.object({ instrumentId: idSchema });
export const userParamsSchema = z.object({ userId: idSchema });
export const ensembleParamsSchema = z.object({ ensembleId: idSchema });
export const roleParamsSchema = z.object({ roleId: idSchema });
