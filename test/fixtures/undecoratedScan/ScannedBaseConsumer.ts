import { Inject, Service } from '../../../index';
import type { ScannedBaseService } from './ScannedBaseService';

@Service()
export class ScannedBaseConsumer {
  @Inject('ScannedBaseService')
  public base: ScannedBaseService;
}
