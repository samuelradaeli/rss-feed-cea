const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const RSS = require('rss');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1/members';
const MEMBERSTACK_API_KEY = 'sk_3e6c18041235c5003e0e';
const BUNNY_STORAGE_URL = 'https://storage.bunnycdn.com/cagando-e-andando/840282/';
const BUNNY_PULL_ZONE_URL = 'https://warbox.b-cdn.net/840282';
const BUNNY_API_KEY = 'c53674d5-1e1a-4187-a097-58f7fdb7e8ea43a4e453-c73d-4f76-a9dc-a7d057b328ed';

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Função para verificar e-mails no Memberstack
async function isEmailActive(email) {
  try {
    const response = await axios.get(MEMBERSTACK_API_URL, {
      headers: { Authorization: `Bearer ${MEMBERSTACK_API_KEY}` },
    });

    const members = response.data.members || [];
    return members.some(member => member.email === email && member.status === 'active');
  } catch (error) {
    console.error('Erro ao verificar e-mail:', error.message);
    return false;
  }
}

// Função para buscar episódios da API da Storage Zone
async function getEpisodesFromBunny() {
  try {
    const response = await axios.get(BUNNY_STORAGE_URL, {
      headers: {
        AccessKey: BUNNY_API_KEY,
      },
    });

    const files = response.data;
    return files
      .filter(file => file.ObjectName.endsWith('.mp3')) // Apenas arquivos MP3
      .map(file => ({
        title: file.ObjectName.replace('.mp3', ''), // Título sem extensão
        url: `${BUNNY_PULL_ZONE_URL}/${file.ObjectName}`, // Link público
        date: new Date(file.LastChanged), // Data de modificação
      }));
  } catch (error) {
    console.error('Erro ao buscar episódios do Bunny.net:', error.message);
    return [];
  }
}

// Rota para gerar o feed RSS
app.get('/rss', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).send('E-mail é obrigatório');
  }

  const isActive = await isEmailActive(email);

  if (!isActive) {
    return res.status(403).send('Acesso negado: Plano inativo ou e-mail inválido');
  }

  const episodes = await getEpisodesFromBunny();

  if (episodes.length === 0) {
    return res.status(500).send('Nenhum episódio encontrado');
  }

  const feed = new RSS({
    title: 'Warbox Podcasts',
    description: 'Seu feed privado de podcasts',
    feed_url: `${req.protocol}://${req.get('host')}/rss?email=${email}`,
    site_url: 'https://warbox.tv',
    language: 'pt-br',
  });

  episodes.forEach(episode => {
    feed.item({
      title: episode.title,
      description: `Episódio: ${episode.title}`,
      url: episode.url,
      date: episode.date,
    });
  });

  res.set('Content-Type', 'application/rss+xml');
  res.send(feed.xml());
});

// Página de login
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/views/login.html');
});

// Interface de administração
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/views/admin.html');
});

// Iniciar o servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
