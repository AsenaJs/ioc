import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Inject, OnStart, OnStop, Strategy, Value } from '../index';

const LIB = path.resolve(import.meta.dir, '../lib');

const MESSAGE = 'was applied as a standard (TC39) decorator';

describe('a member decorator called the way standard decorators call it', () => {
  test.each([
    ['Inject', Inject('Dependency')],
    ['Strategy', Strategy('Key')],
    ['Value', Value('SOME_ENV')],
  ])('@%s on a field explains the dialect instead of dying on target.constructor', (name, decorator) => {
    expect(() => (decorator as any)(undefined, { kind: 'field', name: 'member' })).toThrow(`@${name} ${MESSAGE}`);
  });

  test.each([
    ['OnStart', OnStart()],
    ['OnStop', OnStop()],
  ])('@%s on a method throws instead of silently registering a hook that never runs', (name, decorator) => {
    expect(() => (decorator as any)(() => undefined, { kind: 'method', name: 'member' })).toThrow(
      `@${name} ${MESSAGE}`,
    );
  });

  test('a legacy call with a symbol member name is left alone', () => {
    class Holder {}

    expect(() => (Inject('Dependency') as any)(Holder.prototype, Symbol('member'))).not.toThrow();
  });
});

describe('source run from a directory whose tsconfig does not enable legacy decorators', () => {
  let directory: string;

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ioc-dialect-'));

    fs.writeFileSync(
      path.join(directory, 'main.ts'),
      `import { Inject } from '${LIB}/component/decorators/Inject';
import { OnStart } from '${LIB}/component/decorators/OnStart';

const report = (label: string, declare: () => void): void => {
  try {
    declare();
    console.log(label + ':NO_ERROR');
  } catch (error) {
    console.log(label + ':' + (error as Error).message);
  }
};

report('field', () => {
  class WithField {
    @Inject('Dependency')
    public dependency: unknown;
  }

  void WithField;
});

report('method', () => {
  class WithHook {
    @OnStart()
    public open(): void {}
  }

  void WithHook;
});
`,
    );
  });

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('reports the dialect for a field and for a method, with the real context Bun passes', async () => {
    const proc = Bun.spawn(['bun', 'main.ts'], { cwd: directory, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);

    await proc.exited;

    const output = stdout + stderr;

    expect(output).toContain(`field:@Inject ${MESSAGE}`);
    expect(output).toContain(`method:@OnStart ${MESSAGE}`);
    expect(output).toContain('experimentalDecorators');
  }, 30_000);
});
