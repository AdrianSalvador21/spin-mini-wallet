export const INPUT_TYPE = {
  TEXT: "text",
  PASSWORD: "password",
  EMAIL: "email",
  TEL: "tel",
} as const;

export type InputType = (typeof INPUT_TYPE)[keyof typeof INPUT_TYPE];

export const INPUT_MODE = {
  TEXT: "text",
  TEL: "tel",
  EMAIL: "email",
} as const;

export type InputMode = (typeof INPUT_MODE)[keyof typeof INPUT_MODE];

export const AUTO_COMPLETE = {
  NAME: "name",
  TEL_NATIONAL: "tel-national",
  EMAIL: "email",
  CURRENT_PASSWORD: "current-password",
  NEW_PASSWORD: "new-password",
} as const;

export type AutoComplete = (typeof AUTO_COMPLETE)[keyof typeof AUTO_COMPLETE];
