// import { DataAccess } from './db.js';
import { jest } from '@jest/globals';

jest.mock('uuid');

describe('mock uuid', () => {
  it('should return testid }', async () => {
    const uuid = (await import('uuid')).v4;
    uuid.mockImplementation(() => 'testid');
  });  
});
// run "yarn test" to run all tests

test('testing tests', () => {
    expect(2 + 2).toBe(4);
});
