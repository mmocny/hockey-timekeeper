DROP TABLE IF EXISTS player_game_stats;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS players;

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  position TEXT NOT NULL
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  opponent TEXT NOT NULL,
  date TEXT NOT NULL,
  score_us INTEGER DEFAULT 0,
  score_them INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled' -- 'scheduled', 'active', 'completed'
);

CREATE TABLE player_game_stats (
  player_id TEXT,
  game_id TEXT,
  total_ice_time INTEGER DEFAULT 0, -- in seconds
  PRIMARY KEY (player_id, game_id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Initial Data
INSERT INTO players (id, name, number, position) VALUES 
('1', 'Alex M.', '10', 'F'),
('2', 'Sarah J.', '22', 'F'),
('3', 'Mike R.', '8', 'F'),
('4', 'Chris K.', '33', 'D'),
('5', 'Jamie L.', '44', 'D'),
('6', 'Sam B.', '1', 'G');
