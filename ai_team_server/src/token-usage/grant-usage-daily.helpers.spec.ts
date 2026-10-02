import { recordGrantUsageDay } from './grant-usage-daily.helpers';

describe('recordGrantUsageDay', () => {
  const entry = {
    oauthId: 'user_1',
    agentName: 'TONY' as const,
    source: 'TEAM' as const,
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  };

  const makeDb = () => ({
    grantTokenUsageDaily: { upsert: jest.fn().mockResolvedValue({}) },
  });

  it("adds the spend to today's UTC row for that user, agent and source", async () => {
    const db = makeDb();
    await recordGrantUsageDay(db as never, entry);

    const today = new Date();
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    expect(db.grantTokenUsageDaily.upsert).toHaveBeenCalledWith({
      where: {
        oauthId_agentName_source_date: {
          oauthId: 'user_1',
          agentName: 'TONY',
          source: 'TEAM',
          date,
        },
      },
      create: {
        oauthId: 'user_1',
        agentName: 'TONY',
        source: 'TEAM',
        date,
        inputTokens: 900,
        outputTokens: 100,
        totalTokens: 1000,
      },
      update: {
        inputTokens: { increment: 900 },
        outputTokens: { increment: 100 },
        totalTokens: { increment: 1000 },
      },
    });
  });

  it('writes nothing when the grant did not move', async () => {
    const db = makeDb();
    await recordGrantUsageDay(db as never, {
      ...entry,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
    expect(db.grantTokenUsageDaily.upsert).not.toHaveBeenCalled();
  });

  it('never fails the chat when the chart write fails', async () => {
    const db = makeDb();
    db.grantTokenUsageDaily.upsert.mockRejectedValue(new Error('no table'));
    await expect(
      recordGrantUsageDay(db as never, entry),
    ).resolves.toBeUndefined();
  });
});
