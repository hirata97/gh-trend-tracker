# GitHub Trend Tracker Development Container
FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    vim \
    bash \
    python3 \
    python3-pip \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Wrangler CLI (Cloudflare Workers)
RUN npm install -g wrangler

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install uv (Python package manager for Serena)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && cp -r /root/.local /tmp/.local-backup

# Add sudo for node user (for Claude Code)
RUN apt-get update \
    && apt-get install -y sudo \
    && echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /home/node/.local /home/node/.claude /home/node/.serena \
    && cp -r /tmp/.local-backup/* /home/node/.local/ \
    && chown -R node:node /home/node

ENV PATH="/home/node/.local/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --silent && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs

# Symlink for docker-entrypoint.sh (VS Code Dev Container compatibility)
RUN ln -sf /usr/local/bin/docker-entrypoint.sh /usr/bin/docker-entrypoint.sh 2>/dev/null || true

# Expose ports (Wrangler: 8787, Astro: 4321)
EXPOSE 8787 4321

# Keep container running (for VS Code Dev Container)
CMD ["sleep", "infinity"]
