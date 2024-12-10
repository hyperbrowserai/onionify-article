declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY: string;
      HYPERBROWSER_API_KEY: string;
    }
  }
}
