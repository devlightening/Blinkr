import { initI18n } from './index';

// Runs right after the theme boot (index.ts), before any screen module is evaluated: labels that are built once at
// module load (signal types, categories) are then already in the chosen language (plan-devam G1).
initI18n();
