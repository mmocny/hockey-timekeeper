export type Position = 'F' | 'D' | 'G';

export interface Player {
  id: string;
  name: string;
  number: string;
  position: Position;
}

export interface GamePlayerState extends Player {
  isOnIce: boolean;
  totalTime: number;
  lastShiftStarted?: number;
}

export const INITIAL_PLAYERS: Player[] = [
  { id: '1', name: 'Alex M.', number: '10', position: 'F' },
  { id: '2', name: 'Sarah J.', number: '22', position: 'F' },
  { id: '3', name: 'Mike R.', number: '8', position: 'F' },
  { id: '4', name: 'Chris K.', number: '33', position: 'D' },
  { id: '5', name: 'Jamie L.', number: '44', position: 'D' },
  { id: '6', name: 'Sam B.', number: '1', position: 'G' },
];
