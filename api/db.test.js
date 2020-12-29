import { DataAccess } from './db.js';


jest.mock('uuid/v4');

describe('mock uuid', () => {
  it('should return testid }', () => {
    uuid.mockImplementation(() => 'testid');
  });  
});
// run "yarn test" to run all tests

test('testing tests', () => {
    expect(2 + 2).toBe(4);
});