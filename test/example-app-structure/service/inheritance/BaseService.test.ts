import { Inject, Service } from '../../../../index';
import type { BaseDataBaseServiceTest } from './BaseDataBaseService.test';

@Service()
export class BaseServiceTest {
  @Inject('BaseDataBaseServiceTest')
  public db: BaseDataBaseServiceTest;

  public getConnection() {
    return this.db.connection;
  }
}
