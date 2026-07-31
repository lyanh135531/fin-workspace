import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoneyInput } from "@/components/base/money-input";

describe("MoneyInput", () => {
  it("displays a formatted amount but submits the raw decimal value", () => {
    const html = renderToStaticMarkup(
      <MoneyInput
        name="unitPrice"
        value="10000000"
        onValueChange={() => undefined}
      />,
    );

    expect(html).toContain('value="10.000.000"');
    expect(html).toMatch(
      /type="hidden"[^>]*name="unitPrice"[^>]*value="10000000"/,
    );
    expect(html.match(/name="unitPrice"/g)).toHaveLength(1);
  });
});
