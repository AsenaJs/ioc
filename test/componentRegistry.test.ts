import { describe, expect, test } from 'bun:test';
import * as path from 'node:path';
import {
  Component,
  getComponentsDeclaredIn,
  resetComponentRegistry,
  Service,
  skipDeclarationFramesUnder,
} from '../index';
import { Guarded } from './fixtures/wrappingDecorator/Guarded';

const THIS_FILE = import.meta.path;

@Service()
class RegisteredService {}

@Component()
class RegisteredComponent {}

describe('componentRegistry', () => {
  test('attributes decorated classes to the file they were declared in', () => {
    const names = getComponentsDeclaredIn(new Set([THIS_FILE])).map((cls) => cls.name);

    expect(names).toContain('RegisteredService');
    expect(names).toContain('RegisteredComponent');
  });

  test('returns nothing for a file that declared no components', () => {
    expect(getComponentsDeclaredIn(new Set(['/somewhere/else.ts']))).toEqual([]);
  });

  test('returns nothing when asked for no files', () => {
    expect(getComponentsDeclaredIn(new Set())).toEqual([]);
  });

  test('does not attribute package-internal classes to user files', () => {
    // Core services are decorated with @CoreService, which never marks an IoC
    // component - and every component decorator runs inside lib/, which is skipped
    const declared = getComponentsDeclaredIn(new Set([THIS_FILE]));

    expect(declared.every((cls) => cls.name !== 'IocEngine')).toBe(true);
  });

  test('a wrapping decorator hides the declaring file behind its own until its source tree is marked as skipped', () => {
    const wrapperDir = path.resolve(import.meta.dir, 'fixtures/wrappingDecorator');
    const declaredHere = () => getComponentsDeclaredIn(new Set([THIS_FILE])).map((cls) => cls.name);

    @Guarded('BeforeSkip')
    class BeforeSkip {}

    expect(declaredHere()).not.toContain('BeforeSkip');
    expect(getComponentsDeclaredIn(new Set([path.join(wrapperDir, 'Guarded.ts')]))).toEqual([BeforeSkip]);

    skipDeclarationFramesUnder(wrapperDir);

    @Guarded('AfterSkip')
    class AfterSkip {}

    expect(declaredHere()).toContain('AfterSkip');
  });

  test('clears on reset so a second boot in the same process starts clean', () => {
    expect(getComponentsDeclaredIn(new Set([THIS_FILE])).length).toBeGreaterThan(0);

    resetComponentRegistry();

    expect(getComponentsDeclaredIn(new Set([THIS_FILE]))).toEqual([]);
  });
});

// Keep the classes referenced so they are not treated as unused
void RegisteredService;
void RegisteredComponent;
