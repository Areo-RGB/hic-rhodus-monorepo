import lionel from '../assets/avatars/lionel.png';
import bent from '../assets/avatars/bent.png';
import lion from '../assets/avatars/lion.png';
import jakob from '../assets/avatars/jakob.png';
export interface PlayerData {
  name: string;
  interval: string;
  colorChange: number;
  handPreference: 'Rechts' | 'Links';
  avatar?: string;
}
export const PLAYERS: PlayerData[] = [
  { name: 'Lionel', interval: '1000ms', colorChange: 10, handPreference: 'Rechts', avatar: lionel },
  { name: 'Bent', interval: '1200ms', colorChange: 12, handPreference: 'Rechts', avatar: bent },
  { name: 'Lion', interval: '800ms', colorChange: 15, handPreference: 'Links', avatar: lion },
  { name: 'Jakob', interval: '900ms', colorChange: 14, handPreference: 'Rechts', avatar: jakob },
];
