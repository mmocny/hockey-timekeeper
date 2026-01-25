DROP TABLE IF EXISTS player_game_stats;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS game_state;

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  position TEXT NOT NULL,
  is_on_ice BOOLEAN DEFAULT 0,
  total_time INTEGER DEFAULT 0, -- in seconds
  last_shift_started INTEGER -- unix timestamp in seconds
);

CREATE TABLE game_state (
  id TEXT PRIMARY KEY, -- 'active_game'
  is_paused BOOLEAN DEFAULT 1,
  game_time INTEGER DEFAULT 0,
  updated_at INTEGER -- unix timestamp
);

-- Initial Data
INSERT INTO players (id, name, number, position, is_on_ice) VALUES 
('1', 'Kitt', '2', 'F', 0),
('2', 'Brodie', '4', 'F', 0),
('3', 'Demarco', '5', 'G', 0),
('4', 'Dawson', '6', 'F', 0),
('5', 'Able', '7', 'F', 0),
('6', 'Leighton', '8', 'F', 0),
('7', 'Zev', '10', 'F', 0),
('8', 'Wiktor', '12', 'F', 0),
('9', 'John', '13', 'F', 0),
('10', 'Logan', '14', 'F', 0),
('11', 'Cross', '15', 'F', 0),
('12', 'Grayson Adams', '16', 'F', 0),
('13', 'Naawakmig', '17', 'F', 0),
('14', 'Maajiikwis', '18', 'F', 0);

INSERT INTO game_state (id, is_paused, game_time, updated_at) VALUES 
('active_game', 1, 0, strftime('%s', 'now'));