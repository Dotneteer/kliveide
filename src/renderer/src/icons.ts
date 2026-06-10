export function getLocalIcons(): Record<string, string> {
  const icons: Record<string, string> = import.meta.glob("../../../icons/**/*.svg", {
    import: "default",
    eager: true,
    query: "?raw"
  });
  const processedIcons: Record<string, string> = {};

  Object.entries(icons).forEach(([key, value]) => {
    const iconName = key
      .split("/")
      .pop()
      ?.replace(/\.svg$/, "") ?? "";
    processedIcons[iconName] = value;
  });

  return processedIcons;
}
