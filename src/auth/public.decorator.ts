import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from './auth.constants';

/**
 * Opens a route (or a whole controller) to everyone. Without it `AdminGuard`
 * requires the admin token, so a new route is closed until it is opened here.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
