export const getItemFromStore = (
  key: string,
  defaultValue?: string | boolean,
  store = localStorage
) => {
  try {
    return store.getItem(key) === null ? defaultValue : JSON.parse(store.getItem(key) as string);
  } catch {
    return store.getItem(key) || defaultValue;
  }
};

export const setItemToStore = (key: string, payload: string | object, store = localStorage) => {
  const value = typeof payload === 'string' ? payload : JSON.stringify(payload);
  store.setItem(key, value);
};

export const removeItemFromStore = (key: string, store = localStorage) => store.removeItem(key);

export const currencyFormat = (
  amount: number,
  locale: Intl.LocalesArgument = 'en-US',
  options: Intl.NumberFormatOptions = {}
) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'usd',
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
};

export const getCurrencySymbol = (currency: string, locale: Intl.LocalesArgument = 'en-US') => {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  })
    .formatToParts(0)
    .find((x) => x.type === 'currency');
  return parts ? parts.value : '$';
};

const hexToRgbChannel = (hexColor: string): string => {
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);

  return `${r} ${g} ${b}`;
};

type ColorPalette = Record<string, string | undefined>;

type PaletteWithChannels<T extends ColorPalette> = T & {
  [K in keyof T as `${string & K}Channel`]: string;
} & {
  [K in keyof T as K extends number ? `${K}Channel` : never]: string;
};

export const generatePaletteChannel = <T extends ColorPalette>(
  palette: T
): PaletteWithChannels<T> => {
  const channels: Record<string, string | undefined> = {};

  Object.entries(palette).forEach(([colorName, colorValue]) => {
    if (colorValue) {
      channels[`${colorName}Channel`] = hexToRgbChannel(colorValue);
    }
  });

  return { ...palette, ...channels } as PaletteWithChannels<T>;
};

export const cssVarRgba = (color: string, alpha: number) => {
  return `rgba(${color} / ${alpha})`;
};
