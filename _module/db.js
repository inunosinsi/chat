const sqlite3 = require('sqlite3').verbose();
const SQLiteObject = {
	init : function(file){
		return new sqlite3.Database(file, function(err){
			if(err){
				console.error(err.message);
			}
		});
	}
}

module.exports.init = function(file) {
	let db = SQLiteObject.init(file);

	db.run("SELECT * FROM message_table", function(err, res){
		if(err){
			db.run(require("fs").readFileSync(__dirname + "/sql/init.sql").toString(), function(err){
				if (err) {
					console.error("CREATE ERROR : " + err.message);
				}
			});
		}
	});

	db.run("SELECT * FROM chatroom", function(err, res){
		if(err){
			db.run(require("fs").readFileSync(__dirname + "/sql/room.sql").toString(), function(err){
				if (err) {
					console.error("CREATE ERROR : " + err.message);
				} else {
					["hoge", "huga", "test"].forEach(function(roomId){
						db.run("INSERT INTO chatroom(room_id) VALUES('" + roomId + "');", function(err, res){
							if (err) {
								console.error(err.message);
							}
						});
					});
				}
			});
		}
	});

	return db;
}
