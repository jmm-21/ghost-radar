import { describe, expect, it } from 'vitest';
import { isIos, platformOf } from '../src/pwa/detect';

describe('detección de iPhone', () => {
  it('reconoce iPhone, iPad y el iPad que dice ser un Mac', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });
  it('no confunde un Mac de verdad ni Android', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false);
  });
});

describe('plataforma', () => {
  it('distingue iPhone, Android y ordenador', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130', 5)).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130 Mobile', 5)).toBe('android');
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', 0)).toBe('desktop');
  });
});
