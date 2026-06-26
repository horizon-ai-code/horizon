import { useTheme } from "next-themes";
import { useMounted } from "./useMounted";

export function useIsDark(fallback = true): boolean {
  const mounted = useMounted();
  const { resolvedTheme } = useTheme();
  return mounted ? resolvedTheme === "dark" : fallback;
}
