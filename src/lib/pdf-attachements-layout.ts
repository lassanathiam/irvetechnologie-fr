export function dimensionsPageAttachement(width: number, height: number) {
  const scale = Math.min(190 / width, 277 / height);
  return { x: (210 - width * scale) / 2, y: 10, width: width * scale, height: height * scale };
}