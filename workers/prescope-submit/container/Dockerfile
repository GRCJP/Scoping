# linux/amd64 — Cloudflare Containers requirement.
# Build context MUST be the repo root (src/lib + docs/emass):
#   docker build -f workers/prescope-submit/container/Dockerfile -t prescope-fill .
# Wrangler: image = "./container/Dockerfile" and image_build_context = "../.."
FROM node:22-bookworm-slim
WORKDIR /app

COPY workers/prescope-submit/container/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts \
  && npm cache clean --force

# Keep import paths the same as the repo (handler → src/lib/emass-xlsx.ts).
# Never copy CMMC_Level2_AssessmentResults_Template.xlsx — that filename is the
# Cover stub (gitignored). Official AR bytes come from the Worker POST body.
COPY src/lib ./src/lib
COPY docs/emass/CMMC-L2-Pre-Assessment-Form-v3.9.xlsx docs/emass/Required-Data-OSC.xlsx docs/emass/README.md ./docs/emass/
COPY workers/prescope-submit/src/auth.ts ./workers/prescope-submit/src/auth.ts
COPY workers/prescope-submit/container/handler.ts ./workers/prescope-submit/container/handler.ts
COPY workers/prescope-submit/container/server.ts ./workers/prescope-submit/container/server.ts

ENV HOST=0.0.0.0
ENV PORT=8788
ENV EMASS_TEMPLATE_ROOT=/app
ENV FILL_CONCURRENCY=1
ENV EMASS_ALLOW_ASSESSMENT_RESULTS_STUB=0
EXPOSE 8788

USER node
CMD ["node", "--experimental-strip-types", "workers/prescope-submit/container/server.ts"]
