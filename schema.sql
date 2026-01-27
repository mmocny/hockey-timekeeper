DROP TABLE IF EXISTS player_game_stats;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS game_state;

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  lane INTEGER DEFAULT 6, -- 0: C, 1: LW, 2: RW, 3: LD, 4: RD, 5: G, 6: Bench, 7: Absent
  queue_order INTEGER DEFAULT 0, -- 0 is always "On Ice" for lanes 0-5
  total_time INTEGER DEFAULT 0,
  last_shift_started INTEGER
);

CREATE TABLE game_state (
  id TEXT PRIMARY KEY,
  is_paused BOOLEAN DEFAULT 1,
  game_time INTEGER DEFAULT 0,
  updated_at INTEGER
);

-- Initial Roster
-- queue_order 0 means they start ON ICE
INSERT INTO players (id, name, number, lane, queue_order, last_shift_started) VALUES 
('1', 'Kitt', '2', 0, 0, NULL),
('2', 'Brodie', '4', 0, 1, NULL),
('3', 'Demarco', '5', 6, 0, NULL),
('4', 'Dawson', '6', 1, 0, NULL),
('5', 'Able', '7', 1, 1, NULL),
('6', 'Leighton', '8', 2, 0, NULL),
('7', 'Zev', '10', 2, 1, NULL),
('8', 'Wiktor', '12', 3, 0, NULL),
('9', 'John', '13', 3, 1, NULL),
('10', 'Logan', '14', 4, 0, NULL),
('11', 'Cross', '15', 4, 1, NULL),
('12', 'Grayson Adams', '16', 6, 1, NULL),
('13', 'Naawakmig', '17', 6, 2, NULL),
('14', 'Maajiikwis', '18', 6, 3, NULL),
('15', 'Goalie Bob', '30', 5, 0, NULL);

INSERT INTO game_state (id, is_paused, game_time, updated_at) VALUES 
('active_game', 1, 0, strftime('%s', 'now'));