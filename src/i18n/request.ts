import {getRequestConfig} from 'next-intl/server';

const locales = ['en', 'hi', 'ta'];

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale)) {
    locale = 'en';
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    onError(error) {
      if ((error.code as any) === 'MISSING_TRANSLATION') {
        console.warn(`[next-intl] Missing translation: ${error.message}`);
      } else {
        console.error(error);
      }
    },
    getMessageFallback({namespace, key}) {
      const path = [namespace, key].filter(Boolean).join('.');
      return process.env.NODE_ENV === 'development' 
        ? `⚠️ [MISSING: ${path}]` 
        : path;
    }
  };
});
