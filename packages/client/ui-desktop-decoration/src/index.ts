/**
 * Desktop decoration settings surface, node half. The empty apply exists so
 * the plugin appears in the host cordis.yml / Loader; the browser half owns
 * the settings row through exports["./client"].
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
