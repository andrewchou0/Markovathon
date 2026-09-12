export function readDemoMode(search) {
  return new URLSearchParams(search).get('demo') !== '0';
}

export function demoModeUrl(href, enabled) {
  const url = new URL(href);
  url.searchParams.set('demo', enabled ? '1' : '0');
  return `${url.pathname}${url.search}${url.hash}`;
}
