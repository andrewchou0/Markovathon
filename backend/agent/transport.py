"""The stdlib transport must not route local requests through proxies or redirects."""

import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        raise urllib.error.HTTPError(request.full_url, code, "Redirects are disabled for local services", headers, fp)


def urlopen(request, *, timeout):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    return opener.open(request, timeout=timeout)
