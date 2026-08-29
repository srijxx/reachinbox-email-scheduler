import Papa from 'papaparse';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export interface ParseResult {
  valid: string[];
  invalid: string[];
  total: number;
}

/**
 * Parses a CSV or TXT file and extracts unique valid email addresses.
 * Supports:
 *   - One email per line (TXT)
 *   - CSV with emails in any column
 *   - CSV with header rows (PapaParse handles these)
 */
export async function parseEmailFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete(results: Papa.ParseResult<string[]>) {
        const seen = new Set<string>();
        const valid: string[] = [];
        const invalid: string[] = [];

        for (const row of results.data) {
          // Each row is an array of values; scan all columns
          const cells = Array.isArray(row) ? row : [row as unknown as string];
          for (const cell of cells) {
            const candidates = String(cell).split(/[\s,;]+/);
            for (const candidate of candidates) {
              const trimmed = candidate.trim().toLowerCase();
              if (!trimmed) continue;
              if (seen.has(trimmed)) continue;
              seen.add(trimmed);
              if (isValidEmail(trimmed)) {
                valid.push(trimmed);
              } else if (trimmed.includes('@')) {
                // Looks like it was intended as an email but is invalid
                invalid.push(trimmed);
              }
            }
          }
        }

        resolve({ valid, invalid, total: valid.length + invalid.length });
      },
      error(err: Error) {
        reject(new Error(`CSV parse error: ${err.message}`));
      },
    });
  });
}
