let sqlite3 = require('sqlite3').verbose();
let SQLiteObject = {
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
			console.error("DATABASE ERROR : " + err.message);
		}
	});
	return db;
}
