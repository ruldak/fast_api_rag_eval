import type {
  Tenant,
  Metric,
  EvaluationRun,
  EvaluationDetail,
  HumanReviewSample,
  CalibrationStat,
  HealthStatus,
} from "./types"

export const tenant: Tenant = {
  id: "e4f8d55c-1122-3344-5566-778899aabbcc",
  name: "Acme RAG Team",
  api_key: "rag_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
}

export const metrics: Metric[] = [
  {
    id: "11111111-2222-3333-4444-555555555555",
    name: "faithfulness",
    type: "predefined",
    config: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "22222222-3333-4444-5555-666666666666",
    name: "answer_relevancy",
    type: "predefined",
    config: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "33333333-4444-5555-6666-777777777777",
    name: "correctness",
    type: "predefined",
    config: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "44444444-5555-6666-7777-888888888888",
    name: "context_precision",
    type: "predefined",
    config: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "99999999-8888-7777-6666-555555555555",
    name: "conciseness",
    type: "custom",
    config: {
      prompt_template:
        "Evaluate whether the response is direct and avoids unnecessary verbosity. Score 0 to 1 where 1 is perfectly concise.\n\nQuery: {{query}}\nResponse: {{response}}\n\nProvide a score and brief reason.",
      model: "llama-3.1-8b-instant",
      output_schema: { score: "float", reason: "string" },
      temperature: 0.0,
    },
    created_at: "2026-06-25T01:10:00Z",
  },
  {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    name: "tone_appropriateness",
    type: "custom",
    config: {
      prompt_template:
        "Evaluate whether the tone of the response is appropriate for a professional context. Score 0 to 1.\n\nQuery: {{query}}\nResponse: {{response}}",
      model: "llama-3.1-8b-instant",
      output_schema: { score: "float", reason: "string" },
      temperature: 0.1,
    },
    created_at: "2026-07-01T09:00:00Z",
  },
]

const d = (daysAgo: number) => {
  const date = new Date("2026-07-15T12:00:00Z")
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}

export const evaluationRuns: EvaluationRun[] = [
  {
    run_id: "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
    status: "completed",
    metadata: {
      environment: "staging",
      model_tested: "gpt-4o",
      dataset_version: "v1.2",
      requested_metrics: ["faithfulness", "answer_relevancy"],
    },
    item_count: 5,
    created_at: d(6),
    updated_at: d(6),
  },
  {
    run_id: "bb22cc33-44dd-55ee-66ff-77aa88bb99cc",
    status: "completed",
    metadata: {
      environment: "staging",
      model_tested: "gpt-3.5-turbo",
      dataset_version: "v1.2",
      requested_metrics: ["faithfulness", "answer_relevancy"],
    },
    item_count: 3,
    created_at: d(5),
    updated_at: d(5),
  },
  {
    run_id: "cc33dd44-55ee-66ff-77aa-88bb99cc00dd",
    status: "completed",
    metadata: {
      environment: "production",
      model_tested: "gpt-4o",
      dataset_version: "v1.3",
      requested_metrics: ["faithfulness", "answer_relevancy", "correctness"],
    },
    item_count: 8,
    created_at: d(4),
    updated_at: d(4),
  },
  {
    run_id: "dd44ee55-66ff-77aa-88bb-99cc00ddeeff",
    status: "failed",
    metadata: {
      environment: "staging",
      model_tested: "claude-3-haiku",
      dataset_version: "v1.3",
      requested_metrics: ["faithfulness", "conciseness"],
    },
    item_count: 5,
    created_at: d(3),
    updated_at: d(3),
  },
  {
    run_id: "ee55ff66-77aa-88bb-99cc-00ddeeff1122",
    status: "completed",
    metadata: {
      environment: "staging",
      model_tested: "gpt-4o",
      dataset_version: "v1.4",
      requested_metrics: ["faithfulness", "answer_relevancy", "conciseness"],
    },
    item_count: 4,
    created_at: d(2),
    updated_at: d(2),
  },
  {
    run_id: "ff66aa77-88bb-99cc-00dd-eeff11223344",
    status: "completed",
    metadata: {
      environment: "production",
      model_tested: "gpt-3.5-turbo",
      dataset_version: "v1.4",
      requested_metrics: ["faithfulness", "answer_relevancy"],
    },
    item_count: 6,
    created_at: d(1),
    updated_at: d(1),
  },
  {
    run_id: "aa77bb88-99cc-00dd-11ee-ff22334455aa",
    status: "pending",
    metadata: {
      environment: "production",
      model_tested: "gpt-4o",
      dataset_version: "v2.0",
      requested_metrics: ["faithfulness", "answer_relevancy", "correctness", "conciseness"],
    },
    item_count: 10,
    created_at: d(0),
    updated_at: d(0),
  },
  {
    run_id: "bb88cc99-00dd-11ee-22ff-334455aa66bb",
    status: "pending",
    metadata: {
      environment: "staging",
      model_tested: "claude-3-opus",
      dataset_version: "v2.0",
      requested_metrics: ["faithfulness", "answer_relevancy"],
    },
    item_count: 3,
    created_at: d(0),
    updated_at: d(0),
  },
]

export const evaluationDetails: Record<string, EvaluationDetail> = {
  "aa11bb22-33cc-44dd-55ee-66ff77aa88bb": {
    ...evaluationRuns[0],
    summary: { faithfulness: 0.92, answer_relevancy: 0.88 },
    items: [
      {
        item_id: "item-001",
        query: "What is the capital of France?",
        response: "The capital of France is Paris.",
        contexts: ["France is a country in Western Europe. Its capital and largest city is Paris."],
        ground_truth: "Paris",
        scores: {
          faithfulness: { value: 1.0, details: { reason: "The response is fully supported by the provided context." } },
          answer_relevancy: { value: 0.95, details: { reason: "Directly and correctly answers the query." } },
        },
      },
      {
        item_id: "item-002",
        query: "What is photosynthesis?",
        response: "It is how plants make food using sunlight and carbon dioxide.",
        contexts: ["Photosynthesis is the process used by plants, algae and certain bacteria to convert light energy into chemical energy."],
        ground_truth: "The process by which plants use sunlight, water, and carbon dioxide to produce oxygen and energy.",
        scores: {
          faithfulness: { value: 0.9, details: { reason: "Mostly accurate but omits water as a reactant." } },
          answer_relevancy: { value: 0.88, details: { reason: "Answers correctly but could be more complete." } },
        },
      },
      {
        item_id: "item-003",
        query: "Who wrote Hamlet?",
        response: "Hamlet was written by William Shakespeare, likely between 1599 and 1601.",
        contexts: ["Hamlet is a tragedy written by William Shakespeare, believed to have been written around 1600."],
        ground_truth: "William Shakespeare",
        scores: {
          faithfulness: { value: 1.0, details: { reason: "Fully grounded in the context." } },
          answer_relevancy: { value: 0.92, details: { reason: "Provides the answer and relevant context." } },
        },
      },
      {
        item_id: "item-004",
        query: "What is machine learning?",
        response: "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
        contexts: ["Machine learning (ML) is a field of study in artificial intelligence concerned with the development and study of statistical algorithms that can learn from data."],
        ground_truth: "A field of AI where systems learn from data to improve performance.",
        scores: {
          faithfulness: { value: 0.88, details: { reason: "Accurate but slightly simplified." } },
          answer_relevancy: { value: 0.9, details: { reason: "Good definition, directly addresses the query." } },
        },
      },
      {
        item_id: "item-005",
        query: "When did World War II end?",
        response: "World War II ended in 1945 with the surrender of Germany in May and Japan in September.",
        contexts: ["World War II ended in Europe on May 8, 1945 (V-E Day) and in the Pacific on September 2, 1945 (V-J Day) when Japan formally surrendered."],
        ground_truth: "1945",
        scores: {
          faithfulness: { value: 0.95, details: { reason: "Well-grounded in the provided context." } },
          answer_relevancy: { value: 0.85, details: { reason: "Provides precise dates which enhances the answer." } },
        },
      },
    ],
  },
  "bb22cc33-44dd-55ee-66ff-77aa88bb99cc": {
    ...evaluationRuns[1],
    summary: { faithfulness: 0.78, answer_relevancy: 0.82 },
    items: [
      {
        item_id: "item-006",
        query: "What causes rainbows?",
        response: "Rainbows are caused by sunlight refracting through water droplets in the atmosphere.",
        contexts: ["Rainbows are optical phenomena caused by the refraction, reflection and dispersion of light in water droplets."],
        scores: {
          faithfulness: { value: 0.85, details: { reason: "Accurate but misses reflection and dispersion." } },
          answer_relevancy: { value: 0.88, details: { reason: "Correct and concise answer." } },
        },
      },
      {
        item_id: "item-007",
        query: "Who invented the telephone?",
        response: "The telephone was invented by Alexander Graham Bell in 1876.",
        contexts: ["Alexander Graham Bell is credited with inventing the first practical telephone and was awarded the first patent for it on March 7, 1876."],
        scores: {
          faithfulness: { value: 0.9, details: { reason: "Correct and grounded in context." } },
          answer_relevancy: { value: 0.92, details: { reason: "Direct answer to the question." } },
        },
      },
      {
        item_id: "item-008",
        query: "What is the speed of light?",
        response: "The speed of light is approximately 300,000 km/s but the exact value is 299,792,458 m/s.",
        contexts: ["The speed of light in a vacuum is exactly 299,792,458 metres per second, a fundamental physical constant."],
        scores: {
          faithfulness: { value: 0.72, details: { reason: "Approximate value cited differently from context." } },
          answer_relevancy: { value: 0.75, details: { reason: "Answer is correct but phrasing is slightly off." } },
        },
      },
    ],
  },
}

export const humanReviewSamples: HumanReviewSample[] = [
  {
    item_id: "item-001",
    query: "What is the capital of France?",
    response: "The capital of France is Paris.",
    contexts: ["France is a country in Western Europe. Its capital and largest city is Paris."],
    ground_truth: "Paris",
    metric_name: "faithfulness",
    llm_score: 1.0,
    llm_reason: "The response is fully supported by the provided context.",
    run_id: "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
  },
  {
    item_id: "item-006",
    query: "What causes rainbows?",
    response: "Rainbows are caused by sunlight refracting through water droplets in the atmosphere.",
    contexts: ["Rainbows are optical phenomena caused by the refraction, reflection and dispersion of light in water droplets."],
    metric_name: "faithfulness",
    llm_score: 0.85,
    llm_reason: "Accurate but misses reflection and dispersion components.",
    run_id: "bb22cc33-44dd-55ee-66ff-77aa88bb99cc",
  },
  {
    item_id: "item-003",
    query: "Who wrote Hamlet?",
    response: "Hamlet was written by William Shakespeare, likely between 1599 and 1601.",
    contexts: ["Hamlet is a tragedy written by William Shakespeare, believed to have been written around 1600."],
    ground_truth: "William Shakespeare",
    metric_name: "answer_relevancy",
    llm_score: 0.92,
    llm_reason: "Provides the answer and adds useful historical context.",
    run_id: "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
  },
  {
    item_id: "item-008",
    query: "What is the speed of light?",
    response: "The speed of light is approximately 300,000 km/s but the exact value is 299,792,458 m/s.",
    contexts: ["The speed of light in a vacuum is exactly 299,792,458 metres per second, a fundamental physical constant."],
    metric_name: "faithfulness",
    llm_score: 0.72,
    llm_reason: "Approximate value phrasing deviates slightly from the context.",
    run_id: "bb22cc33-44dd-55ee-66ff-77aa88bb99cc",
  },
  {
    item_id: "item-004",
    query: "What is machine learning?",
    response: "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
    contexts: ["Machine learning (ML) is a field of study in artificial intelligence concerned with the development and study of statistical algorithms."],
    ground_truth: "A field of AI where systems learn from data.",
    metric_name: "correctness",
    llm_score: 0.88,
    llm_reason: "Definition is correct but misses the statistical algorithm emphasis.",
    run_id: "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
  },
]

export const calibrationStats: CalibrationStat[] = [
  {
    metric_name: "faithfulness",
    total_reviewed: 28,
    mean_human_score: 0.84,
    mean_llm_score: 0.89,
    mean_absolute_error: 0.06,
    correlation_pearson: 0.88,
    bias_detected: false,
    samples: [
      { human: 0.8, llm: 1.0, delta: -0.2, reason: "LLM over-scored: response used slightly different phrasing than context." },
      { human: 0.9, llm: 0.85, delta: 0.05, reason: "Human rated slightly higher; response was accurate." },
      { human: 0.7, llm: 0.72, delta: -0.02, reason: "Good agreement on borderline case." },
      { human: 1.0, llm: 1.0, delta: 0.0, reason: "Perfect agreement." },
      { human: 0.5, llm: 0.65, delta: -0.15, reason: "LLM missed that a key fact was not in context." },
      { human: 0.95, llm: 0.9, delta: 0.05, reason: "Minor disagreement on near-perfect response." },
      { human: 0.6, llm: 0.75, delta: -0.15, reason: "LLM over-scored weak grounding." },
      { human: 0.85, llm: 0.88, delta: -0.03, reason: "Close agreement." },
    ],
  },
  {
    metric_name: "answer_relevancy",
    total_reviewed: 22,
    mean_human_score: 0.87,
    mean_llm_score: 0.85,
    mean_absolute_error: 0.08,
    correlation_pearson: 0.82,
    bias_detected: false,
    samples: [
      { human: 0.9, llm: 0.88, delta: 0.02, reason: "Very close agreement on high-quality answer." },
      { human: 0.7, llm: 0.82, delta: -0.12, reason: "LLM higher; human found answer too verbose." },
      { human: 0.95, llm: 0.95, delta: 0.0, reason: "Perfect agreement." },
      { human: 0.6, llm: 0.55, delta: 0.05, reason: "Both rated low; off-topic response." },
      { human: 0.85, llm: 0.9, delta: -0.05, reason: "Small discrepancy on comprehensive answer." },
      { human: 0.75, llm: 0.68, delta: 0.07, reason: "Human valued partial answer more." },
    ],
  },
]

export const healthStatus: HealthStatus = {
  status: "healthy",
  environment: "development",
  database: "connected",
  version: "1.0.0",
}

export const scoreTrendData = [
  { date: "Jul 9", faithfulness: 0.92, answer_relevancy: 0.88, model: "gpt-4o" },
  { date: "Jul 10", faithfulness: 0.78, answer_relevancy: 0.82, model: "gpt-3.5-turbo" },
  { date: "Jul 11", faithfulness: 0.95, answer_relevancy: 0.91, model: "gpt-4o" },
  { date: "Jul 13", faithfulness: 0.89, answer_relevancy: 0.86, model: "gpt-4o" },
  { date: "Jul 14", faithfulness: 0.81, answer_relevancy: 0.79, model: "gpt-3.5-turbo" },
]

export const modelComparisonData = [
  { model: "gpt-4o", faithfulness: 0.92, answer_relevancy: 0.88, runs: 3 },
  { model: "gpt-3.5-turbo", faithfulness: 0.8, answer_relevancy: 0.81, runs: 2 },
  { model: "claude-3-opus", faithfulness: 0, answer_relevancy: 0, runs: 0 },
  { model: "claude-3-haiku", faithfulness: 0, answer_relevancy: 0, runs: 0 },
]
