interface ImportMetaEnv {
  NODE_ENV: string;
  // add other env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css";
