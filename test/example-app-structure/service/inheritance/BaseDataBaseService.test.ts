import { PostConstruct, Service } from '../../../../index';

@Service()
export class BaseDataBaseServiceTest {
  public connection = false;

  @PostConstruct()
  public async execute(): Promise<void> {
    this.connection = true;
  }
}
