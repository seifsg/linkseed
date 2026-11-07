import { FORM_FIELDS } from '../config.ts';

/** Raw issue-form answers. Empty string means "not given"; validation decides what is wrong. */
export interface Fields {
  name: string;
  url: string;
  tagline: string;
  description: string;
  category: string;
  agree: boolean;
}

/**
 * Reads a GitHub issue-form body (`### <label>` then the answer) into fields.
 * Unknown headings are ignored; a body in any other shape yields empty fields, which validation rejects.
 */
export function parse(body: string | null | undefined): Fields {
  const f: Fields = { name: '', url: '', tagline: '', description: '', category: '', agree: false };
  for (const chunk of `\n${(body ?? '').replace(/\r\n?/g, '\n')}`.split(/\n### /).slice(1)) {
    const nl = chunk.indexOf('\n');
    const key = FORM_FIELDS[(nl < 0 ? chunk : chunk.slice(0, nl)).trim()];
    const value = nl < 0 ? '' : chunk.slice(nl + 1).trim();
    if (key === 'agree') f.agree = /^- \[x\] /im.test(value);
    else if (key) f[key] = value === '_No response_' ? '' : value;
  }
  return f;
}
