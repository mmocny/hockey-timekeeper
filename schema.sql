DROP TABLE IF EXISTS player_game_stats;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS game_state;

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  position TEXT NOT NULL, -- Keep for metadata
  lane INTEGER DEFAULT 5, -- 0: C, 1: LW, 2: RW, 3: LD, 4: RD, 5: Bench
  queue_order INTEGER DEFAULT 0,
  is_on_ice BOOLEAN DEFAULT 0,
  total_time INTEGER DEFAULT 0,
  last_shift_started INTEGER
);

CREATE TABLE game_state (
  id TEXT PRIMARY KEY,
  is_paused BOOLEAN DEFAULT 1,
  game_time INTEGER DEFAULT 0,
  updated_at INTEGER
);

-- Initial Roster with Lane Assignments
INSERT INTO players (id, name, number, position, lane, queue_order) VALUES 
('1', 'Kitt', '2', 'F', 0, 0),
('2', 'Brodie', '4', 'F', 0, 1),
('3', 'Demarco', '5', 'G', 5, 0),
('4', 'Dawson', '6', 'F', 1, 0),
('5', 'Able', '7', 'F', 1, 1),
('6', 'Leighton', '8', 'F', 2, 0),
('7', 'Zev', '10', 'F', 2, 1),
('8', 'Wiktor', '12', 'F', 3, 0),
('9', 'John', '13', 'F', 3, 1),
('10', 'Logan', '14', 'F', 4, 0),
('11', 'Cross', '15', 'F', 4, 1),
('12', 'Grayson Adams', '16', 'F', 5, 1),
('13', 'Naawakmig', '17', 'F', 5, 2),
('14', 'Maajiikwis', '18', 'F', 5, 3);

INSERT INTO game_state (id, is_paused, game_time, updated_at) VALUES 
('active_game', 1, 0, strftime('%s', 'now'));
