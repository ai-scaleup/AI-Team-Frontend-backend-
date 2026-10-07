import { SingleAssignedAgentService } from './single-assigned-agent.service';

describe('SingleAssignedAgentService.update', () => {
  const prisma = {
    $transaction: jest.fn(),
    singleAssignedAgent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  // An ALEX grant that has spent more than its allowance.
  const exhausted = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    agentName: 'ALEX',
    startsAt: new Date('2026-09-01T00:00:00.000Z'),
    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    durationDays: 30,
    isActive: true,
    tokenLimit: 100000,
    usedTokens: 103833,
    inputTokens: 100294,
    outputTokens: 1039,
    tokensLeft: 0,
    user: { id: 'user-1', email: 'a@b.c', oauthId: 'oauth-1', username: 'a' },
  };

  // The chat model catalog; only id validation is used here.
  const llmModels = { assertSelectable: jest.fn() };

  let service: SingleAssignedAgentService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.singleAssignedAgent.findUnique.mockResolvedValue(exhausted);
    prisma.singleAssignedAgent.update.mockImplementation(({ data }) => ({
      ...exhausted,
      ...data,
    }));
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    service = new SingleAssignedAgentService(
      prisma as never,
      llmModels as never,
    );
  });

  const sentData = () =>
    prisma.singleAssignedAgent.update.mock.calls[0][0].data as Record<
      string,
      unknown
    >;

  it('renews an exhausted grant: spend zeroed, full allowance back, restarted now', async () => {
    const before = Date.now();
    await service.update(exhausted.id, {
      durationDays: 30,
      isActive: true,
      tokenLimit: 100000,
      resetUsage: true,
    });

    const data = sentData();
    expect(data).toMatchObject({
      tokenLimit: 100000,
      tokensLeft: 100000,
      usedTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    const startsAt = (data.startsAt as Date).getTime();
    expect(startsAt).toBeGreaterThanOrEqual(before);
    expect((data.expiresAt as Date).getTime()).toBe(
      startsAt + 30 * 24 * 60 * 60 * 1000,
    );
  });

  it('renewing without a new limit gives back the existing limit', async () => {
    await service.update(exhausted.id, { resetUsage: true });

    expect(sentData()).toMatchObject({ usedTokens: 0, tokensLeft: 100000 });
    expect(sentData()).not.toHaveProperty('tokenLimit');
  });

  it('a plain limit edit keeps the spend and re-derives tokensLeft from it', async () => {
    await service.update(exhausted.id, { tokenLimit: 150000 });

    const data = sentData();
    expect(data).toMatchObject({ tokenLimit: 150000, tokensLeft: 46167 });
    expect(data).not.toHaveProperty('usedTokens');
    expect(data).not.toHaveProperty('startsAt');
  });

  it('leaves the model alone when llmModelId is omitted', async () => {
    await service.update(exhausted.id, { tokenLimit: 150000 });

    expect(llmModels.assertSelectable).not.toHaveBeenCalled();
    expect(sentData()).not.toHaveProperty('llmModel');
  });

  it('validates and stores a chosen model', async () => {
    const id = 'llm-anthropic-claude-opus-5-5';
    await service.update(exhausted.id, { llmModelId: id });

    expect(llmModels.assertSelectable).toHaveBeenCalledWith(id);
    expect(sentData()).toMatchObject({ llmModel: { connect: { id } } });
  });

  it('resets the model to the default when llmModelId is null', async () => {
    await service.update(exhausted.id, { llmModelId: null });

    expect(llmModels.assertSelectable).not.toHaveBeenCalled();
    expect(sentData()).toMatchObject({ llmModel: { disconnect: true } });
  });

  it('refuses an unknown model before writing', async () => {
    llmModels.assertSelectable.mockRejectedValue(new Error('unknown'));

    await expect(
      service.update(exhausted.id, { llmModelId: 'nope' }),
    ).rejects.toThrow('unknown');
    expect(prisma.singleAssignedAgent.update).not.toHaveBeenCalled();
  });
});
