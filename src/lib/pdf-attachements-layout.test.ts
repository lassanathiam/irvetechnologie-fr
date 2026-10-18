import { expect, it } from "bun:test";
import { dimensionsPageAttachement } from "./pdf-attachements-layout";

it("un attachement long tient intégralement sur une page A4", () => {
  const page = dimensionsPageAttachement(1520, 3200);
  expect(page.height).toEqual(277);
  expect(page.y + page.height).toEqual(287);
  expect(Number(page.width.toFixed(3))).toEqual(131.575);
  expect(Number(page.x.toFixed(4))).toEqual(39.2125);
});