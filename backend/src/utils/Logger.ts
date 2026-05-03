/**
 * Logger utility
 */

export class Logger {
  private static readonly levels: Record<string, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  private level: number;

  constructor(levelName: string = "info") {
    this.level = Logger.levels[levelName.toLowerCase()] ?? 2;
  }

  private log(levelName: string, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const levelNum = Logger.levels[levelName];

    if (levelNum <= this.level) {
      const output = data
        ? `[${timestamp}] ${levelName.toUpperCase()}: ${message} ${JSON.stringify(
            data
          )}`
        : `[${timestamp}] ${levelName.toUpperCase()}: ${message}`;

      if (levelName === "error") {
        console.error(output);
      } else if (levelName === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }
}
