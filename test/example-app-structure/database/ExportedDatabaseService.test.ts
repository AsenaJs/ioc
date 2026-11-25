import { PostConstruct, Service } from '../../../index';

@Service()
export class ExportedDatabaseService {
  public testValue: string;

  @PostConstruct()
  protected async onStart() {
    this.testValue = 'Test Value';
  }
}
