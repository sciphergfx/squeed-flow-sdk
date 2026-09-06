import type { FormSchema } from "../../src/core/forms";

export const schema: FormSchema = {
  DeliveryConfig: {
    kind: "object",
    properties: {
      message: { type: { kind: "string" }, optional: false },
      enabled: { type: { kind: "boolean" }, optional: false },
    },
  },
};
