import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JWT guard.
 *
 * The guard is global so that authentication is the default and forgetting it
 * on a new admin route fails closed. Every route that genuinely serves the
 * public site has to say so explicitly.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
