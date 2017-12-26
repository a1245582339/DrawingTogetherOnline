## CoDraw
A simple cross-platform drawing apps with collaborative drawing. Make use
of [ionic3](http://ionicframework.com/docs/) and socket.io. The Android version can be find [here](https://github.com/wcweng68/collaborativeDrawing-Android)

## Functionaliies
1. Perform free drawing
2. Insert text
3. Change drawing/text color
4. Change pen width/text size
5. Undo & Redo
6. Save to local storage
7. Perform collaborative drawing

## Getting Started
### Client side
To enable collaborative drawing, please go to
"./src/components/canvas-draw/canvas-draw.ts" sync() to edit the server address (your IP address)

With the Ionic CLI, execute one of the following command to launch the app according to the platform (broswer, ios, android)

```bash
$ ionic serve
$ ionic cordova run ios
$ ionic cordova run android
```
### Server side
1. Download the node.js server [here](https://github.com/wcweng68/co-draw-nodejs-ionic3)

2. Run the following command to start the server
```bash
$ node index.js
```

## Screenshoot
<img src="https://i.imgur.com/CE2AuBm.png " width="300" height="450" />