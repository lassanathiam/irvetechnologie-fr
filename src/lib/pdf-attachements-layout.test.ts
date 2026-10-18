import { expect, test } from "bun:test";
import { dimensionsPageAttachement } from "./pdf-attachements-layout";

test("un attachement long tient intégralement sur une page A4", () => {
  const page = dimensionsPageAttachement(1520, 3200);
  expect(page.height).toBe(277);
  expect(page.y + page.height).toBe(287);
  expect(page.width).toBeCloseTo(131.575);
  expect(page.x).toBeCloseTo(39.2125);
});