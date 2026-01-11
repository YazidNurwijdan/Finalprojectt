const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    database: 'db_photo_market',
    port: 3306
});

module.exports = db.promise();