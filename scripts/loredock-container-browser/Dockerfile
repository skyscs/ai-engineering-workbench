FROM docker.io/library/python@sha256:db5942d111df72110e7a67da3fc5159e83ac85cd24808b91bdc4769e166ed1b7
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libdbus-1-3 \
    libcups2 libexpat1 libxcb1 libxkbcommon0 libasound2 libgbm1 libx11-6 libxext6 \
    libcairo2 libpango-1.0-0 libudev1 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libatspi2.0-0 libstdc++6 fonts-liberation \
    && dpkg-query -W -f='${Package}\t${Version}\t${Architecture}\n' > /dependency-versions.tsv \
    && rm -rf /var/lib/apt/lists/*
RUN groupadd -g 1000 aew && useradd -u 1000 -g 1000 -d /evidence/owner/run/home -M aew \
    && rmdir /tmp && ln -s /evidence/owner/run/tmp /tmp
COPY --chown=1000:1000 chrome/ /opt/chrome/
COPY node /opt/node/node
COPY workbench/ /opt/workbench/
RUN chmod 0775 /opt/chrome && chown 1000:1000 /opt/chrome \
    && python3 --version && /opt/node/node --version \
    && ldd /opt/chrome/chrome > /browser-libraries.txt \
    && ldd /opt/node/node > /node-libraries.txt \
    && python3 -I -S -B /opt/workbench/scripts/loredock-container-browser/image-inventory.py
USER 1000:1000
WORKDIR /opt/workbench
RUN /opt/node/node scripts/loredock-container-browser/verify-inputs.mjs
