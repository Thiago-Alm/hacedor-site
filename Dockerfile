# The whole site, served by Caddy.
#
# There is no build stage: what is in this folder is what gets served. The
# image has no Node, no package manager and nothing to patch beyond Caddy
# itself — which is the point of the rewrite.
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv

# These belong to the folder, not to the site: they describe how to serve
# it and how it is checked, so none of them is served.
RUN rm -rf /srv/Dockerfile /srv/Caddyfile /srv/README.md /srv/.gitignore /srv/.gitattributes /srv/NOTAS.md /srv/.github

EXPOSE 8080
