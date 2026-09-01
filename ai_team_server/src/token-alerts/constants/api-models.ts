import { ApiModel } from 'src/generated/prisma/client';

/**
 * Maps the stored `ApiModel` enum onto the id the provider's API expects.
 * OpenAI only for now -- when another provider is added, its values are
 * appended to the enum and to this map; nothing here is ever removed, so rows
 * written by an older build keep resolving.
 */
export const API_MODEL_IDS: Record<ApiModel, string> = {
  [ApiModel.GPT_5]: 'gpt-5',
  [ApiModel.GPT_5_MINI]: 'gpt-5-mini',
  [ApiModel.GPT_5_NANO]: 'gpt-5-nano',
  [ApiModel.GPT_4_1]: 'gpt-4.1',
  [ApiModel.GPT_4_1_MINI]: 'gpt-4.1-mini',
  [ApiModel.GPT_4O]: 'gpt-4o',
  [ApiModel.GPT_4O_MINI]: 'gpt-4o-mini',
  [ApiModel.O3]: 'o3',
  [ApiModel.O4_MINI]: 'o4-mini',
};

/** Human labels for the admin panel's model dropdown. */
export const API_MODEL_LABELS: Record<ApiModel, string> = {
  [ApiModel.GPT_5]: 'GPT-5',
  [ApiModel.GPT_5_MINI]: 'GPT-5 mini',
  [ApiModel.GPT_5_NANO]: 'GPT-5 nano',
  [ApiModel.GPT_4_1]: 'GPT-4.1',
  [ApiModel.GPT_4_1_MINI]: 'GPT-4.1 mini',
  [ApiModel.GPT_4O]: 'GPT-4o',
  [ApiModel.GPT_4O_MINI]: 'GPT-4o mini',
  [ApiModel.O3]: 'o3',
  [ApiModel.O4_MINI]: 'o4-mini',
};

export const API_MODEL_PROVIDER = 'openai';

/** The dropdown payload: one entry per enum value. */
export const API_MODEL_CATALOG = (Object.values(ApiModel) as ApiModel[]).map(
  (value) => ({
    value,
    label: API_MODEL_LABELS[value],
    modelId: API_MODEL_IDS[value],
    provider: API_MODEL_PROVIDER,
  }),
);

/** Reverse lookup so callers may send either `GPT_4O_MINI` or `gpt-4o-mini`. */
export const API_MODEL_BY_MODEL_ID = new Map<string, ApiModel>(
  (Object.entries(API_MODEL_IDS) as [ApiModel, string][]).map(
    ([value, modelId]) => [modelId.toLowerCase(), value],
  ),
);
