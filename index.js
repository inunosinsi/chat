const port = "8081";
const fs = require("fs");
const xssFilters = require('xss-filters');
const querystring = require('querystring');

//SOY Shop本体のデータベースを読み込む @ToDo MySQLに対応
const obj = JSON.parse(fs.readFileSync("config.json"));
//let database = require(__dirname + '/_module/db.js').init();

const sqlite3 = require('sqlite3').verbose();
let database = new sqlite3.Database(obj.sitedir + ".db/sqlite.db", function(err){
	if(err){
		console.error(err.message);
	}
});

const server = require("http").createServer();
server.on("request", function(req, res) {
    //ルームの作成
    if (req.method == "POST") {
        if (req.url.indexOf("/create") === 0) {
            //CORS
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': 'http://localhost:8091',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': '*',
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
                values.forEach(function(v) {
                    let arr = v.split("=");
                    params[arr[0]] = arr[1];
                });

				//新たなチャットルームを作成
				connectChatRoom(params.roomId);

                //ここでPromiseを利用する？
                res.write("OK");
                res.end();
            });
        }
        //ページの表示
    } else {
        let fileName;
        if (req.url.indexOf("/chat") === 0) {
            fileName = "chat";
        } else {
            fileName = "index";
        }

        var stream = fs.createReadStream("template/" + fileName + ".html");
        res.writeHead(200, {
            "Content-Type": "text/html"
        });
        stream.pipe(res);
    }
});
server.listen(port);
console.log("create server : " + port);

const io = require("socket.io").listen(server);

// アプリ起動時、データベースに格納されているroomIdを元に接続を試みる
database.each("SELECT room_token FROM bonbon_chatroom", [], function(err, res) {
	connectChatRoom(res.room_token);
});
database.close();
delete database;

function connectChatRoom(roomId) {
    // ユーザ管理ハッシュ
    var userHash = {};

    // Namespacesを利用する
    var chatNS = io.of('/chat/' + roomId);
	chatNS.on("connection", function(socket) {

        // Room(Namespacesで分けた時、roomも利用した方が良いみたい)
        var roomName = "default";

        // WebSocketで接続の際にどのroomに参加するか？
        socket.join(roomName);

        // 接続開始のカスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
        socket.on("connected", function(name) {
            userHash[socket.id] = name;
        });

        // メッセージ送信カスタムイベント
        socket.on("publish", function(data) {

			var db = new sqlite3.Database(obj.sitedir + ".chat/" + roomId + "/sqlite.db", function(err){
				if(err){
					console.error(err.message);
				}
			});

            //data.user_id;
            db.run("INSERT INTO message_table(user_id, content, send_date) VALUES(" + data.user_id + ", '" + data.value + "', '" + parseInt(Math.floor(new Date().getTime() / 1000)) + "');", function(err, res) {
                if (err) {
                    console.error(err.message);
                }
            });

			db.close();
			delete db;

            chatNS.to(roomName).emit("publish", {
				userId: data.user_id,
                value: xssFilters.inHTMLData(data.value)
            });
        });

        let nowTyping = 0;
        socket.on("start typing", function() {
            if (nowTyping <= 0) {
                socket.to(roomName).emit("start typing", userHash[socket.id]);
            }

            nowTyping++;
            setTimeout(function() {
                nowTyping--;
                if (nowTyping <= 0) {
                    socket.to(roomName).emit("stop typing");
                }
            }, 3000);
        });

        socket.on("stop typing", function() {
            nowTyping = 0;
            socket.broadcast.emit("stop typing");
        });

        // 接続終了組み込みイベント(接続元ユーザを削除し、他ユーザへ通知)
        socket.on("disconnect", function() {
            if (userHash[socket.id]) {
                delete userHash[socket.id];
            }
        });
    });
}
