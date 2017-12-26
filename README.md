# Introduction
基于ionic3与socket.io制作，可同时多终端多设备同时绘图或打字，根据url后roomID可实现分频道画图

## Getting Started
打开server文件夹，执行
```bash
$ node index.js
```
打开client文件夹，执行
```bash
$ ionic platform add browser
$ ionic cordova run browser
```
打开项目后，在url后面拼
```bash
?roomID=xxxxxx
```
即可实现不同房间绘图

```bash
client\src\component\canvas-draw\canvas-draw.ts下的server_url为服务端的URL，可自行修改
```