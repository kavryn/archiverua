/**
 * Get a parameter value from a wiki template.
 * Returns null if the param doesn't exist in the template.
 * Returns empty string if the param exists but has no value.
 */
export function getTemplateParam(content: string, paramName: string): string | null {
  const regex = new RegExp(`\\|[ \\t]*${paramName}[ \\t]*=[ \\t]*([^\\n]*)`);
  const match = content.match(regex);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Set a parameter value in a wiki template.
 * If the param already exists, its value is replaced.
 * If the param doesn't exist, it is added before the closing "}}" of the template.
 */
export function setTemplateParam(content: string, paramName: string, value: string): string {
  const regex = new RegExp(`\\|[ \\t]*${paramName}[ \\t]*=[ \\t]*[^\\n]*`);
  if (regex.test(content)) {
    return content.replace(regex, `| ${paramName} = ${value}`);
  }
  return content.replace(/\}\}/, ` | ${paramName} = ${value}\n}}`);
}
