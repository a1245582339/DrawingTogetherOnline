var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var io = require('socket.io')(http);
var moment = require("moment");

app.use(bodyParser.json({
	limit: '50mb'
}));
app.use(bodyParser.urlencoded({
	limit: '50mb',
	extended: false
}));

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

app.all('/snapshot', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

app.post('/snapshot', function(req, res) {
	var filename = 'snapshot_' + moment().format('YYYYMMDDHHmmss') + '.jpg';
	var buf = new Buffer(req.body.imageData, 'base64');
	res.set('Content-Type', 'application/octet-stream');
	res.set('Content-Disposition', 'attachment; filename="' + filename + '"');
	res.status(200).send(buf);
});

var draw_history = [];
var text_history = [];

var roomInfo = {}
var roomID;
io.on('connection', function(socket) {

			socket.on("join", function(room_ID) {
				roomID = room_ID;
				user = socket.id;
				//暂且让user等于socket.id，用的时候再说
				if(!roomInfo[roomID]) {
					roomInfo[roomID] = [];
				}
				roomInfo[roomID].push(user);

				socket.join(roomID);
				io.to(roomID).emit(user + '加入了房间' + roomInfo[roomID]);
				console.log(user + '加入了' + roomID);
				console.log(roomInfo);

				for(let data of text_history) {
					var text = JSON.parse(data);
					var currnetRoomID = text.currnetRoomID;
					Object.keys(io.sockets.sockets).forEach(function(id) {
							if(roomInfo[currnetRoomID].indexOf(socket.id) != -1) {
								socket.emit('syncWriting', text);
							}
					});
			  };
						for(let data of draw_history) {
							var polyline = JSON.parse(data);
							var currnetRoomID = polyline.currnetRoomID;
							Object.keys(io.sockets.sockets).forEach(function(id) {
								if(roomInfo[currnetRoomID].indexOf(socket.id) != -1) {
									socket.emit('syncDrawing', polyline);

								}
							});
						}
					})

				console.log("A user connected: " + socket.id);

				socket.on('syncDrawing', function(data) {
					var polyline = JSON.parse(data);
					var currnetRoomID = polyline.currnetRoomID;
					draw_history.push(data);

					Object.keys(io.sockets.sockets).forEach(function(id) {
						if(roomInfo[currnetRoomID].indexOf(id) == -1) {
							return false;
						}
						if(id != socket.id) {
							io.to(id).emit('syncDrawing', polyline);
						}
					});
				});

				socket.on('syncWriting', function(data) {
					text_history.push(data);
					var text = JSON.parse(data);
					var currnetRoomID = text.currnetRoomID;
					Object.keys(io.sockets.sockets).forEach(function(id) {
						if(roomInfo[currnetRoomID].indexOf(id) == -1) {
							return false;
						}
						if(id != socket.id) {
							io.to(id).emit('syncWriting', text);
						}
					});
				});

				socket.on('delete', function(data) {
					text_history = [];
					draw_history = [];
					var del = JSON.parse(data);
					var currnetRoomID = del.currnetRoomID;
					Object.keys(io.sockets.sockets).forEach(function(id) {
						if(roomInfo[currnetRoomID].indexOf(id) == -1) {
							return false;
						}
						if(id != socket.id) {
							io.to(id).emit('delete', data);
						}
					});
				});

				socket.on('disconnect', function() {
					console.log("A user leave: " + socket.id);
				});
			});

			http.listen(3000, function() {
				console.log('Server listening on port 3000');
			});