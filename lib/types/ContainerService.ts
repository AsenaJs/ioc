import type { Class } from './Class';

export interface ContainerService {
  Class: Class;
  instance: any | null;
  singleton: boolean;
}
