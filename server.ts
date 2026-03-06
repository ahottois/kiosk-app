import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const PORT = 3000;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// S'assurer que le dossier des uploads existe
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir les fichiers statiques du dossier uploads
app.use('/uploads', express.static(uploadsDir));

// Configuration de la base de données
const db = new Database('playlist.db');

// --- INITIALISATION DES TABLES ---

db.exec(`
  CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    loop_playlist INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screen_id TEXT NOT NULL DEFAULT 'default',
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 10,
    order_index INTEGER NOT NULL DEFAULT 0,
    loop INTEGER DEFAULT 0,
    layout_config TEXT,
    FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE
  )
`);

// --- MIGRATION : AJOUT DES COLONNES SI ELLES N'EXISTENT PAS ---
// Cela évite les erreurs 500 sur les anciennes bases de données
try {
  db.prepare("ALTER TABLE screens ADD COLUMN loop_playlist INTEGER DEFAULT 1").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE playlist ADD COLUMN loop INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE playlist ADD COLUMN layout_config TEXT").run();
} catch (e) {}

// Initialisation de l'écran par défaut
db.prepare("INSERT OR IGNORE INTO screens (id) VALUES ('default')").run();

// --- CONFIGURATION MULTER (UPLOADS) ---

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } 
});

// --- ROUTES API ---

// Récupérer les écrans et le nombre de médias
app.get('/api/screens', (req, res) => {
  try {
    const screens = db.prepare(`
      SELECT s.id as screen_id, s.loop_playlist, COUNT(p.id) as item_count 
      FROM screens s
      LEFT JOIN playlist p ON s.id = p.screen_id
      GROUP BY s.id
    `).all();
    res.json(screens);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Créer un écran
app.post('/api/screens', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requis' });
    db.prepare("INSERT OR IGNORE INTO screens (id) VALUES (?)").run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Configurer le mode boucle de l'écran
app.post('/api/screens/config', (req, res) => {
  try {
    const { screenId, loopPlaylist } = req.body;
    db.prepare("UPDATE screens SET loop_playlist = ? WHERE id = ?")
      .run(loopPlaylist ? 1 : 0, screenId);
    
    io.to(screenId).emit('playlist_updated');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un écran
app.delete('/api/screens/:screenId', (req, res) => {
  try {
    const { screenId } = req.params;
    db.prepare('DELETE FROM screens WHERE id = ?').run(screenId);
    io.to(screenId).emit('reload_player');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer la playlist complète d'un écran
app.get('/api/playlist', (req, res) => {
  try {
    const screenId = req.query.screenId || 'default';
    const screenInfo = db.prepare("SELECT loop_playlist FROM screens WHERE id = ?").get(screenId) as any;
    const items = db.prepare('SELECT * FROM playlist WHERE screen_id = ? ORDER BY order_index ASC').all(screenId);
    
    res.json({
      items,
      config: {
        loop_playlist: screenInfo ? !!screenInfo.loop_playlist : true
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un média (Upload ou URL)
app.post('/api/playlist', upload.single('file'), (req, res) => {
  try {
    const { type, url, duration, screen_id, loop, layout_config } = req.body;
    const sid = screen_id || 'default';
    const finalUrl = req.file ? `/uploads/${req.file.filename}` : url;
    
    const stmt = db.prepare('INSERT INTO playlist (type, url, duration, screen_id, loop, layout_config) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(type, finalUrl, parseInt(duration) || 10, sid, loop === 'true' ? 1 : 0, layout_config || null);
    
    io.to(sid).emit('playlist_updated');
    res.json({ id: info.lastInsertRowid, url: finalUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un média + suppression du fichier physique
app.delete('/api/playlist/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT screen_id, url FROM playlist WHERE id = ?').get(req.params.id) as any;
    
    if (item) {
      if (item.url.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), item.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      db.prepare('DELETE FROM playlist WHERE id = ?').run(req.params.id);
      io.to(item.screen_id).emit('playlist_updated');
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Réorganiser l'ordre des médias
app.post('/api/playlist/reorder', (req, res) => {
  try {
    const { items, screenId } = req.body;
    const sid = screenId || 'default';
    const stmt = db.prepare('UPDATE playlist SET order_index = ? WHERE id = ?');
    
    const transaction = db.transaction((updates: any[]) => {
      for (const update of updates) {
        stmt.run(update.order_index, update.id);
      }
    });
    
    transaction(items);
    io.to(sid).emit('playlist_updated');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- GESTION DES WEBSOCKETS ---



io.on('connection', (socket) => {
  const screenId = socket.handshake.query.screenId as string || 'default';
  socket.join(screenId);

  socket.on('force_reload', (sid) => {
    io.to(sid || screenId).emit('reload_player');
  });

  socket.on('next_slide', (sid) => {
    io.to(sid || screenId).emit('next_slide');
  });
});

// --- DÉMARRAGE DU SERVEUR ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist/index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur Kiosk démarré sur http://localhost:${PORT}`);
  });
}

startServer();