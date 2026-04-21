import { useMediaQuery } from "./useMediaQuery";

export function usePrefersDarkMode({ defaultValue = false } = {}) {
  return useMediaQuery("(prefers-color-scheme: dark)", { defaultValue });
}

