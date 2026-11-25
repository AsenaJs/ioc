import { Service } from '../../../index';

@Service()
export class ScannedGreeterService {
  public greet(): string {
    return 'scanned';
  }
}
