const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Setup Folder Upload
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Config Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- AUTH ---
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [exist] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (exist.length > 0) return res.status(400).json({ message: 'Username sudah dipakai' });

        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, 'user']);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: 'Error Server' }); }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (rows.length > 0) res.json({ success: true, user: rows[0] });
    else res.status(401).json({ success: false, message: 'Login gagal' });
});

// --- ADMIN ---
app.post('/admin/upload', upload.single('photo'), async (req, res) => {
    const { title, description, price } = req.body;
    const filename = req.file.filename;
    await db.query('INSERT INTO photos (title, description, filename, price) VALUES (?, ?, ?, ?)', 
        [title, description, filename, price]);
    res.json({ message: 'Sukses' });
});

app.get('/admin/photos', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM photos ORDER BY id DESC');
    res.json(rows);
});

app.put('/admin/photo/:id', async (req, res) => {
    const { title, description, price } = req.body;
    const { id } = req.params;
    await db.query('UPDATE photos SET title=?, description=?, price=? WHERE id=?', [title, description, price, id]);
    res.json({ success: true });
});

app.delete('/admin/photo/:id', async (req, res) => {
    const { id } = req.params;
    const [rows] = await db.query('SELECT filename FROM photos WHERE id = ?', [id]);
    if (rows.length > 0) {
        const filePath = path.join(uploadDir, rows[0].filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await db.query('DELETE FROM photos WHERE id = ?', [id]);
        res.json({ success: true });
    } else { res.status(404).json({ message: 'Not found' }); }
});

app.get('/admin/users', async (req, res) => {
    const [rows] = await db.query('SELECT id, username, role, created_at FROM users ORDER BY id DESC');
    res.json(rows);
});

// --- USER / PUBLIC ---
app.get('/photos', async (req, res) => {
    const [rows] = await db.query('SELECT id, title, description, price FROM photos');
    res.json(rows);
});

app.post('/transaction/buy', async (req, res) => {
    const { user_id, photo_id } = req.body;
    const apiKey = uuidv4();
    try {
        await db.query('INSERT INTO transactions (user_id, photo_id, api_key) VALUES (?, ?, ?)', [user_id, photo_id, apiKey]);
        res.json({ success: true, api_key: apiKey });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- SECURE API ---
app.get('/access/photo/:id', async (req, res) => {
    const photoId = req.params.id;
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) return res.status(403).json({ message: 'API Key Required' });

    const [check] = await db.query('SELECT * FROM transactions WHERE photo_id = ? AND api_key = ?', [photoId, apiKey]);
    if (check.length > 0) {
        const [photoData] = await db.query('SELECT filename FROM photos WHERE id = ?', [photoId]);
        if (photoData.length > 0) {
            res.sendFile(path.join(uploadDir, photoData[0].filename));
        } else { res.status(404).json({ message: 'File missing' }); }
    } else { res.status(403).json({ message: 'Invalid API Key' }); }
});

app.listen(3000, () => console.log('Server running on port 3000'));