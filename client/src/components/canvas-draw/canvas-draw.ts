import { Polyline } from './../../app/model/polyline.model';
import { Component, ViewChild, Renderer } from '@angular/core';
import { AlertController, Platform } from 'ionic-angular';
import { Base64ToGallery } from '@ionic-native/base64-to-gallery';
import { ToastController } from 'ionic-angular';
import { AndroidPermissions } from '@ionic-native/android-permissions';
import * as io from 'socket.io-client';

@Component({
	selector: 'canvas-draw',
	templateUrl: 'canvas-draw.html'
})
export class CanvasDraw {

	@ViewChild('myCanvas') canvas: any;
	width: number;
	height: number;

	canvasElement: any;
	lastX: number;
	lastY: number;
	canDraw: boolean = true;
	canErase: boolean = false;
	mouseDraw: boolean = false;
	gesture: boolean = true;

	socket: any

	currentColor: string = 'black';
	currentSize: string = 'medium';
	brushSize: number = 10;
	textSize: number = 35;

	isDrawing: boolean = false;
	tempPolyline: Polyline;
	isErasing: boolean = false;
	history: Polyline[] = [];
	redoHistiry: Polyline[] = [];
	historyIndex = 0;

	textHistory = [];
	redoTextHistory = [];
	c
	textHistoryIndex = 0;

	actions = [];
	redoActions = [];

	isOnline = true;
	server_url = "localhost:3000";
	roomID;
	constructor(public platform: Platform, public renderer: Renderer, public alertCtrl: AlertController, private base64ToGallery: Base64ToGallery, private toastCtrl: ToastController, private androidPermissions: AndroidPermissions) {

		this.width = platform.width()
		this.height = platform.height()

		if(this.platform.is('android')) {
			this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE).then(
				success => console.log('Permission granted'),
				err => this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
			);

			this.androidPermissions.requestPermissions([this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE, this.androidPermissions.PERMISSION.GET_ACCOUNTS]);
		}

	}

	ngAfterViewInit() {

		//如果进入就连接状态,直接执行下面这段代码
		this.socket = io(this.server_url);

		this.roomID = this.GetQueryString("roomID");
		this.socket.emit("join", this.roomID)

		this.socket.on('syncDrawing', (hist) => {
			this.draw(hist.p_x * this.width, hist.p_y * this.height, hist.c_x * this.width, hist.c_y * this.height, hist.b_s, hist.c_c);
		});
		this.socket.on('syncWriting', (hist) => {
			let ctx = this.canvasElement.getContext('2d');
			ctx.font = hist.font;
			ctx.fillStyle = hist.color;
			ctx.fillText(hist.text, hist.x * this.width, hist.y * this.height);
		});
		this.socket.on('delete', (data) => {
			this.clearCanvas();
		});

		this.canvasElement = this.canvas.nativeElement;
		//if the device supports gesture events
		this.gesture = ('ontouchstart' in this.canvasElement.__proto__);

		this.renderer.setElementAttribute(this.canvasElement, 'width', this.platform.width() + '');
		this.renderer.setElementAttribute(this.canvasElement, 'height', this.platform.height() + '');
		this.clearCanvas();
	}
	GetQueryString(name) {
		var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
		var r = window.location.search.substr(1).match(reg);
		if(r != null) {
			return r[2];
		}
		return null;
	}
	handleMouseDown(ev) {
		this.mouseDraw = true;
		this.handleStart({
			touches: [{
				pageX: ev.pageX,
				pageY: ev.pageY
			}]
		})
	}

	handleStart(ev) {
		this.lastX = ev.touches[0].pageX;
		this.lastY = ev.touches[0].pageY;
	}

	handleMouseMove(currentX, currentY) {
		if(this.mouseDraw) {
			this.handleMove(currentX, currentY);
		}
		if(currentX <= 0 || currentY <= 0 || currentX >= this.width || currentY >= this.height) {
			this.handleMouseUp();
		}
	}

	handleMove(currentX, currentY) {
		if(this.canDraw) {
			if(this.isDrawing) {
				this.tempPolyline.points.push({
					x: currentX,
					y: currentY
				});
			} else {
				this.tempPolyline = new Polyline(this.currentColor, this.brushSize);
				this.tempPolyline.points.push({
					x: this.lastX,
					y: this.lastY
				});
				this.isDrawing = true;
			}
			this.draw(this.lastX, this.lastY, currentX, currentY, this.brushSize, this.currentColor);
			if(this.isOnline) {
				this.sendDrawing(this.lastX, this.lastY, currentX, currentY);
			}
		} else if(this.canErase) {
			if(this.isErasing) {
				this.tempPolyline.points.push({
					x: currentX,
					y: currentY
				});
			} else {
				this.tempPolyline = new Polyline(this.currentColor, this.brushSize);
				this.tempPolyline.points.push({
					x: this.lastX,
					y: this.lastY
				});
				this.isErasing = true;
			}
			this.draw(this.lastX, this.lastY, currentX, currentY, this.brushSize, "white");
			if(this.isOnline) {
				this.sendErasing(this.lastX, this.lastY, currentX, currentY);
			}
		}

		this.lastX = currentX;
		this.lastY = currentY;
	}

	handleMouseUp() {
		this.mouseDraw = false;
		this.handleStop();
	}
	
	
	handleStop() {
		if(this.isDrawing) {
			this.history.push(this.tempPolyline);
			this.isDrawing = false;
			this.historyIndex++;
			this.actions.push('draw');

			this.redoActions = [];
			this.redoHistiry = [];
			this.redoTextHistory = [];
		}

		if(!this.canDraw && !this.canErase) {
			this.onAddText();
		}

	}
	
	handleDrawingLeave() {
		this.mouseDraw = false;
		if(this.isDrawing) {
			this.history.push(this.tempPolyline);
			this.isDrawing = false;
			this.historyIndex++;
			this.actions.push('draw');

			this.redoActions = [];
			this.redoHistiry = [];
			this.redoTextHistory = [];
		}
	}//画画的时候鼠标离开画板区域,停止绘画
	
	draw(p_x, p_y, c_x, c_y, b_s, c_c) {
		let ctx = this.canvasElement.getContext('2d');
		ctx.beginPath();
		ctx.lineJoin = "round";
		ctx.moveTo(p_x, p_y);
		ctx.lineTo(c_x, c_y);
		ctx.closePath();
		ctx.strokeStyle = c_c;
		ctx.lineWidth = b_s;
		ctx.stroke();
	}

	changeColor(Color) {
		this.currentColor = Color;
	}

	changeSize(size) {
		if(size == 'small') {
			this.brushSize = 5;
			this.textSize = 20;
		} else if(size == 'medium') {
			this.brushSize = 10;
			this.textSize = 35;
		} else {
			this.brushSize = 20;
			this.textSize = 70;
		}
	}

	clearCanvas() {
		let ctx = this.canvasElement.getContext('2d');
		ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
		this.history = [];
		this.redoHistiry = [];
		this.historyIndex = 0;

		this.textHistory = [];
		this.redoHistiry = [];
		this.textHistoryIndex = 0;
	}

	delete() {
		let hist={
			currnetRoomID: this.GetQueryString("roomID")
		}
		if(this.isOnline) {
			this.socket.emit('delete', JSON.stringify(hist));
		}
		this.clearCanvas();
	}

	sendDrawing(p_x, p_y, c_x, c_y) {
		let hist = {
			p_x: p_x / this.width,
			p_y: p_y / this.height,
			c_x: c_x / this.width,
			c_y: c_y / this.height,
			b_s: this.brushSize,
			c_c: this.currentColor,
			currnetRoomID: this.GetQueryString("roomID")
		};
		this.socket.emit('syncDrawing', JSON.stringify(hist));
	}

	sendErasing(p_x, p_y, c_x, c_y) {
		let hist = {
			p_x: p_x / this.width,
			p_y: p_y / this.height,
			c_x: c_x / this.width,
			c_y: c_y / this.height,
			b_s: this.brushSize,
			c_c: "white",
			currnetRoomID: this.GetQueryString("roomID")
		};
		this.socket.emit('syncDrawing', JSON.stringify(hist));
	}

	sendWriting(text: string) {
		let hist = {
			text: text,
			x: this.lastX / this.width,
			y: this.lastY / this.height,
			color: this.currentColor,
			font: this.textSize + "px Comic Sans MS",
			currnetRoomID: this.GetQueryString("roomID")
		};
		this.socket.emit('syncWriting', JSON.stringify(hist));
	}

	onAddText() {
		let ctx = this.canvasElement.getContext('2d');
		ctx.font = this.textSize + "px Comic Sans MS";
		ctx.fillStyle = this.currentColor;

		let prompt = this.alertCtrl.create({
			title: 'Add Text',
			message: "Enter the text you want to add",
			inputs: [{
				name: 'text',
				placeholder: 'Text'
			}, ],
			buttons: [{
					text: 'Cancel',
					handler: data => {}
				},
				{
					text: 'Add',
					handler: data => {
						if(this.isOnline) {
							this.sendWriting(data.text);
						}
						ctx.fillText(data.text, this.lastX, this.lastY);
						this.textHistory.push({
							text: data.text,
							x: this.lastX,
							y: this.lastY,
							color: this.currentColor,
							font: this.textSize + "px Comic Sans MS"
						});
						this.textHistoryIndex++;
						this.actions.push('write');
					}
				}
			]
		});
		prompt.present();
	}

	onDisableDraw() {
		this.canDraw = false;
		this.canErase = false;
	}

	onEnableDraw() {
		this.canDraw = true;
		this.canErase = false;
	}

	onEnableErase() {
		this.canDraw = false;
		this.canErase = true;
	}

	onSelectColor() {
		let alert = this.alertCtrl.create();
		alert.setTitle('Select Color');

		alert.addInput({
			type: 'radio',
			label: 'Red',
			value: 'red',
			checked: this.currentColor == 'red' ? true : false
		});
		alert.addInput({
			type: 'radio',
			label: 'Orange',
			value: 'orange',
			checked: this.currentColor == 'orange' ? true : false
		});
		alert.addInput({
			type: 'radio',
			label: 'Blue',
			value: 'blue',
			checked: this.currentColor == 'blue' ? true : false
		});
		alert.addInput({
			type: 'radio',
			label: 'Green',
			value: 'green',
			checked: this.currentColor == 'green' ? true : false
		});
		alert.addInput({
			type: 'radio',
			label: 'Black',
			value: 'black',
			checked: this.currentColor == 'black' ? true : false
		});
		alert.addInput({
			type: 'radio',
			label: 'White',
			value: 'white',
			checked: this.currentColor == 'white' ? true : false
		});

		alert.addButton('Cancel');
		alert.addButton({
			text: 'Ok',
			handler: data => {
				this.changeColor(data);
			}
		});

		alert.present();

	}

	onSelectSize() {
		let alert = this.alertCtrl.create();
		alert.setTitle('Set Pen Size');

		alert.addInput({
			type: 'radio',
			label: 'Small',
			value: 'small',
			checked: this.currentSize == 'small' ? true : false
		});
		alert.addInput({
			type: 'radio',
			label: 'Medium',
			value: 'medium',
			checked: this.currentSize == 'medium' ? true : false
		});
		alert.addInput({
			type: 'radio',
			label: 'Large',
			value: 'large',
			checked: this.currentSize == 'large' ? true : false
		});

		alert.addButton('Cancel');
		alert.addButton({
			text: 'Ok',
			handler: data => {
				this.changeSize(data);
			}
		});

		alert.present();

	}

	drawAllHistory() {
		for(let polyline of this.history) {
			let startX = polyline.points[0].x;
			let startY = polyline.points[0].y;
			for(let point of polyline.points) {
				this.draw(startX, startY, point.x, point.y, polyline.width, polyline.color);
				startX = point.x;
				startY = point.y;
			}
		}
	}

	drawAllTextHistory() {
		for(let writing of this.textHistory) {
			let ctx = this.canvasElement.getContext('2d');
			ctx.font = writing.font;
			ctx.fillStyle = writing.color;
			ctx.fillText(writing.text, writing.x, writing.y);
		}
	}

	undo() {
		if(this.isOnline) {
			return;
		}
		if(this.actions.length == 0) {
			return;
		}
		let tempAction = this.actions.pop();
		this.redoActions.push(tempAction);
		if(tempAction == 'write') {
			if(this.textHistory.length > 0) {
				this.redoTextHistory.push(this.textHistory.pop());
				this.textHistoryIndex--;
			}
		} else {
			if(this.history.length > 0) {
				this.redoHistiry.push(this.history.pop());
				this.historyIndex--;
			}
		}

		let ctx = this.canvasElement.getContext('2d');
		ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
		this.drawAllTextHistory();
		this.drawAllHistory();

	}

	redo() {
		if(this.isOnline) {
			return;
		}
		if(this.redoActions.length == 0) {
			return;
		}
		let tempAction = this.redoActions.pop();
		this.actions.push(tempAction);
		if(tempAction == 'draw') {
			if(this.redoHistiry.length > 0) {
				this.history.push(this.redoHistiry.pop());
				for(var i = this.historyIndex; i < this.history.length; i++) {
					let polyline = this.history[i];
					let startX = polyline.points[0].x;
					let startY = polyline.points[0].y;
					for(let point of polyline.points) {
						this.draw(startX, startY, point.x, point.y, polyline.width, polyline.color);
						startX = point.x;
						startY = point.y;
					}
				}
				this.historyIndex++;
			}
		} else {
			if(this.redoTextHistory.length > 0) {
				this.textHistory.push(this.redoTextHistory.pop());
				for(var j = this.textHistoryIndex; j < this.textHistory.length; j++) {
					let writing = this.textHistory[j];
					let ctx = this.canvasElement.getContext('2d');
					ctx.font = writing.font;
					ctx.fillStyle = writing.color;
					ctx.fillText(writing.text, writing.x, writing.y);
				}
				this.textHistoryIndex++;
			}
		}
	}

	sync() {
		if(!this.isOnline) {
			this.clearCanvas();
			this.socket = io(this.server_url);

			this.socket.on('syncDrawing', (hist) => {
				this.draw(hist.p_x * this.width, hist.p_y * this.height, hist.c_x * this.width, hist.c_y * this.height, hist.b_s, hist.c_c);
			});
			this.socket.on('syncWriting', (hist) => {
				let ctx = this.canvasElement.getContext('2d');
				ctx.font = hist.font;
				ctx.fillStyle = hist.color;
				ctx.fillText(hist.text, hist.x * this.width, hist.y * this.height);
			});
			this.socket.on('delete', (data) => {
				this.clearCanvas();
			});
			this.isOnline = true;
		} else {
			this.socket.disconnect();
			this.isOnline = false;
		}
	}

	saveToGallery() {
		const image = this.canvasElement.toDataURL('image/jpeg', 0.5);

		let b64 = image.substring(22);
		var server_form = document.createElement("form");
		document.body.appendChild(server_form);
		server_form.setAttribute("method", "post");
		server_form.setAttribute("action", this.server_url + "/snapshot");
		server_form.setAttribute("target", "_blank");

		var server_input = document.createElement("input");
		server_form.appendChild(server_input);
		server_input.setAttribute("name", "imageData");
		server_input.setAttribute("value", b64);
		server_form.submit()

		//		const image = this.canvasElement.toDataURL();
		//
		//  let save_data = image.replace(/image\/png/, "image/octet-stream");
		//  let save_link = document.createElement('a');
		//  save_link.setAttribute('href', save_data);
		//  let d = new Date();
		//  let filename = 'drawing_' + [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), '.png'].join('');
		//  save_link.setAttribute('download', filename);
		//  save_link.click();
		//  只有火狐谷歌支持,并且本地

	}
}