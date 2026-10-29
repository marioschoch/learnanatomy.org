/** Project-wide constants. The project name lives in ./appName.ts, the donation link in ./donation.ts. */
export { APP_NAME } from './appName';
export { DONATION_URL, supportPath, THANKS_PATH } from './donation';

export const APP_REPO_URL = '';

/** Where the pipeline output is served from (relative to the site root). */
export const MODELS_BASE_URL = `${import.meta.env.BASE_URL}models/`;
