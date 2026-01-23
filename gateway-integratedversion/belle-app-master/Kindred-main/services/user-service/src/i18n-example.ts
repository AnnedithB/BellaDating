// I18n example placeholder to resolve dependencies
export interface I18nExampleInterface {
  disabled: true;
}

export class I18nExample implements I18nExampleInterface {
  disabled = true as const;
  
  startServer() {
    throw new Error("I18n example disabled - missing dependencies");
  }
}

export const i18nExample = new I18nExample();
