// React i18n placeholder to resolve dependencies
export interface ReactI18nInterface {
  disabled: true;
}

export class ReactI18n implements ReactI18nInterface {
  disabled = true as const;
  
  Provider() {
    throw new Error("React i18n disabled - missing dependencies");
  }
  
  useTranslation() {
    throw new Error("React i18n disabled - missing dependencies");
  }
}

export const reactI18n = new ReactI18n();
