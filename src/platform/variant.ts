import Constants from 'expo-constants';

/** The app variant from app.config.ts (`extra.appVariant`): 'development' or 'preview'. */
export const appVariant: string | undefined = Constants.expoConfig?.extra?.appVariant;

export const isDevelopment = appVariant === 'development';
