import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marque une route comme ne nécessitant pas de JwtAuthGuard (ex: login, refresh, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
