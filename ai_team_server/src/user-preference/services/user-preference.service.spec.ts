import { UserPreferenceService } from './user-preference.service';

describe('UserPreferenceService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    userPreference: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: UserPreferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserPreferenceService(prisma as any);
  });

  it('gets preferences by email without resolving OAuth ID first', async () => {
    prisma.userPreference.findFirst.mockResolvedValue({
      id: 'preference-1',
      oauthId: 'oauth-user-123',
      email: 'digitalcoachai@gmail.com',
      agentName: 'ALEX',
    });

    const preference = await service.findByUserIdentifierAndAgent(
      'digitalcoachai@gmail.com',
      'ALEX' as any,
    );

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.userPreference.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'digitalcoachai@gmail.com',
          mode: 'insensitive',
        },
        agentName: 'ALEX',
      },
    });
    expect(preference.oauthId).toBe('oauth-user-123');
  });
});
