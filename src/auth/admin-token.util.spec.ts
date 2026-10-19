import {
  digestToken,
  extractBearerToken,
  isSameToken,
} from './admin-token.util';

const TOKEN = 'a-very-long-admin-token-0123456789-abcdef';

describe('extractBearerToken', () => {
  it('returns the token of a Bearer header', () => {
    expect(extractBearerToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
  });

  it('matches the scheme name case-insensitively', () => {
    expect(extractBearerToken(`bearer ${TOKEN}`)).toBe(TOKEN);
    expect(extractBearerToken(`BEARER ${TOKEN}`)).toBe(TOKEN);
  });

  it.each([
    ['a missing header', undefined],
    ['an empty header', ''],
    ['the Basic scheme', `Basic ${TOKEN}`],
    ['Bearer alone', 'Bearer'],
    ['Bearer with an empty token', 'Bearer '],
    ['a token without a scheme', TOKEN],
    ['two spaces before the token', `Bearer  ${TOKEN}`],
    ['whitespace inside the token', 'Bearer abc def'],
  ])('returns undefined for %s', (_name, header) => {
    expect(extractBearerToken(header)).toBeUndefined();
  });
});

describe('digestToken', () => {
  it('gives a 32-byte sha256 digest whatever the token length', () => {
    expect(digestToken('x')).toHaveLength(32);
    expect(digestToken(TOKEN)).toHaveLength(32);
  });

  it('is deterministic', () => {
    expect(digestToken(TOKEN).equals(digestToken(TOKEN))).toBe(true);
  });

  it('differs for different tokens', () => {
    expect(digestToken(TOKEN).equals(digestToken(`${TOKEN}x`))).toBe(false);
  });
});

describe('isSameToken', () => {
  const expected = digestToken(TOKEN);

  it('accepts the same token', () => {
    expect(isSameToken(TOKEN, expected)).toBe(true);
  });

  it.each([
    ['a different token', 'wrong-token'],
    ['a prefix of the token', TOKEN.slice(0, -1)],
    ['the token with extra characters', `${TOKEN}x`],
    ['an empty token', ''],
  ])('rejects %s', (_name, presented) => {
    expect(isSameToken(presented, expected)).toBe(false);
  });
});
