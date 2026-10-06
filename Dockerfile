# The whole site, served by Caddy.
#
# There is no build stage: what is in this folder is what gets served. The
# image has no Node, no package manager and nothing to patch beyond Caddy
# itself — which is the point of the rewrite.
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv

# These three belong to the folder, not to the site: they describe how to
# serve it, so they must not be served.
RUN rm -f /srv/Dockerfile /srv/Caddyfile /srv/README.md /srv/.gitignore

EXPOSE 8080
