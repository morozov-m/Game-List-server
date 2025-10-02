import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const app = express();

// Разбираем JSON‑тело
app.use(express.json());
// Включаем CORS, если фронтенд на другом порту
app.use(cors());

// Настройка статики для картинок
const imagesDir = path.join(__dirname, 'public/images');
app.use('/images', express.static(imagesDir));

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imagesDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

// Путь к файлу с данными
const DATA_FILE = path.resolve(__dirname, 'games.json');

// Тип игры
interface Game {
  id: number;
  image: string;
  title: string;
  status: 'Пройдено' | 'В процессе' | 'Брошено';
  hours: number;
  extra?: string;
}

// Хранилище в памяти
let games: Game[] = [];

// Функция чтения из файла при старте
function loadGames(): void {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    games = JSON.parse(raw);
  } catch {
    games = [];
    fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf-8');
    console.log(`Created new data file at ${DATA_FILE}`);
  }
}

// Функция сохранения в файл
function saveGames(): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf-8');
}

// Инициализация данных
loadGames();

// --- CRUD-маршруты ---

// Получить список игр
app.get('/games', (_req, res) => {
  res.json(games);
});

// Создать новую игру (с загрузкой фото)
app.post(
  '/games',
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: 'Фото не прикреплено' });
      return;
    }

    const { title, status, hours, extra } = req.body;
    const newGame: Game = {
      id: Date.now(),
      image: req.file.filename,
      title,
      status,
      hours: Number(hours),
      extra
    };

    games.push(newGame);
    saveGames();
    res.status(201).json(newGame);
  }
);

// Обновить игру (опционально с новым фото)
app.put(
  '/games/:id',
  upload.single('image'),
  (req, res) => {
    const id = Number(req.params.id);
    const idx = games.findIndex(g => g.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Game not found' });
      return;
    }

    // Если пришло новое фото — обновляем имя файла
    if (req.file) {
      // можно удалить старый файл:
      // fs.unlinkSync(path.join(imagesDir, games[idx].image));
      games[idx].image = req.file.filename;
    }

    const { title, status, hours, extra } = req.body;
    if (title)  games[idx].title  = title;
    if (status) games[idx].status = status;
    if (hours)  games[idx].hours  = Number(hours);
    if (extra !== undefined) games[idx].extra  = extra;

    saveGames();
    res.json(games[idx]);
  }
);

// Удалить игру и, при желании, её фото
app.delete('/games/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = games.findIndex(g => g.id === id);
  if (idx === -1) {
    res.status(404).json({ message: 'Game not found' });
    return;
  }

  // По желанию удалить файл:
   fs.unlinkSync(path.join(imagesDir, games[idx].image));

  games.splice(idx, 1);
  saveGames();
  res.sendStatus(204);
});

// Запустить сервер
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
