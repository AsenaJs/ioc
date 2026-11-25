import { Component, Scope } from '../../../index';

@Component({
  name: 'ExportedTestService',
  scope: Scope.SINGLETON,
})
export class ExportedTestService {
  public getValue(): string {
    return 'test';
  }

  public setValue(value: string): string {
    return value;
  }

  public deleteValue(): string {
    return 'deleted';
  }
}
