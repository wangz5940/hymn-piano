FROM node:22-slim

WORKDIR /app

# 先拷贝依赖描述，利用 Docker 层缓存
COPY package.json package-lock.json ./
# 使用 pnpm 替代 npm，规避 npm 10.x 在 Docker BuildKit 中的 "Exit handler never called!" bug
# 锁定 pnpm@9：v10 会把 [ERR_PNPM_IGNORED_BUILDS] 当作致命错误（exit 1），
# 且不再读取 package.json 的 pnpm.onlyBuiltDependencies 字段；
# v9 仍读取该字段，且忽略构建脚本仅为警告，不会导致安装失败
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
# 显式允许 esbuild 运行构建脚本（下载原生二进制），vite build 依赖它
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.pnpm={onlyBuiltDependencies:['esbuild']}; fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n')"
RUN pnpm install --no-frozen-lockfile

# 拷贝项目源码、预生成数据、字体、脚本
COPY . .

# 确保 选本诗歌712/歌谱 是一个真实目录（本地 junction 在容器内可能变成符号链接）
# 直接从 dummy-non-existing-folder/歌谱 拷贝实际文件
RUN rm -rf 选本诗歌712 && \
    mkdir -p 选本诗歌712 && \
    cp -r dummy-non-existing-folder/歌谱 选本诗歌712/歌谱

# 直接调用 vite build，跳过 prebuild（generate:scores）。
# public/materials/hymns 和 src/data/hymns.generated.ts 已预生成。
RUN node node_modules/vite/bin/vite.js build

# 将字体复制到 dist/__simpmusic-fonts/，运行时作为静态文件提供
RUN mkdir -p dist/__simpmusic-fonts && \
    cp fonts/SimpMusicBase.ttf fonts/SimpMusicAccent.ttf dist/__simpmusic-fonts/

EXPOSE 5173

# vite preview 会加载 vite.config.ts，其中的 configurePreviewServer
# 会注册 /__simpmusic-fonts 中间件，从 fonts/ 目录读取字体文件
CMD ["node", "node_modules/vite/bin/vite.js", "preview", "--host", "0.0.0.0", "--port", "5173"]
