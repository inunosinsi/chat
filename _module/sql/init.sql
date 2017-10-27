CREATE TABLE message_table (
	id INTEGER PRIMARY KEY,
	room_id VARCHAR(256) NOT NULL,
	user_id INTEGER NOT NULL,
	content TEXT,
	send_date INTEGER NOT NULL
);
