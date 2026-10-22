export const INPUT_TYPE = {
  TEXT: "text",
  PASSWORD: "password",
  EMAIL: "email",
  TEL: "tel",
} as const;

export type InputType = (typeof INPUT_TYPE)[keyof typeof INPUT_TYPE];
