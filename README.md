# 诗琴

从钢琴基本功走到聚会诗歌服侍的本地优先学习平台。

## 运行

```bash
npm install
npm run dev
```

开发服务启动前会从 `选本诗歌712/歌谱` 生成曲库目录。

如需后台管理开发服务：

```bash
npm run dev:start
npm run dev:stop
npm run dev:restart
npm run dev:status
```

也可以使用对应短命令：`npm start`、`npm stop`、`npm restart`。后台日志写入 `logs/dev-server.log`。

## 验证

```bash
npm run check
npm run test:run
npm run build
npm run preview
```

## 功能

- 8 个阶段、48 周、每周 3 次的课程路径。
- 712 个编号、747 个歌谱版本的本地曲库。
- 歌谱缩放、旋转与全屏查看。
- 练习计时、节拍器、MIDI 设备状态与五项自评。
- 服侍曲单、调性/速度/起拍备注、连续聚会模拟。
- 收藏、进度、练习记录和曲单 JSON 备份。

## 数据与版权

学习数据只保存在当前浏览器，不上传音频、MIDI 原始事件或设备名称。

`选本诗歌712/歌谱` 的图片用于本地学习。公开部署或分发前，需要单独确认歌谱与具体版式的授权状态。`doc/` 中未经人工审核的 OMR/MusicXML 候选资源不得用于实时演奏判定。
