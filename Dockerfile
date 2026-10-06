# The whole site, served by Caddy.
#
# There is no build stage: what is in this folder is what gets served. The
# image has no Node, no package manager and nothing to patch beyond Caddy
# itself — which is the point of the rewrite.
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile

# Only the site goes in, named piece by piece.
#
# `COPY . /srv` would be shorter, and then everything that is not the site
# — the git history, the deployment files, the notes — would have to be
# deleted again afterwards by a list somebody has to remember to update.
# Forgetting a line there publishes a file; forgetting a line here makes a
# file 404, which is noticed immediately and leaks nothing.
#
# The check in .github keeps this list honest: it fails if the pages ask
# for a file that is not copied here.
COPY index.html faq.html 404.html /srv/
COPY robots.txt sitemap.xml manifest.webmanifest /srv/
COPY favicon.ico icon.png apple-icon.png /srv/
COPY opengraph-image.jpg twitter-image.jpg /srv/
COPY css/ /srv/css/
COPY js/ /srv/js/
COPY fonts/ /srv/fonts/
COPY brand/ /srv/brand/
COPY icons/ /srv/icons/
COPY team/ /srv/team/
COPY video/ /srv/video/

EXPOSE 8080
