import Groq from "groq-sdk";

export const GROQ_MODEL = "openai/gpt-oss-20b";

export type JsonSchemaResponse = {
  name: string;
  schema: Record<string, unknown>;
};

export type TextGenerationRequest = {
  system: string;
  user: string;
  maxTokens: number;
  jsonSchema?: JsonSchemaResponse;
};

export type TextGenerator = (
  request: TextGenerationRequest,
) => Promise<string>;

export function getGroqTextGenerator(): TextGenerator | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const client = new Groq({ apiKey });
  return async ({ system, user, maxTokens, jsonSchema }) => {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: maxTokens,
      temperature: 0,
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: jsonSchema
        ? {
            type: "json_schema",
            json_schema: {
              name: jsonSchema.name,
              strict: true,
              schema: jsonSchema.schema,
            },
          }
        : { type: "text" },
    });
    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new Error("Groq returned no text content.");
    return text;
  };
}
