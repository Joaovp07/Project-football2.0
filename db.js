const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'football.db');
const db = new Database(dbPath);

function init() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER,
      name TEXT NOT NULL,
      market_factor REAL DEFAULT 1.0,
      FOREIGN KEY(league_id) REFERENCES leagues(id)
    );
  `);

  // seed basic data if empty
  const row = db.prepare('SELECT COUNT(1) as c FROM leagues').get();
  if (row.c === 0) {
    const insertLeague = db.prepare('INSERT INTO leagues (name, country) VALUES (?, ?)');
    const insertTeam = db.prepare('INSERT INTO teams (league_id, name, market_factor) VALUES (?, ?, ?)');

    const leagues = [
      { name: 'Primeira Liga', country: 'Portugal', teams: [
        ['Benfica', 1.4], ['Porto', 1.3], ['Sporting', 1.2]
      ]},
      { name: 'Premier League', country: 'England', teams: [
        ['Arsenal', 2.0], ['Manchester City', 2.6], ['Liverpool', 2.3]
      ]},
      { name: 'LaLiga', country: 'Spain', teams: [
        ['Real Madrid', 3.0], ['Barcelona', 2.8], ['Atletico Madrid', 1.9]
      ]},
      { name: 'Brasileirão', country: 'Brazil', teams: [
        ['Flamengo', 1.6], ['Palmeiras', 1.4], ['Corinthians', 1.3]
      ]}
    ];

    const insertLeagueTxn = db.transaction((items) => {
      for (const L of items) {
        const info = insertLeague.run(L.name, L.country);
        const lid = info.lastInsertRowid;
        for (const t of L.teams) insertTeam.run(lid, t[0], t[1]);
      }
    });

    insertLeagueTxn(leagues);
  }
}

init();

function getLeagues() {
  return db.prepare('SELECT id, name, country FROM leagues ORDER BY name').all();
}

function getTeamsByLeague(leagueId) {
  return db.prepare('SELECT id, name, market_factor FROM teams WHERE league_id = ? ORDER BY name').all(leagueId);
}

function generateMarketOffers({ playerOvr = 60, playerValue = 1.0, maxOffers = 5 } = {}) {
  // choose random teams and propose offers based on their market_factor
  const teams = db.prepare('SELECT t.id, t.name, l.name as league, t.market_factor FROM teams t JOIN leagues l ON l.id = t.league_id').all();
  shuffle(teams);
  const offers = [];
  for (let i = 0; i < Math.min(maxOffers, teams.length); i++) {
    const t = teams[i];
    const base = Math.max(0.5, playerValue);
    // offer fee scales with team market_factor and playerOvr
    const fee = +(base * (t.market_factor * (playerOvr / 60)) * (0.8 + Math.random() * 0.8)).toFixed(2);
    const wage = Math.round((playerOvr / 60) * 5 * t.market_factor + Math.random() * 3);
    offers.push({ club: t.name, league: t.league, fee, wage });
  }
  return offers;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

module.exports = {
  getLeagues,
  getTeamsByLeague,
  generateMarketOffers
};
