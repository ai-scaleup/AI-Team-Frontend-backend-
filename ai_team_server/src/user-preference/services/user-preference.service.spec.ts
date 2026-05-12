import { UserPreferenceService } from './user-preference.service';

describe('UserPreferenceService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    userPreference: {
      findUnique: jest.fn(),
    },
  };

  let service: UserPreferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserPreferenceService(prisma as any);
  });

  it('resolves path email identifiers without treating them as OAuth IDs', async () => {
    prisma.user.findFirst.mockResolvedValue({
      oauthId: 'oauth-user-123',
      email: 'digitalcoachai@gmail.com',
    });
    prisma.userPreference.findUnique.mockResolvedValue({
      id: 'preference-1',
      oauthId: 'oauth-user-123',
      agentName: 'ALEX',
    });

    const preference = await service.findByUserIdentifierAndAgent(
      'digitalcoachai@gmail.com',
      'ALEX' as any,
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'digitalcoachai@gmail.com',
          mode: 'insensitive',
        },
      },
      select: { oauthId: true, email: true },
    });
    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: {
        oauthId_agentName: {
          oauthId: 'oauth-user-123',
          agentName: 'ALEX',
        },
      },
    });
    expect(preference.oauthId).toBe('oauth-user-123');
  });
});
