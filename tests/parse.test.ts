import { describe, expect, it } from 'vitest';
import { classify, detectNetwork, extractAccount, isRelevantPath, parseFiles, toTimestamp } from '../src/core/parse';

const handles = (list: { handle: string; id?: string }[]) => list.map((a) => a.handle || a.id);

describe('Instagram / Threads (Meta)', () => {
  it('lee followers_1.json (formato con "value")', () => {
    const out = parseFiles([
      {
        path: 'connections/followers_and_following/followers_1.json',
        text: JSON.stringify([{ title: '', string_list_data: [{ href: 'https://www.instagram.com/ana', value: 'ana', timestamp: 1700000000 }] }]),
      },
    ]);
    expect(handles(out.followers)).toEqual(['ana']);
    expect(out.followers[0]!.ts).toBe(1700000000 * 1000);
  });

  it('lee following.json (formato nuevo: nombre en "title" o solo en el enlace)', () => {
    const out = parseFiles([
      {
        path: 'following.json',
        text: JSON.stringify({
          relationships_following: [
            { title: 'marta', string_list_data: [{ href: 'https://www.instagram.com/_u/marta', timestamp: 1 }] },
            { title: '', string_list_data: [{ href: 'https://www.instagram.com/_u/pepe' }] },
          ],
        }),
      },
    ]);
    expect(handles(out.following)).toEqual(['marta', 'pepe']);
  });

  it('ignora hashtags seguidos y solicitudes pendientes', () => {
    const out = parseFiles([
      { path: 'following_hashtags.json', text: JSON.stringify({ relationships_following_hashtags: [{ string_list_data: [{ value: 'viajes' }] }] }) },
      { path: 'pending_follow_requests.json', text: JSON.stringify({ relationships_follow_requests_sent: [{ string_list_data: [{ value: 'x' }] }] }) },
      { path: 'recently_unfollowed_profiles.json', text: JSON.stringify({ relationships_unfollowed_users: [{ string_list_data: [{ value: 'y' }] }] }) },
    ]);
    expect(out.followers).toHaveLength(0);
    expect(out.following).toHaveLength(0);
  });

  it('lee la exportación en HTML', () => {
    const out = parseFiles([
      { path: 'followers_1.html', text: '<a target="_blank" href="https://www.instagram.com/pepe">pepe</a>' },
      { path: 'following.html', text: '<a href="https://www.instagram.com/_u/lola">lola</a>' },
    ]);
    expect(handles(out.followers)).toEqual(['pepe']);
    expect(handles(out.following)).toEqual(['lola']);
  });
});

describe('TikTok', () => {
  it('lee el JSON actual ("Your Activity")', () => {
    const out = parseFiles([
      {
        path: 'user_data_tiktok.json',
        text: JSON.stringify({
          'Your Activity': {
            Follower: { FansList: [{ Date: '2024-01-02 10:00:00', UserName: 'fan1' }] },
            Following: { Following: [{ Date: '2024-01-02 10:00:00', UserName: 'idol1' }] },
            'Like List': { ItemFavoriteList: [{ Date: 'x', link: 'y' }] },
          },
        }),
      },
    ]);
    expect(handles(out.followers)).toEqual(['fan1']);
    expect(handles(out.following)).toEqual(['idol1']);
    expect(detectNetwork(out)).toBe('tiktok');
  });

  it('lee el JSON antiguo ("Activity" / "Follower List")', () => {
    const out = parseFiles([
      {
        path: 'user_data.json',
        text: JSON.stringify({
          Activity: {
            'Follower List': { FansList: [{ UserName: 'fanA' }] },
            'Following List': { Following: [{ UserName: 'idolA' }] },
          },
        }),
      },
    ]);
    expect(handles(out.followers)).toEqual(['fanA']);
    expect(handles(out.following)).toEqual(['idolA']);
  });

  it('lee el formato TXT', () => {
    const out = parseFiles([
      { path: 'Activity/Follower.txt', text: 'Date: 2024-01-02 10:00:00 UTC\nUsername: fanT\n\nDate: 2024-01-03 10:00:00 UTC\nUsername: fanT2\n' },
      { path: 'Activity/Following.txt', text: 'Date: 2024-01-02 10:00:00 UTC\nUserName: idolT\n' },
    ]);
    expect(handles(out.followers)).toEqual(['fanT', 'fanT2']);
    expect(handles(out.following)).toEqual(['idolT']);
    expect(out.followers[0]!.ts).toBe(Date.UTC(2024, 0, 2, 10));
  });
});

describe('X / Twitter', () => {
  it('lee follower.js y following.js (solo ids)', () => {
    const out = parseFiles([
      { path: 'data/follower.js', text: 'window.YTD.follower.part0 = [{"follower":{"accountId":"111","userLink":"https://twitter.com/intent/user?user_id=111"}}]' },
      { path: 'data/following.js', text: 'window.YTD.following.part0 = [{"following":{"accountId":"222"}}]' },
    ]);
    expect(out.followers[0]).toMatchObject({ key: 'id:111', id: '111', handle: '' });
    expect(out.following[0]).toMatchObject({ key: 'id:222' });
    expect(detectNetwork(out)).toBe('x');
  });
});

describe('utilidades', () => {
  it('classify usa la clave más profunda', () => {
    expect(classify(['Your Activity', 'Follower List', 'FansList'])).toBe('followers');
    expect(classify(['following.json', 'relationships_following'])).toBe('following');
    expect(classify(['profile.json'])).toBeNull();
  });

  it('toTimestamp entiende segundos, milisegundos y fechas de texto', () => {
    expect(toTimestamp(1700000000)).toBe(1700000000000);
    expect(toTimestamp(1700000000000)).toBe(1700000000000);
    expect(toTimestamp('2024-01-02 10:00:00 UTC')).toBe(Date.UTC(2024, 0, 2, 10));
    expect(toTimestamp('basura')).toBe(0);
    expect(toTimestamp(undefined)).toBe(0);
  });

  it('extractAccount devuelve null para objetos sin cuenta', () => {
    expect(extractAccount({ foo: 'bar' })).toBeNull();
    expect(extractAccount('texto')).toBeNull();
  });

  it('isRelevantPath separa Instagram de Threads dentro del mismo .zip', () => {
    expect(isRelevantPath('connections/followers_and_following/following.json', 'instagram')).toBe(true);
    expect(isRelevantPath('your_threads_activity/threads/following.json', 'instagram')).toBe(false);
    expect(isRelevantPath('your_threads_activity/threads/following.json', 'threads')).toBe(true);
    expect(isRelevantPath('media/photo.jpg', 'instagram')).toBe(false);
  });

  it('no falla con archivos corruptos', () => {
    expect(() => parseFiles([{ path: 'following.json', text: '{roto' }])).not.toThrow();
  });
});
