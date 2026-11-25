import { Service } from '../../../../index';
import { BaseServiceTest } from './BaseService.test';

@Service()
export class InheritedService2Test extends BaseServiceTest {
  public test() {
    return this.getConnection();
  }
}
