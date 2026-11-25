import { mergeByTime, type TimeOf } from './list-merge';

/** Hacker News stories 1..n with the given times; a missing time means "not known". */
function timesOf(times: Record<number, number | undefined>) {
  const asked: number[] = [];
  const timeOf: TimeOf = async (id) => {
    asked.push(id);
    return times[id];
  };
  return { timeOf, asked };
}

describe('mergeByTime', () => {
  describe('a list that is newest first', () => {
    // Story 1 is the newest (time 100) and story 5 the oldest (time 60).
    const times = { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60 };
    const ids = [1, 2, 3, 4, 5];

    it('leaves the list alone when nothing was submitted here', async () => {
      const { timeOf, asked } = timesOf(times);
      expect(await mergeByTime(ids, [], 'newest-first', timeOf)).toBe(ids);
      expect(asked).toEqual([]);
    });

    it('puts a story among the ones of the same age, not on top', async () => {
      const { timeOf } = timesOf(times);
      expect(await mergeByTime(ids, [{ id: 900, time: 85 }], 'newest-first', timeOf)).toEqual([
        1, 2, 900, 3, 4, 5,
      ]);
    });

    it('puts a story newer than everything first', async () => {
      const { timeOf } = timesOf(times);
      expect(await mergeByTime(ids, [{ id: 900, time: 500 }], 'newest-first', timeOf)).toEqual([
        900, 1, 2, 3, 4, 5,
      ]);
    });

    it('puts a story older than everything last', async () => {
      const { timeOf } = timesOf(times);
      expect(await mergeByTime(ids, [{ id: 900, time: 1 }], 'newest-first', timeOf)).toEqual([
        1, 2, 3, 4, 5, 900,
      ]);
    });

    it('puts a story first of those made at the same moment', async () => {
      const { timeOf } = timesOf(times);
      expect(await mergeByTime(ids, [{ id: 900, time: 80 }], 'newest-first', timeOf)).toEqual([
        1, 2, 900, 3, 4, 5,
      ]);
    });

    it('spreads several stories out by their times, keeping their own order', async () => {
      const { timeOf } = timesOf(times);
      const local = [
        { id: 901, time: 95 },
        { id: 902, time: 85 },
        { id: 903, time: 84 },
        { id: 904, time: 10 },
      ];
      expect(await mergeByTime(ids, local, 'newest-first', timeOf)).toEqual([
        1, 901, 2, 902, 903, 3, 4, 5, 904,
      ]);
    });

    it('does not depend on the order the stories are given in', async () => {
      const { timeOf } = timesOf(times);
      const local = [
        { id: 904, time: 10 },
        { id: 901, time: 95 },
        { id: 903, time: 84 },
        { id: 902, time: 85 },
      ];
      expect(await mergeByTime(ids, local, 'newest-first', timeOf)).toEqual([
        1, 901, 2, 902, 903, 3, 4, 5, 904,
      ]);
    });

    it('works with an empty Hacker News list', async () => {
      const { timeOf } = timesOf({});
      expect(
        await mergeByTime(
          [],
          [
            { id: 900, time: 1 },
            { id: 901, time: 2 },
          ],
          'newest-first',
          timeOf,
        ),
      ).toEqual([901, 900]);
    });

    it('does not change the list it was given', async () => {
      const { timeOf } = timesOf(times);
      const original = [...ids];
      await mergeByTime(ids, [{ id: 900, time: 85 }], 'newest-first', timeOf);
      expect(ids).toEqual(original);
    });

    it('looks up only a few stories, not the whole list', async () => {
      const many = Array.from({ length: 500 }, (_, index) => 500 - index);
      const manyTimes = Object.fromEntries(many.map((id) => [id, id * 10]));
      const { timeOf, asked } = timesOf(manyTimes);
      const merged = await mergeByTime(many, [{ id: 9000, time: 2505 }], 'newest-first', timeOf);

      expect(merged.indexOf(9000)).toBe(many.findIndex((id) => id * 10 <= 2505));
      expect(asked.length).toBeLessThan(40);
    });

    it('steps past a story with no time, such as a deleted one, to judge the position', async () => {
      const { timeOf } = timesOf({ 1: 100, 2: undefined, 3: 80, 4: 70, 5: 60 });
      expect(await mergeByTime(ids, [{ id: 900, time: 75 }], 'newest-first', timeOf)).toEqual([
        1, 2, 3, 900, 4, 5,
      ]);
    });
  });

  describe('a ranked list, which only roughly follows time', () => {
    // Ranked by Hacker News: not in time order.
    const times = { 1: 50, 2: 90, 3: 20, 4: 70 };
    const ids = [1, 2, 3, 4];

    it('puts a question before the first story that is older than it', async () => {
      const { timeOf } = timesOf(times);
      expect(await mergeByTime(ids, [{ id: 900, time: 60 }], 'ranked', timeOf)).toEqual([
        900, 1, 2, 3, 4,
      ]);
      expect(await mergeByTime(ids, [{ id: 900, time: 40 }], 'ranked', timeOf)).toEqual([
        1, 2, 900, 3, 4,
      ]);
    });

    it('puts a question older than everything last', async () => {
      const { timeOf } = timesOf(times);
      expect(await mergeByTime(ids, [{ id: 900, time: 5 }], 'ranked', timeOf)).toEqual([
        1, 2, 3, 4, 900,
      ]);
    });

    it('puts a question newer than everything first', async () => {
      const { timeOf } = timesOf(times);
      expect(await mergeByTime(ids, [{ id: 900, time: 500 }], 'ranked', timeOf)).toEqual([
        900, 1, 2, 3, 4,
      ]);
    });

    it('keeps questions submitted here in their own order, newest first', async () => {
      const { timeOf } = timesOf(times);
      const local = [
        { id: 901, time: 15 },
        { id: 902, time: 45 },
      ];
      expect(await mergeByTime(ids, local, 'ranked', timeOf)).toEqual([1, 2, 902, 3, 4, 901]);
    });
  });
});
