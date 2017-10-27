const port = "8081";
const fs = require("fs");
const xssFilters = require('xss-filters');
const querystring = require('querystring');

const db = require(__dirname + '/_module/db.js').init(__dirname + "/db/sqlite.db");

const server = require("http").createServer();
server.on("request", function(req, res){
	//ルームの作成
	if(req.method == "POST"){
		if(req.url.indexOf("/create") === 0){
			//CORS
			res.writeHead(200, {
	    		'Content-Type':'application/json; charset=utf-8',
	    		'Access-Control-Allow-Origin':'http://localhost:8091',
	    		'Access-Control-Allow-Methods':'POST',
	    		'Access-Control-Allow-Headers':'*',
				"Content-Type": "text/plain"
			});

			//POSTを受け取る
			let data = "";
			req.on("data", function(chunk) {
				data += chunk;
			});
			req.on("end", function() {
				querystring.parse(data);

				let params = {};
				let values = data.split("&");
				values.forEach(function(v){
					let arr = v.split("=");
					params[arr[0]] = arr[1];
				});

				//新たなチャットルームを作成
				db.run("INSERT INTO chatroom(room_id) VALUES('" + params.roomId + "');", function(err, res){
					if (err) {
						console.error(err.message);
					//エラーがなければ新たにコネクト
					} else {
						connectChatRoom(params.roomId);
						//フロントに結果を返す
					}
				});

				//ここでPromiseを利用する？
				res.write("OK");
				res.end();
    		});
		}
	//ページの表示
	}else{
		let fileName;
		if(req.url.indexOf("/chat") === 0){
			fileName = "chat";
		}else{
			fileName = "index";
		}

		var stream = fs.createReadStream("template/" + fileName + ".html");
		res.writeHead(200, {"Content-Type":"text/html"});
		stream.pipe(res);
	}
});
server.listen(port);
console.log("create server : " + port);

const io = require("socket.io").listen(server);

// アプリ起動時、データベースに格納されているroomIdを元に接続を試みる
db.each("SELECT * FROM chatroom", [], function(err, res){
	connectChatRoom(res.room_id)
});

function connectChatRoom(roomId){
	// ユーザ管理ハッシュ
	var userHash = {};

	// Namespacesを利用する
	var chatNS = io.of('/chat/' + roomId);
	chatNS.on("connection", function(socket){

		// Room(Namespacesで分けた時、roomも利用した方が良いみたい)
		var roomName = "default";

		// WebSocketで接続の際にどのroomに参加するか？
		socket.join(roomName);

		// 接続開始のカスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
		socket.on("connected", function(name){
			userHash[socket.id] = name;
		});

		// メッセージ送信カスタムイベント
		socket.on("publish", function(data){

			//data.user_id;
			db.run("INSERT INTO message_table(room_id, user_id, content, send_date) VALUES('" + roomId + "', " + data.user_id + ", '" + data.value + "', '" + parseInt(Math.floor(new Date().getTime() / 1000)) + "');", function(err, res){
				if (err) {
					console.error(err.message);
				}
			});

			chatNS.to(roomName).emit("publish", {value:"[" + data.user_id + "さん]" + xssFilters.inHTMLData(data.value)});
		});

		let nowTyping = 0;
		socket.on("start typing", function(){
			if (nowTyping <= 0) {
				socket.to(roomName).emit("start typing", userHash[socket.id]);
			}

			nowTyping++;
			setTimeout(function(){
				nowTyping--;
				if (nowTyping <= 0) {
					socket.to(roomName).emit("stop typing");
				}
			}, 3000);
		});

		socket.on("stop typing", function(){
			nowTyping = 0;
			socket.broadcast.emit("stop typing");
		});

		// 接続終了組み込みイベント(接続元ユーザを削除し、他ユーザへ通知)
		socket.on("disconnect", function(){
			if(userHash[socket.id]){
				delete userHash[socket.id];
			}
		});
	});
}
