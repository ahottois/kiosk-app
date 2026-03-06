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

db.exec(`
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

db.exec(`
  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )
`);

// Populate ingredients if empty
const count = db.prepare('SELECT COUNT(*) as count FROM ingredients').get() as { count: number };
if (count.count === 0) {
  const commonIngredients = [
    'Ail', 'Oignon', 'Échalote', 'Persil', 'Ciboulette', 'Basilic', 'Coriandre', 'Thym', 'Romarin', 'Laurier',
    'Sel', 'Poivre', 'Sucre', 'Farine', 'Beurre', 'Huile d\'olive', 'Huile de tournesol', 'Vinaigre', 'Moutarde', 'Mayonnaise',
    'Œuf', 'Lait', 'Crème fraîche', 'Yaourt', 'Fromage', 'Emmental', 'Parmesan', 'Mozzarella', 'Chèvre', 'Camembert',
    'Pomme de terre', 'Carotte', 'Courgette', 'Aubergine', 'Poivron', 'Tomate', 'Haricot vert', 'Petit pois', 'Épinard', 'Salade',
    'Champignon', 'Poireau', 'Chou-fleur', 'Brocoli', 'Asperge', 'Artichaut', 'Céleri', 'Radis', 'Concombre', 'Betterave',
    'Poulet', 'Bœuf', 'Porc', 'Agneau', 'Veau', 'Canard', 'Dinde', 'Lardon', 'Jambon', 'Saucisse',
    'Saumon', 'Thon', 'Cabillaud', 'Crevette', 'Moule', 'Huître', 'Saint-Jacques', 'Sardine', 'Truite', 'Colin',
    'Pomme', 'Poire', 'Banane', 'Orange', 'Citron', 'Fraise', 'Framboise', 'Cerise', 'Abricot', 'Pêche',
    'Riz', 'Pâtes', 'Semoule', 'Quinoa', 'Lentille', 'Pois chiche', 'Haricot rouge', 'Boulgour', 'Maïs', 'Pain',
    'Chocolat', 'Miel', 'Confiture', 'Vanille', 'Cannelle', 'Gingembre', 'Curry', 'Paprika', 'Cumin', 'Noix de muscade',
    'Amande', 'Noisette', 'Noix', 'Pistache', 'Pignon de pin', 'Sésame', 'Graine de courge', 'Graine de tournesol', 'Chia', 'Lin',
    'Vin blanc', 'Vin rouge', 'Bière', 'Cidre', 'Rhum', 'Cognac', 'Liqueur', 'Café', 'Thé', 'Infusion',
    'Bouillon de bœuf', 'Bouillon de volaille', 'Bouillon de légumes', 'Fond de veau', 'Sauce soja', 'Sauce tomate', 'Pesto', 'Tapenade', 'Houmous', 'Guacamole',
    'Aneth', 'Cerfeuil', 'Estragon', 'Menthe', 'Sauge', 'Origan', 'Piment', 'Safran', 'Curcuma', 'Cardamome',
    'Ananas', 'Mangue', 'Kiwi', 'Melon', 'Pastèque', 'Raisin', 'Prune', 'Figue', 'Datte', 'Noix de coco',
    'Lotte', 'Bar', 'Dorade', 'Sole', 'Turbot', 'Raie', 'Gambas', 'Langoustine', 'Crabe', 'Homard',
    'Bacon', 'Chorizo', 'Salami', 'Pancetta', 'Coppa', 'Mortadelle', 'Foie gras', 'Magret', 'Gésier', 'Rillettes',
    'Roquefort', 'Brie', 'Comté', 'Beaufort', 'Reblochon', 'Maroilles', 'Munster', 'Gorgonzola', 'Feta', 'Ricotta',
    'Chou rouge', 'Chou vert', 'Chou de Bruxelles', 'Chou frisé', 'Endive', 'Fenouil', 'Navet', 'Panais', 'Topinambour', 'Patate douce',
    'Lentille corail', 'Pois cassé', 'Fève', 'Soja', 'Tofu', 'Seitan', 'Tempeh', 'Lait d\'amande', 'Lait de soja', 'Lait de coco',
    'Sirop d\'érable', 'Sirop d\'agave', 'Cassonade', 'Sucre glace', 'Levure chimique', 'Levure de boulanger', 'Bicarbonate', 'Fécule de maïs', 'Gélatine', 'Agar-agar',
    'Câpre', 'Cornichon', 'Olive verte', 'Olive noire', 'Anchois', 'Truffe', 'Morille', 'Cèpe', 'Girolle', 'Pleurote',
    'Noix de pécan', 'Noix de cajou', 'Noix du Brésil', 'Macadamia', 'Cranberry', 'Baie de goji', 'Myrtille', 'Mûre', 'Groseille', 'Cassis',
    'Ketchup', 'Harissa', 'Wasabi', 'Tahini', 'Miso', 'Nuoc-mâm', 'Worcestershire', 'Tabasco', 'Sriracha', 'Barbecue',
    'Mascarpone', 'Faisselle', 'St Moret', 'Philadelphia', 'Vache qui rit', 'Kiri', 'Babybel', 'Cheddar', 'Gouda', 'Mimolette',
    'Radis noir', 'Céleri-rave', 'Rutabaga', 'Crosne', 'Salsifis', 'Blette', 'Cardon', 'Ortie', 'Pissenlit', 'Pourpier',
    'Caille', 'Perdreau', 'Faisan', 'Lièvre', 'Sanglier', 'Chevreuil', 'Biche', 'Cerf', 'Kangourou', 'Autruche',
    'Grenouille', 'Escargot', 'Poulpe', 'Calamar', 'Seiche', 'Encornet', 'Oursin', 'Palourde', 'Coque', 'Couteau',
    'Wasabi', 'Yuzu', 'Kombu', 'Wakame', 'Nori', 'Shiitake', 'Enoki', 'Shimeji', 'Daikon', 'Edamame',
    'Graine de pavot', 'Graine de nigelle', 'Graine de fenouil', 'Graine de coriandre', 'Graine de cumin', 'Graine de moutarde', 'Graine de carvi', 'Graine d\'anis', 'Graine de cardamome', 'Graine de céleri',
    'Piment d\'Espelette', 'Piment oiseau', 'Piment de Cayenne', 'Piment jalapeño', 'Piment habanero', 'Piment chipotle', 'Poivre de Sichuan', 'Poivre rose', 'Poivre blanc', 'Poivre vert',
    'Fleur de sel', 'Sel de Guérande', 'Sel rose de l\'Himalaya', 'Sel noir d\'Hawaï', 'Sel fumé', 'Sel de céleri', 'Sel de truffe', 'Gros sel', 'Sel fin', 'Sel de mer',
    'Huile de sésame', 'Huile de noix', 'Huile de noisette', 'Huile d\'avocat', 'Huile de pépins de raisin', 'Huile de colza', 'Huile de coco', 'Huile de lin', 'Huile de truffe', 'Huile de piment',
    'Vinaigre balsamique', 'Vinaigre de cidre', 'Vinaigre de vin rouge', 'Vinaigre de vin blanc', 'Vinaigre de riz', 'Vinaigre de framboise', 'Vinaigre de xérès', 'Vinaigre d\'alcool', 'Vinaigre de malt', 'Vinaigre de miel'
  ];
  const insert = db.prepare('INSERT INTO ingredients (name) VALUES (?)');
  const transaction = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });
  transaction(commonIngredients);
}

// --- ROUTES API INGREDIENTS ---

app.get('/api/ingredients', (req, res) => {
  try {
    const q = req.query.q as string;
    let ingredients;
    if (q) {
      ingredients = db.prepare('SELECT * FROM ingredients WHERE name LIKE ? LIMIT 20').all(`%${q}%`);
    } else {
      ingredients = db.prepare('SELECT * FROM ingredients ORDER BY name ASC LIMIT 50').all();
    }
    res.json(ingredients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ingredients', (req, res) => {
  try {
    const { name } = req.body;
    const stmt = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
    const info = stmt.run(name);
    const id = info.changes > 0 ? info.lastInsertRowid : (db.prepare('SELECT id FROM ingredients WHERE name = ?').get(name) as any).id;
    res.json({ id, name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES API MENUS ---

app.get('/api/menus', (req, res) => {
  try {
    const menus = db.prepare('SELECT * FROM menus ORDER BY created_at DESC').all();
    res.json(menus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menus', (req, res) => {
  try {
    const { name, title, content } = req.body;
    const stmt = db.prepare('INSERT INTO menus (name, title, content) VALUES (?, ?, ?)');
    const info = stmt.run(name, title, JSON.stringify(content));
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/menus/:id', (req, res) => {
  try {
    const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(req.params.id);
    if (!menu) return res.status(404).json({ error: 'Menu non trouvé' });
    res.json({ ...menu, content: JSON.parse((menu as any).content) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menus/:id', (req, res) => {
  try {
    const { name, title, content } = req.body;
    db.prepare('UPDATE menus SET name = ?, title = ?, content = ? WHERE id = ?')
      .run(name, title, JSON.stringify(content), req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menus/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM menus WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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