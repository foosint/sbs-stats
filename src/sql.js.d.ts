// Minimal type declarations for sql.js loaded via CDN script tag
declare module "sql.js" {
  export interface QueryExecResult {
    columns: string[];
    values: Array<Array<string | number | null>>;
  }

  export interface Database {
    exec(sql: string): QueryExecResult[];
    close(): void;
  }
}
