// I18n middleware placeholder to resolve dependencies
export interface I18nMiddlewareInterface {
  disabled: true;
}

export class I18nMiddleware implements I18nMiddlewareInterface {
  disabled = true as const;
  
  middleware() {
    throw new Error("I18n middleware disabled - missing dependencies");
  }
}

export const i18nMiddleware = new I18nMiddleware();
