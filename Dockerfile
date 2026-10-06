# The site, served by Caddy. This is the alternative to Cloudflare: same
# folder, another host, without touching a line of the site.
#
# There is no build stage: what is in site/ is what gets served. The image
# has no Node, no package manager and nothing to patch beyond Caddy itself
# — which is the point of the rewrite.
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile

# site/ goes in, and nothing else. What lives outside it describes how the
# site is published — this file, the worker, the notes, the checks — and by
# being outside it cannot be published by accident.
COPY site/ /srv/

# Cloudflare reads this file instead of being told the headers by a server,
# so here it means nothing and is not handed to anyone.
RUN rm -f /srv/_headers

EXPOSE 8080
