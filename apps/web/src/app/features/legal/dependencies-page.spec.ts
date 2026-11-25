import { filterDependencies, type DependencyEntry } from './dependencies-page';

const packages: DependencyEntry[] = [
  { name: '@angular/core', version: '22.2.0', license: 'MIT', url: 'https://angular.dev' },
  { name: 'pdf-lib', version: '1.17.1', license: 'MIT', url: 'https://pdf-lib.js.org' },
  { name: 'tslib', version: '2.8.1', license: '0BSD', url: 'https://www.typescriptlang.org/' },
];

describe('filterDependencies', () => {
  it('returns everything for an empty or blank search', () => {
    expect(filterDependencies(packages, '')).toBe(packages);
    expect(filterDependencies(packages, '   ')).toBe(packages);
  });

  it('matches name or license, case-insensitive', () => {
    expect(filterDependencies(packages, 'ANGULAR').map((p) => p.name)).toEqual(['@angular/core']);
    expect(filterDependencies(packages, '0bsd').map((p) => p.name)).toEqual(['tslib']);
    expect(filterDependencies(packages, 'mit')).toHaveLength(2);
    expect(filterDependencies(packages, 'nothing')).toEqual([]);
  });
});
